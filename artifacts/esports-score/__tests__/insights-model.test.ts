jest.mock("@/lib/supabase", () => ({ supabase: {} }));
import { confidence, explain, modelHit, probability } from "@/lib/insights";

// A real stored prediction (pandascore:1804308) and the run that produced it.
const coefficients = { elo_diff: 0.3203, h2h_diff: 0.0235, form_diff: 0.7452, rest_diff: 0.0496, elo_diff_bo: 0.0361, listed_first: 0.0454, experience_diff: 0.2035 };
const features = { elo_diff: 0.0862, h2h_diff: 0, form_diff: 0, rest_diff: -0.0898, elo_diff_bo: 0.0862, listed_first: 1, experience_diff: 0 };

describe("prediction model in the app", () => {
  it("recomputes the stored win chance from features and weights", () => {
    expect(probability(features, coefficients)).toBeCloseTo(0.5179, 3);
  });

  it("explains with Elo as one factor and leaves out the listing order", () => {
    const reasons = explain({ ...features, form_diff: -0.4 }, coefficients);
    expect(reasons.map((reason) => reason.label)).toEqual(["Forma recente", "Força (Elo)"]);
    expect(reasons[0].weight).toBeLessThan(0);
    expect(reasons[1].weight).toBeCloseTo(0.3203 * 0.0862 + 0.0361 * 0.0862, 4);
  });

  it("labels confidence and scores hits", () => {
    expect([confidence(0.75), confidence(0.698), confidence(0.4), confidence(0.52)]).toEqual(["Favorito claro", "Favorito claro", "Leve favorito", "Jogo equilibrado"]);
    const match = { predictions: { home_win_prob: 0.3, features: null }, home_score: 0, away_score: 2 } as never;
    expect(modelHit(match)).toBe(true);
  });
});
