import { render, screen } from "@testing-library/react-native";
import { isEmail } from "@/components/AuthScreen";
import { WinProbability } from "@/components/WinProbability";
import type { Match } from "@/lib/data";

let mockPrediction: unknown = null;
jest.mock("@tanstack/react-query", () => ({ ...jest.requireActual("@tanstack/react-query"), useQuery: () => ({ data: mockPrediction }) }));
jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("expo-router", () => ({ router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() } }));

const match = (overrides: Partial<Match>): Match => ({
  id: "pandascore:1", game: "Valorant", tournament: "VCT", time: "18:00", status: "Upcoming",
  teamA: { id: "pandascore:10", name: "LOUD", short: "LOUD", color: "#000", game: "Valorant" },
  teamB: { id: "pandascore:20", name: "Sentinels", short: "SEN", color: "#000", game: "Valorant" },
  ...overrides,
} as Match);

test("accepts only well-formed e-mails", () => {
  expect(isEmail("nome@email.com")).toBe(true);
  expect(isEmail(" nome@email.com ")).toBe(true);
  for (const value of ["", "nome", "nome@", "nome@email", "nome @email.com"]) expect(isEmail(value)).toBe(false);
});

test("shows each team's chance before the match", () => {
  mockPrediction = { home_win_prob: 0.62, home_elo: 1700, away_elo: 1620, model_runs: { metrics: { model: { accuracy: 0.6 } } } };
  render(<WinProbability match={match({})} />);
  expect(screen.getByText("62%")).toBeTruthy();
  expect(screen.getByText("38%")).toBeTruthy();
  expect(screen.getByText(/acerta 60% nos testes/)).toBeTruthy();
});

test("says whether the model picked the winner of a finished match", () => {
  mockPrediction = { home_win_prob: 0.7, home_elo: 1700, away_elo: 1500, model_runs: null };
  const { rerender } = render(<WinProbability match={match({ status: "Finished", scoreA: 2, scoreB: 0 })} />);
  expect(screen.getByText(/O modelo acertou o vencedor/)).toBeTruthy();
  rerender(<WinProbability match={match({ status: "Finished", scoreA: 0, scoreB: 2 })} />);
  expect(screen.getByText(/O modelo errou o vencedor/)).toBeTruthy();
});

test("shows nothing when the match has no prediction", () => {
  mockPrediction = null;
  render(<WinProbability match={match({})} />);
  expect(screen.queryByText(/Chance de vitória/)).toBeNull();
});
