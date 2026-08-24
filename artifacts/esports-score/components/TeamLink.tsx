import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import type { Team } from "@/lib/data";
import { ResolvedLogo } from "@/components/ResolvedLogo";

export function TeamLink({ team, children, compact = false }: { team: Team; children?: ReactNode; compact?: boolean }) {
  return (
    <Pressable
      testID={`team-link-${team.id}`}
      accessibilityRole="link"
      accessibilityLabel={`Open ${team.name}`}
      onPress={(event) => {
        event.stopPropagation();
        router.push(`/teams/${encodeURIComponent(team.id)}`);
      }}
      style={({ pressed }) => [styles.link, compact && styles.compact, { opacity: pressed ? 0.7 : 1 }]}
    >
      {children ?? <View style={styles.default}><ResolvedLogo type="team" name={team.name} game={team.game} logoUrl={team.logoUrl} size={32} /></View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: "center", justifyContent: "center" },
  compact: { flexDirection: "row", width: "100%", alignItems: "stretch" },
  default: { alignItems: "center", justifyContent: "center" },
});