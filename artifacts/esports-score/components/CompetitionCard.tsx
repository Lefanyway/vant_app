import { Ionicons } from "@expo/vector-icons";
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { AccessibilityInfo, LayoutAnimation, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { MatchCard } from "@/components/MatchCard";
import { logoSlot, ResolvedLogo } from "@/components/ResolvedLogo";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";
import type { Match } from "@/lib/data";
import { useApp } from "@/context/AppContext";

export function CompetitionCard({ name, stage, logoUrl, matches, onMatchPress, onOpen }: { name: string; stage?: string; game?: string; logoUrl?: string; matches: Match[]; onMatchPress: (match: Match) => void; onOpen?: () => void }) {
  const colors = useColors();
  const { favoriteCompetitions = [], toggleCompetition } = useApp();
  const id = matches[0]?.competitionId;
  const saved = id ? favoriteCompetitions.includes(id) : false;
  const subtitle = stage || matches[0]?.stage || "Valorant";
  const [open, setOpen] = useState(true);
  const toggle = () => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!reduce && Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }).catch(() => undefined);
    setOpen((current) => !current);
  };
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole={onOpen ? "link" : "button"} accessibilityState={onOpen ? undefined : { expanded: open }} accessibilityLabel={onOpen ? `Abrir ${name}` : `${open ? "Recolher" : "Expandir"} ${name}`} onPress={onOpen || toggle} style={styles.headerMain}>
          <ResolvedLogo type="competition" name={name} logoUrl={logoUrl ?? matches[0]?.competitionLogoUrl} entityId={matches[0]?.competitionId} size={36} maxWidth={48} />
          <View style={styles.copy}>
            <Text maxFontSizeMultiplier={1.3} numberOfLines={2} style={[styles.name, { color: colors.foreground, fontFamily: font.bold }]}>{name}</Text>
            <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={[styles.stage, { color: colors.mutedForeground, fontFamily: font.medium }]}>{subtitle}</Text>
          </View>
          {!onOpen ? <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} /> : null}
        </Pressable>
        {id && !id.startsWith("unknown:") ? <Pressable accessibilityRole="button" accessibilityLabel={`${saved ? "Desfavoritar" : "Favoritar"} ${name}`} accessibilityState={{ selected: saved }} onPress={() => toggleCompetition?.(id)} style={styles.open}><Ionicons name={saved ? "star" : "star-outline"} size={21} color={saved ? colors.primary : colors.mutedForeground} /></Pressable> : null}
      </View>
      {open ? matches.map((match) => <MatchCard key={match.id} match={match} onPress={() => onMatchPress(match)} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, marginBottom: 16, paddingBottom: 8, overflow: "hidden" },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 6 },
  headerMain: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, lineHeight: 18 },
  stage: { fontSize: 12, marginTop: 1 },
  open: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
