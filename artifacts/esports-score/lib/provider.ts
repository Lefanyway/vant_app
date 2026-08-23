import { matches, teams, Match, Team } from "./data";

export interface EsportsDataProvider {
  getLiveMatches(): Match[];
  getUpcomingMatches(): Match[];
  getResults(): Match[];
  getMatchById(id: string): Match | undefined;
  search(query: string): { teams: Team[]; tournaments: string[]; players: string[] };
  getTeam(id: string): Team | undefined;
}

export class MockEsportsDataProvider implements EsportsDataProvider {
  getLiveMatches() { return matches.filter((match) => match.status === "Live"); }
  getUpcomingMatches() { return matches.filter((match) => match.status === "Upcoming"); }
  getResults() { return matches.filter((match) => match.status === "Finished"); }
  getMatchById(id: string) { return matches.find((match) => match.id === id); }
  search(query: string) {
    const normalized = query.trim().toLowerCase();
    const found = teams.filter((team) => team.name.toLowerCase().includes(normalized));
    const tournaments = [...new Set(matches.map((match) => match.tournament))].filter((name) => name.toLowerCase().includes(normalized));
    return { teams: normalized ? found : [], tournaments: normalized ? tournaments : [], players: normalized ? ["qck", "zekken", "Faker"].filter((player) => player.toLowerCase().includes(normalized)) : [] };
  }
  getTeam(id: string) { return teams.find((team) => team.id === id); }
}

export const esportsDataProvider: EsportsDataProvider = new MockEsportsDataProvider();