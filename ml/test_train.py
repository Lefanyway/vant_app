"""Unit tests for the win-probability model. Run from the repository root:  python -m unittest discover ml"""
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import train  # noqa: E402

START = datetime(2026, 1, 1, tzinfo=timezone.utc)


class EloTest(unittest.TestCase):
    def test_expected_score_is_symmetric_and_even_for_equal_ratings(self):
        self.assertAlmostEqual(train.elo_expected(0), 0.5)
        for diff in (-400, -50, 120, 800):
            self.assertAlmostEqual(train.elo_expected(diff) + train.elo_expected(-diff), 1.0)
        self.assertGreater(train.elo_expected(100), 0.5)

    def test_a_result_moves_both_ratings_by_the_same_amount(self):
        history = train.History()
        history.teams["a"].played = history.teams["b"].played = 20  # past the provisional games
        history.update("a", "b", START, home_won=True, margin=1)
        a, b = history.teams["a"].elo, history.teams["b"].elo
        self.assertGreater(a, train.ELO_START)
        self.assertAlmostEqual((a - train.ELO_START) + (b - train.ELO_START), 0.0)

    def test_a_sweep_moves_ratings_more_than_a_close_series(self):
        close, sweep = train.History(), train.History()
        close.update("a", "b", START, home_won=True, margin=1)
        sweep.update("a", "b", START, home_won=True, margin=2)
        self.assertGreater(sweep.teams["a"].elo, close.teams["a"].elo)

    def test_newcomers_move_faster_than_established_teams(self):
        new, settled = train.History(), train.History()
        settled.teams["a"].played = settled.teams["b"].played = train.PROVISIONAL_GAMES
        new.update("a", "b", START, home_won=True, margin=1)
        settled.update("a", "b", START, home_won=True, margin=1)
        self.assertGreater(new.teams["a"].elo, settled.teams["a"].elo)


class FeatureTest(unittest.TestCase):
    def test_features_only_use_what_happened_before_the_match(self):
        history = train.History()
        before = history.features("a", "b", START, 3)
        history.update("a", "b", START, home_won=True, margin=2)
        after = history.features("a", "b", START + timedelta(days=1), 3)
        self.assertEqual(before["elo_diff"], 0.0)
        self.assertEqual(before["h2h_diff"], 0.0)
        self.assertGreater(after["elo_diff"], 0.0)
        self.assertEqual(after["h2h_diff"], 1.0)

    def test_form_reflects_the_last_five_results_only(self):
        history = train.History()
        for day in range(7):
            history.update("a", f"x{day}", START + timedelta(days=day), home_won=day >= 2, margin=1)
        self.assertEqual(list(history.teams["a"].form), [1.0] * 5)

    def test_every_feature_has_a_value(self):
        features = train.History().features("a", "b", START, None)
        self.assertEqual(set(features), set(train.FEATURES))


class ModelTest(unittest.TestCase):
    def test_learns_that_a_higher_elo_wins_more(self):
        rng = np.random.default_rng(7)
        rows = []
        for _ in range(400):
            diff = rng.normal(0, 2)
            features = {name: 0.0 for name in train.FEATURES}
            features.update(listed_first=1.0, elo_diff=diff)
            rows.append((features, int(rng.random() < train.elo_expected(diff * 100))))
        model = train.fit(rows)
        strong = {name: 0.0 for name in train.FEATURES} | {"listed_first": 1.0, "elo_diff": 3.0}
        weak = strong | {"elo_diff": -3.0}
        self.assertGreater(model.predict_proba([train.vector(strong)])[0][1], 0.8)
        self.assertLess(model.predict_proba([train.vector(weak)])[0][1], 0.2)

    def test_swapping_the_teams_swaps_the_probability(self):
        rows = [({name: (0.5 if index % 2 else -0.5) for name in train.FEATURES}, index % 2) for index in range(50)]
        model = train.fit(rows)
        features = train.vector({name: 0.3 for name in train.FEATURES})
        mirrored = [-value for value in features]
        home = model.predict_proba([features])[0][1]
        away = model.predict_proba([mirrored])[0][1]
        self.assertAlmostEqual(home + away, 1.0, places=6)


class EnvironmentTest(unittest.TestCase):
    def test_reads_keys_from_the_environment_first(self):
        keys = {"SUPABASE_URL": "https://db.test", "SUPABASE_PUBLISHABLE_KEY": "pub", "SUPABASE_INGEST_KEY": "ingest"}
        original = {key: train.os.environ.get(key) for key in keys}
        train.os.environ.update(keys)
        try:
            self.assertEqual(train.load_env(), keys)
        finally:
            for key, value in original.items():
                if value is None:
                    train.os.environ.pop(key, None)
                else:
                    train.os.environ[key] = value


if __name__ == "__main__":
    unittest.main()
