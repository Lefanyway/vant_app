"""VANT win-probability model: Elo ratings plus a logistic regression over pre-match features.

Reads every match from Supabase, walks them in time order so each feature only uses what was known
before the match, evaluates with a walk-forward backtest, and writes one prediction per match back
through the ingest_predictions RPC.

Run from the repository root:  python ml/train.py            (add --dry-run to skip the upload)
"""
from __future__ import annotations

import argparse
import json
import math
import os
import urllib.request
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss

MODEL_VERSION = "elo-logreg-v2"
ELO_START = 1500.0
ELO_K = 32.0
FORM_WINDOW = 5
MIN_TRAIN = 60          # matches needed before the regression replaces plain Elo
RETRAIN_EVERY = 20      # walk-forward: refit after this many new finished matches
FEATURES = ["listed_first", "elo_diff", "form_diff", "h2h_diff", "experience_diff", "rest_diff", "elo_diff_bo"]
PROVISIONAL_GAMES = 10   # teams with fewer games move faster, so newcomers find their level

ENV_FILE = Path(__file__).resolve().parents[1] / "artifacts" / "api-server" / ".env"


def load_env() -> dict[str, str]:
    """Environment variables first (GitHub Actions secrets), then the API's local .env."""
    keys = ("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_INGEST_KEY")
    if all(os.environ.get(key) for key in keys):
        return {key: os.environ[key] for key in keys}
    values = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"')
    return values


def rest(env: dict[str, str], path: str, body: dict | None = None):
    request = urllib.request.Request(
        f"{env['SUPABASE_URL']}/rest/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        method="POST" if body is not None else "GET",
        headers={"apikey": env["SUPABASE_PUBLISHABLE_KEY"], "Authorization": f"Bearer {env['SUPABASE_PUBLISHABLE_KEY']}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read())


def fetch_matches(env: dict[str, str]) -> list[dict]:
    rows, offset = [], 0
    columns = "id,status,start_time,best_of,home_team_id,away_team_id,home_score,away_score"
    while True:
        page = rest(env, f"matches?select={columns}&start_time=not.is.null&order=start_time.asc,id.asc&limit=1000&offset={offset}")
        rows.extend(page)
        if len(page) < 1000:
            return rows
        offset += 1000


@dataclass
class TeamState:
    elo: float = ELO_START
    played: int = 0
    last_played: datetime | None = None
    form: deque = field(default_factory=lambda: deque(maxlen=FORM_WINDOW))


def elo_expected(diff: float) -> float:
    return 1.0 / (1.0 + 10 ** (-diff / 400.0))


class History:
    """Everything known about the teams up to a point in time."""

    def __init__(self):
        self.teams: dict[str, TeamState] = defaultdict(TeamState)
        self.h2h: dict[tuple[str, str], int] = defaultdict(int)

    def features(self, home: str, away: str, when: datetime, best_of: int | None) -> dict[str, float]:
        a, b = self.teams[home], self.teams[away]
        form = lambda team: (sum(team.form) / len(team.form)) if team.form else 0.5
        rest_days = lambda team: min((when - team.last_played).total_seconds() / 86400, 30) if team.last_played else 30
        elo_diff = (a.elo - b.elo) / 100.0
        return {
            # PandaScore tends to list the higher seed first; mirrored rows flip it to -1.
            "listed_first": 1.0,
            "elo_diff": elo_diff,
            "form_diff": form(a) - form(b),
            "h2h_diff": float(self.h2h[(home, away)] - self.h2h[(away, home)]),
            "experience_diff": math.log1p(a.played) - math.log1p(b.played),
            "rest_diff": (rest_days(a) - rest_days(b)) / 10.0,
            # Longer series let the stronger team win more often.
            "elo_diff_bo": elo_diff * ((best_of or 3) - 1) / 2.0,
        }

    def update(self, home: str, away: str, when: datetime, home_won: bool, margin: int):
        a, b = self.teams[home], self.teams[away]
        surprise = (1.0 if home_won else 0.0) - elo_expected(a.elo - b.elo)
        # A clean sweep (2-0, 3-0) says more than a 2-1.
        weight = 1.0 + 0.25 * max(margin - 1, 0)
        k = lambda team: ELO_K * (1.5 if team.played < PROVISIONAL_GAMES else 1.0)
        a.elo += k(a) * weight * surprise
        b.elo -= k(b) * weight * surprise
        for team, won in ((a, home_won), (b, not home_won)):
            team.played += 1
            team.last_played = when
            team.form.append(1.0 if won else 0.0)
        self.h2h[(home, away) if home_won else (away, home)] += 1


def vector(features: dict[str, float]) -> list[float]:
    return [features[name] for name in FEATURES]


def fit(rows: list[tuple[dict, int]]) -> LogisticRegression:
    # Home and away are only the order PandaScore lists the teams in, so every match is also learned mirrored.
    x = [vector(f) for f, _ in rows] + [[-v for v in vector(f)] for f, _ in rows]
    y = [label for _, label in rows] + [1 - label for _, label in rows]
    model = LogisticRegression(fit_intercept=False, C=1.0, max_iter=1000)
    model.fit(np.array(x), np.array(y))
    return model


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="train and print metrics without writing to Supabase")
    args = parser.parse_args()

    env = load_env()
    matches = fetch_matches(env)
    history = History()
    seen: list[tuple[dict, int]] = []          # finished matches with features, in time order
    model: LogisticRegression | None = None
    trained_on = 0
    backtest: list[tuple[float, float, int]] = []   # (model prob, elo prob, label) for matches predicted before being seen
    predictions = []

    for match in matches:
        home, away = match["home_team_id"], match["away_team_id"]
        if not home or not away or match["status"] == "cancelled":
            continue
        when = parse_time(match["start_time"])
        features = history.features(home, away, when, match["best_of"])
        if model is None and len(seen) >= MIN_TRAIN or model is not None and len(seen) - trained_on >= RETRAIN_EVERY:
            model, trained_on = fit(seen), len(seen)
        elo_prob = elo_expected(features["elo_diff"] * 100)
        prob = float(model.predict_proba([vector(features)])[0][1]) if model is not None else elo_prob
        predictions.append({
            "match_id": match["id"],
            "home_win_prob": round(prob, 4),
            "home_elo": round(history.teams[home].elo, 1),
            "away_elo": round(history.teams[away].elo, 1),
            "features": {name: round(value, 4) for name, value in features.items()},
        })
        scored = match["status"] == "finished" and match["home_score"] is not None and match["away_score"] is not None and match["home_score"] != match["away_score"]
        if scored:
            label = int(match["home_score"] > match["away_score"])
            if model is not None:
                backtest.append((prob, elo_prob, label))
            seen.append((features, label))
            history.update(home, away, when, bool(label), abs(match["home_score"] - match["away_score"]))

    # Matches still to come get the final model, fitted on everything finished.
    final = fit(seen)
    for row in predictions:
        match = next(m for m in matches if m["id"] == row["match_id"])
        if match["status"] != "finished":
            row["home_win_prob"] = round(float(final.predict_proba([vector(row["features"])])[0][1]), 4)
            row["home_elo"] = round(history.teams[match["home_team_id"]].elo, 1)
            row["away_elo"] = round(history.teams[match["away_team_id"]].elo, 1)

    probs = np.array([p for p, _, _ in backtest])
    elo_probs = np.array([e for _, e, _ in backtest])
    labels = np.array([y for _, _, y in backtest])
    score = lambda p: {"accuracy": round(accuracy_score(labels, p >= 0.5), 4), "brier": round(brier_score_loss(labels, p), 4), "log_loss": round(log_loss(labels, np.clip(p, 1e-6, 1 - 1e-6)), 4)}
    metrics = {
        "method": f"walk-forward: refit every {RETRAIN_EVERY} matches, each match predicted only from earlier ones",
        "test_matches": int(len(labels)),
        "model": score(probs),
        "elo_only": score(elo_probs),
        "coin_flip": score(np.full(len(labels), 0.5)),
    }
    coefficients = {name: round(float(weight), 4) for name, weight in zip(FEATURES, final.coef_[0])}
    run = {"model_version": MODEL_VERSION, "train_matches": len(seen), "test_matches": int(len(labels)), "metrics": metrics, "coefficients": coefficients}
    print(json.dumps(run, indent=2, ensure_ascii=False))

    if args.dry_run:
        print(f"dry run: {len(predictions)} predictions not uploaded")
        return
    result = rest(env, "rpc/ingest_predictions", {"p_key": env["SUPABASE_INGEST_KEY"], "p_run": run, "p_predictions": predictions})
    print(f"uploaded: {result}")


if __name__ == "__main__":
    main()
