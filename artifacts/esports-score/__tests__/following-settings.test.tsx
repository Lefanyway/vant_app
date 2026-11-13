import { render, screen } from "@testing-library/react-native";
import { FollowingSettings } from "@/components/FollowingSettings";

let mockRows: unknown = [];
jest.mock("@tanstack/react-query", () => ({ ...jest.requireActual("@tanstack/react-query"), useQuery: () => ({ data: mockRows, isLoading: false, isError: false }), useQueryClient: () => ({ setQueryData: jest.fn() }) }));
jest.mock("@/lib/supabase", () => ({ supabase: {} }));
jest.mock("@/context/AppContext", () => ({ useApp: () => ({ favoriteTeams: [], favoriteCompetitions: [], toggleFavorite: jest.fn(), toggleCompetition: jest.fn() }) }));

test("lists followed teams and competitions with their alert setting", () => {
  mockRows = [
    { kind: "competition", entity_id: "pandascore:7", notify: false, name: "VCT Americas" },
    { kind: "team", entity_id: "pandascore:1", notify: true, name: "LOUD" },
  ];
  render(<FollowingSettings />);
  expect(screen.getByText("LOUD")).toBeTruthy();
  expect(screen.getByText("Equipe · com avisos")).toBeTruthy();
  expect(screen.getByText("Competição · sem avisos")).toBeTruthy();
  expect(screen.getByLabelText("Deixar de seguir LOUD")).toBeTruthy();
});

test("explains how to follow when there is nothing yet", () => {
  mockRows = [];
  render(<FollowingSettings />);
  expect(screen.getByText(/Siga equipes e competições/)).toBeTruthy();
});
