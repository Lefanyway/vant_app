import { router } from "expo-router";
import { fetchMatchDetails } from "@/lib/api";
import type { Match, Team } from "@/lib/data";
import { queryClient } from "@/lib/queryClient";

export function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export function openCompetition(id: string) {
  router.push(`/competitions/${encodeURIComponent(id)}`);
}

export function openTeam(team: Team) {
  queryClient.setQueryData(["team-preview", team.id], team);
  router.push(`/teams/${encodeURIComponent(team.id)}`);
}

export function openMatch(id: string, match?: Match) {
  if (match) {
    queryClient.setQueryData(["match-preview", id], match);
    void queryClient.prefetchQuery({
      queryKey: ["match-details", id],
      queryFn: () => fetchMatchDetails(id),
      staleTime: 60_000,
    });
  }
  router.push(`/match/${encodeURIComponent(id)}`);
}
