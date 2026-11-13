import type { Match } from "@/lib/data";

export type MatchGroup = { id?: string; name: string; stage?: string; logoUrl?: string; matches: Match[] };

export function groupMatches(matches: Match[]): MatchGroup[] {
  const groups: MatchGroup[] = [];
  for (const match of matches) {
    const id = match.competitionId;
    const name = match.competitionName || match.tournament;
    const existing = groups.find((group) => id ? group.id === id : !group.id && group.name === name);
    if (existing) existing.matches.push(match);
    else groups.push({ id, name, stage: match.stage, logoUrl: match.competitionLogoUrl, matches: [match] });
  }
  return groups;
}

// Long names fall back to the official acronym (TLG, ALG, QXG) where space is tight.
export function listTeamLabel(team: { name: string; short?: string }, max = 22) {
  const name = team.name.trim();
  if (name.length <= max) return name;
  const short = team.short?.trim();
  if (short && short.length >= 2 && short.length <= 10) return short;
  return name;
}

export function statusText(status: Match["status"]) {
  if (status === "Live") return "Ao vivo";
  if (status === "Finished") return "Encerrado";
  if (status === "Cancelled") return "Cancelado";
  if (status === "Postponed") return "Adiado";
  return "Agendada";
}

// Lists mix several days (competition, favorites), so an upcoming match carries its day next to the time.
export function matchDayLabel(match: Match, now = new Date()) {
  const iso = match.scheduledTime ?? match.startTime;
  if (!iso) return "A definir";
  const date = new Date(iso);
  const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((dayStart(date) - dayStart(now)) / 86_400_000);
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

export function hasScore(match: Match) {
  if (typeof match.scoreA !== "number" || typeof match.scoreB !== "number") return false;
  if (match.status === "Live") return true;
  return match.status === "Finished" && !(match.scoreA === 0 && match.scoreB === 0);
}
