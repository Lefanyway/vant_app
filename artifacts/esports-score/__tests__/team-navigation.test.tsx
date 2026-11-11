import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import TeamDetail from "@/app/teams/[id]";
import Search from "@/app/(tabs)/search";
import Following from "@/app/(tabs)/following";
import MatchDetail from "@/app/match/[id]";
import { MatchCard } from "@/components/MatchCard";
import { TeamLink } from "@/components/TeamLink";

const mockApi = {
  fetchTeamOverview: jest.fn(),
  fetchTeamMatches: jest.fn(),
  fetchTeamRoster: jest.fn(),
  fetchTeamStats: jest.fn(),
  fetchSearch: jest.fn(),
  fetchTeams: jest.fn(),
  fetchMatches: jest.fn(),
  fetchMatchDetails: jest.fn(),
  localDateKey: () => "2026-08-24",
  toApiTeam: (team: any) => ({
    id: team.id,
    name: team.name,
    short: team.acronym ?? team.name.slice(0, 3).toUpperCase(),
    color: "#4C8DFF",
    game: team.gameId === "cs2" ? "CS2" : "Valorant",
    gameId: team.gameId,
  }),
  toMatch: (match: any) => ({
    id: match.id,
    startTime: match.startTime,
    game: "Valorant",
    tournament: match.competition?.name ?? "Test Cup",
    time: "12:00",
    status: match.status === "finished" ? "Finished" : "Upcoming",
    teamA: mockApi.toApiTeam(match.homeTeam),
    teamB: mockApi.toApiTeam(match.awayTeam),
    scoreA: match.homeScore,
    scoreB: match.awayScore,
    format: "BO3",
    detail: "Match",
  }),
};
let mockRouteParams: { id?: string } = { id: "loud" };
const mockToggleFavorite = jest.fn();
let mockFavoriteTeams: string[] = [];
const mockQueryState: Record<string, unknown> = {};
const mockLoading = new Set<string>();
const mockQueryKeys: unknown[][] = [];

jest.mock("@/lib/api", () => ({
  fetchTeamOverview: () => Promise.resolve(null), fetchTeamMatches: () => Promise.resolve({ matches: [], hasMore: false }),
  fetchTeamRoster: () => Promise.resolve([]), fetchTeamStats: () => Promise.resolve({ stats: null, available: false }),
  fetchSearch: () => Promise.resolve([]), fetchTeams: () => Promise.resolve([]), fetchMatches: () => Promise.resolve([]),
  fetchMatchDetails: () => Promise.resolve(null), fetchMatch: () => Promise.resolve(null), fetchMatchStats: () => Promise.resolve(null), applyMatchStats: (details: unknown) => details, errorMessage: (_error: unknown, fallback: string) => fallback, localDateKey: () => "2026-08-24",
  toApiTeam: (value: any) => ({ id: value.id, name: value.name, short: value.acronym ?? value.name.slice(0, 3).toUpperCase(), color: "#4C8DFF", game: "Valorant", gameId: value.gameId }),
  toMatch: (value: any) => ({ id: value.id, startTime: value.startTime, game: "Valorant", tournament: "Test Cup", time: "12:00", status: "Upcoming", teamA: value.homeTeam, teamB: value.awayTeam, format: "BO3", detail: "Match" }),
}));
jest.mock("@tanstack/react-query", () => {
  class QueryClient {
    setQueryData() {}
    prefetchQuery() { return Promise.resolve(); }
  }
  return {
    QueryClient,
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
      mockQueryKeys.push(queryKey);
      const key = String(queryKey[0]);
      return { data: mockQueryState[key], isLoading: mockLoading.has(key), isError: false, error: null, refetch: jest.fn() };
    },
    useInfiniteQuery: ({ queryKey }: { queryKey: unknown[] }) => {
      mockQueryKeys.push(queryKey);
      const key = String(queryKey[0]);
      const pages = (mockQueryState[key] as unknown[] | undefined) ?? [];
      return { data: { pages }, isLoading: mockLoading.has(key), isError: false, hasNextPage: false, isFetchingNextPage: false, fetchNextPage: jest.fn() };
    },
  };
});
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockRouteParams,
  useIsFocused: () => true,
}));
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fff", card: "#f8f8f8", border: "#ddd", foreground: "#111",
    mutedForeground: "#666", primary: "#345cff", secondary: "#eee",
    accent: "#e8edff", primaryForeground: "#fff", positive: "#16834b",
    destructive: "#c33",
  }),
}));
jest.mock("@/context/AppContext", () => ({
  useApp: () => ({ favoriteTeams: mockFavoriteTeams, toggleFavorite: mockToggleFavorite, notifications: {
    before30: true, before5: false, start: true, result: true, spoilerFree: true,
  }, toggleNotification: jest.fn() }),
}));

const team = { id: "loud", name: "LOUD", acronym: "LOUD", gameId: "valorant", country: "BR" };
const opponent = { id: "fnatic", name: "FNATIC", acronym: "FNC", gameId: "valorant" };
const overview = {
  team,
  nextMatch: null,
  recentMatches: [],
  competitions: [],
  rosterPreview: [],
  recentForm: [],
  capabilities: { overview: true, matches: true, roster: false, stats: true, news: false },
};

function renderWithQuery(ui: React.ReactElement) {
  return render(ui);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = { id: "loud" };
  mockFavoriteTeams = [];
  mockQueryKeys.length = 0;
  Object.keys(mockQueryState).forEach((key) => delete mockQueryState[key]);
  mockLoading.clear();
  mockQueryState["team-overview"] = overview;
  mockQueryState["team-matches"] = [{ matches: [], hasMore: false }];
  mockQueryState["team-stats"] = { stats: null, available: false };
  mockQueryState["teams"] = [team];
  mockQueryState["matches"] = [];
});

describe("universal team profile", () => {
  it("opens a real team deep link and shows the not-found state", async () => {
    mockRouteParams = { id: "loud" };
    renderWithQuery(<TeamDetail />);
    expect((await screen.findAllByText("LOUD")).length).toBeGreaterThan(0);
    expect(mockQueryKeys.some(([key, id]) => key === "team-overview" && id === "loud")).toBe(true);

    mockQueryState["team-overview"] = null;
    mockRouteParams = { id: "missing-team" };
    renderWithQuery(<TeamDetail />);
    expect(await screen.findByText("Equipe não encontrada.")).toBeTruthy();
  });

  it("toggles following from the team profile", async () => {
    renderWithQuery(<TeamDetail />);
    const follow = await screen.findByText("Seguir");
    fireEvent.press(follow);
    expect(mockToggleFavorite).toHaveBeenCalledWith("loud");
  });

  it("renders loading, unavailable stats, and an empty matches state", async () => {
    mockLoading.add("team-overview");
    renderWithQuery(<TeamDetail />);
    expect(screen.queryByText("Equipe não encontrada.")).toBeNull();
    mockLoading.delete("team-overview");
    mockQueryState["team-overview"] = overview;
    renderWithQuery(<TeamDetail />);
    expect(screen.getByText("Estatísticas")).toBeTruthy();
    fireEvent.press(screen.getByText("Estatísticas"));
    expect(await screen.findByText("Estatísticas indisponíveis.")).toBeTruthy();
    fireEvent.press(screen.getByText("Partidas"));
    expect(await screen.findByText("Nenhuma partida encontrada.")).toBeTruthy();
  });
});

describe("team profile entry points", () => {
  it("links a search result to the team profile", async () => {
    mockQueryState.catalog = [{ items: [{ type: "team", id: "loud", name: "LOUD", gameId: "valorant" }], hasMore: false }];
    jest.useFakeTimers();
    renderWithQuery(<Search />);
    fireEvent.changeText(screen.getByPlaceholderText("Equipe, sigla ou competição"), "LOUD");
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(screen.getByText("LOUD")).toBeTruthy();
    fireEvent.press(screen.getByTestId("team-link-loud"), { stopPropagation: jest.fn() });
    expect(router.push).toHaveBeenCalledWith("/teams/loud");
    jest.useRealTimers();
  });

  it("links followed teams, match cards, and match detail teams", async () => {
    mockFavoriteTeams = ["loud"];
    renderWithQuery(<Following />);
    fireEvent.press(await screen.findByTestId("team-link-loud"), { stopPropagation: jest.fn() });
    expect(router.push).toHaveBeenCalledWith("/teams/loud");

    const match = {
      id: "match-1", startTime: "2026-08-24T12:00:00Z", game: "Valorant",
      tournament: "Test Cup", time: "12:00", status: "Upcoming", format: "BO3",
      detail: "Match", teamA: { ...team, game: "Valorant", short: "LOUD", color: "#4C8DFF" },
      teamB: { ...opponent, game: "Valorant", short: "FNC", color: "#4C8DFF" },
    } as any;
    fireEvent.press(renderWithQuery(<MatchCard match={match} onPress={jest.fn()} />).getByTestId("team-link-loud"), { stopPropagation: jest.fn() });
    expect(router.push).toHaveBeenCalledWith("/teams/loud");

    mockQueryState["match-details"] = {
      match: { ...match },
      maps: [], playerStats: [], economy: null, veto: null, headToHead: [],
      recentMatches: [], capabilities: { maps: false, playerStats: false, economy: false, veto: false, headToHead: false, recentMatches: false },
    };
    mockRouteParams = { id: "match-1" };
    renderWithQuery(<MatchDetail />);
    fireEvent.press(await screen.findByTestId("team-link-loud"), { stopPropagation: jest.fn() });
    expect(router.push).toHaveBeenCalledWith("/teams/loud");
  });
});