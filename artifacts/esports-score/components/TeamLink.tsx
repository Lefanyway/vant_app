import { Pressable, StyleSheet, View } from "react-native";
import type { ReactNode } from "react";
import { ResolvedLogo } from "@/components/ResolvedLogo";
import type { Team } from "@/lib/data";
import { openTeam } from "@/lib/navigation";

export function TeamLink({ team, children, compact = false, fill = false }: { team: Team; children?: ReactNode; compact?: boolean; fill?: boolean }) {
  return (
    <Pressable
      testID={`team-link-${team.id}`}
      accessibilityRole="link"
      accessibilityLabel={`Abrir ${team.name}`}
      onPress={(event) => {
        event.stopPropagation();
        openTeam(team);
      }}
      style={({ pressed }) => [styles.link, compact && styles.compact, fill && styles.fill, { opacity: pressed ? 0.7 : 1 }]}
    >
      {children ?? <View style={styles.default}><ResolvedLogo type="team" name={team.name} game={team.game} logoUrl={team.logoUrl} size={32} /></View>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: "center", justifyContent: "center" },
  compact: { flexDirection: "row", width: "100%", alignItems: "stretch" },
  fill: { flex: 1, minWidth: 0, alignItems: "stretch" },
  default: { alignItems: "center", justifyContent: "center" },
});