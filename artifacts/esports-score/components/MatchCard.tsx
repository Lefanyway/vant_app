import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { FavoriteStar } from "@/components/FavoriteStar";
import { logoSlot, ResolvedLogo } from "@/components/ResolvedLogo";
import { TeamLink } from "@/components/TeamLink";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";
import { formatLabel, type Match } from "@/lib/data";
import { hasScore, listTeamLabel, matchDayLabel, statusText } from "@/lib/matches";

const singleLine = Platform.OS === "web"
  ? ({ whiteSpace: "nowrap", wordBreak: "keep-all", overflowWrap: "normal" } as object)
  : null;

function LiveDot() {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== "web" }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View style={[styles.liveDot, { backgroundColor: colors.live, opacity }]} />;
}

export function TeamBadge({ name, game, logoUrl, id, size = logoSlot.list.size }: { name: string; short?: string; color?: string; game?: string; logoUrl?: string; id?: string; size?: number }) {
  return <ResolvedLogo type="team" name={name} game={game} logoUrl={logoUrl} entityId={id} size={size} maxWidth={size > logoSlot.list.size ? size : logoSlot.list.maxWidth} />;
}

export function MatchCard({ match, onPress }: { match: Match; onPress: () => void }) {
  const colors = useColors();
  const live = match.status === "Live";
  const scored = hasScore(match);
  const format = formatLabel(match.format);
  const status = live ? "Ao vivo" : match.status === "Upcoming" ? match.time : statusText(match.status);
  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      <Pressable
        testID={`match-${match.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${match.teamA.name} contra ${match.teamB.name}, ${status}`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, { opacity: pressed ? 0.72 : 1 }]}
      >
        <View style={styles.timeColumn}>
          {live ? <LiveDot /> : null}
          <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.25} style={[styles.time, { color: colors.mutedForeground }]}>{match.startTime ? new Date(match.scheduledTime ?? match.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</Text>
          <Text maxFontSizeMultiplier={1.25} style={[styles.subStatus, { color: live ? colors.live : colors.mutedForeground }]}>{match.status === "Upcoming" ? matchDayLabel(match) : status}</Text>
        </View>
        <View style={styles.teams}>
          <TeamLine team={match.teamA} score={scored ? match.scoreA : undefined} emphasize={scored && (match.scoreA ?? 0) > (match.scoreB ?? 0)} live={live} />
          <TeamLine team={match.teamB} score={scored && match.scoreB !== undefined ? match.scoreB : undefined} emphasize={scored && (match.scoreB ?? 0) > (match.scoreA ?? 0)} live={live} />
        </View>
      </Pressable>
      <View style={styles.metaColumn}>
        {format ? <Text maxFontSizeMultiplier={1.2} style={[styles.format, { color: colors.mutedForeground }]}>{format}</Text> : null}
        <FavoriteStar match={match} />
      </View>
    </View>
  );
}

function TeamLine({ team, score, emphasize, live }: { team: Match["teamA"]; score?: number; emphasize: boolean; live: boolean }) {
  const colors = useColors();
  const label = listTeamLabel(team);
  return (
    <View style={styles.teamLine}>
      <TeamLink team={team} fill>
        <View style={styles.identity}>
          <ResolvedLogo type="team" name={team.name} game={team.game} logoUrl={team.logoUrl} entityId={team.id} size={logoSlot.list.size} maxWidth={logoSlot.list.maxWidth} />
          <Text
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            ellipsizeMode="tail"
            accessibilityLabel={team.name}
            style={[styles.name, { color: colors.foreground, fontFamily: font.semibold }, singleLine]}
          >
            {label}
          </Text>
        </View>
      </TeamLink>
      <Text maxFontSizeMultiplier={1.2} style={[styles.score, { color: live ? colors.live : emphasize ? colors.foreground : colors.mutedForeground, fontFamily: font.bold }]}>
        {score === undefined ? "" : score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 88, flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingLeft: 12, paddingRight: 6 },
  main: { flex: 1, minWidth: 0, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 6 },
  timeColumn: { width: 62, minHeight: 44, alignItems: "flex-start", justifyContent: "center", gap: 3 },
  time: { fontVariant: ["tabular-nums"], fontSize: 12, fontFamily: font.bold, lineHeight: 15 },
  subStatus: { fontSize: 10, lineHeight: 14 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  teams: { flex: 1, minWidth: 0, gap: 4 },
  teamLine: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 6 },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 18 },
  score: { width: 22, textAlign: "right", fontSize: 15, fontVariant: ["tabular-nums"] },
  metaColumn: { alignItems: "center", justifyContent: "center" },
  format: { fontSize: 10, fontFamily: font.semibold },
});
