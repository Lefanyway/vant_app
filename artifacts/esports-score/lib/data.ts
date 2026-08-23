export type Game = "Valorant" | "CS2" | "League of Legends";
export type MatchStatus = "Live" | "Upcoming" | "Finished";
export type Player = { id: string; name: string; role?: string };
export type Tournament = { id: string; name: string; game: Game };
export type Series = { id: string; format: "BO1" | "BO3" | "BO5"; matchId: string };
export type GameMap = { name: string; scoreA?: number; scoreB?: number; status: "scheduled" | "live" | "finished" };
export type PlayerStats = { playerId: string; kills: number; deaths: number; assists: number; rating?: number };
export type Favorite = { entityId: string; entityType: "team" | "tournament" };
export type NotificationPreference = { before30: boolean; before5: boolean; start: boolean; result: boolean; spoilerFree: boolean };

export type Team = {
  id: string;
  name: string;
  short: string;
  color: string;
  game: Game;
};

export type Match = {
  id: string;
  game: Game;
  tournament: string;
  time: string;
  status: MatchStatus;
  teamA: Team;
  teamB: Team;
  scoreA?: number;
  scoreB?: number;
  format: "BO1" | "BO3" | "BO5";
  detail: string;
};

export const teams: Team[] = [
  { id: "loud", name: "LOUD", short: "L", color: "#B7F34B", game: "Valorant" },
  { id: "sentinels", name: "Sentinels", short: "S", color: "#F0445E", game: "Valorant" },
  { id: "g2", name: "G2 Esports", short: "G2", color: "#E5E7EB", game: "Valorant" },
  { id: "fnatic", name: "FNATIC", short: "FNC", color: "#F6A623", game: "Valorant" },
  { id: "furia", name: "FURIA", short: "F", color: "#F2C94C", game: "CS2" },
  { id: "navi", name: "NAVI", short: "N", color: "#F7D447", game: "CS2" },
  { id: "vitality", name: "Vitality", short: "V", color: "#F5C242", game: "CS2" },
  { id: "spirit", name: "Spirit", short: "S", color: "#B9A7FF", game: "CS2" },
  { id: "t1", name: "T1", short: "T1", color: "#E94B5F", game: "League of Legends" },
  { id: "geng", name: "Gen.G", short: "G", color: "#D1A94E", game: "League of Legends" },
  { id: "g2lol", name: "G2 Esports", short: "G2", color: "#E5E7EB", game: "League of Legends" },
  { id: "fnaticlol", name: "Fnatic", short: "FNC", color: "#F6A623", game: "League of Legends" },
];

const team = (id: string) => teams.find((item) => item.id === id)!;

export const matches: Match[] = [
  { id: "valorant-live", game: "Valorant", tournament: "VCT Americas", time: "LIVE", status: "Live", teamA: team("loud"), teamB: team("sentinels"), scoreA: 1, scoreB: 0, format: "BO3", detail: "Map 2 · Haven · Round 15" },
  { id: "cs-live", game: "CS2", tournament: "BLAST Premier", time: "LIVE", status: "Live", teamA: team("furia"), teamB: team("navi"), scoreA: 10, scoreB: 8, format: "BO3", detail: "Mirage · Round 19" },
  { id: "cs-upcoming", game: "CS2", tournament: "BLAST Premier", time: "18:00", status: "Upcoming", teamA: team("furia"), teamB: team("navi"), format: "BO3", detail: "Today · in 2h 12m" },
  { id: "lol-upcoming", game: "League of Legends", tournament: "LCK Summer", time: "20:30", status: "Upcoming", teamA: team("t1"), teamB: team("geng"), format: "BO3", detail: "Today · in 4h 42m" },
  { id: "val-upcoming", game: "Valorant", tournament: "VCT EMEA", time: "22:00", status: "Upcoming", teamA: team("g2"), teamB: team("fnatic"), format: "BO3", detail: "Today · in 6h 12m" },
  { id: "lol-finished", game: "League of Legends", tournament: "LEC Summer", time: "16:10", status: "Finished", teamA: team("g2lol"), teamB: team("fnaticlol"), scoreA: 2, scoreB: 1, format: "BO3", detail: "Final result" },
];

export const players = [
  ["qck", "qck", "Jett", "246", "18", "12", "4"],
  ["tuyz", "tuyZ", "Omen", "218", "15", "13", "7"],
  ["saadhak", "saadhak", "KAY/O", "194", "12", "14", "9"],
  ["johnqt", "johnqt", "Viper", "187", "11", "15", "8"],
  ["zekken", "zekken", "Raze", "241", "16", "13", "5"],
];