import { Feather } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { Match } from "@/lib/data";
import { useColors } from "@/hooks/useColors";

type Stream = NonNullable<Match["streams"]>[number];

const platforms = {
  twitch: { label: "Twitch", color: "#9146FF", icon: "twitch" },
  youtube: { label: "YouTube", color: "#FF0000", icon: "youtube" },
  kick: { label: "Kick", color: "#53FC18", icon: null },
  other: { label: "Transmissão", color: "#282E34", icon: "tv" },
} as const;

const languages: Record<string, string> = { pt: "Português", en: "Inglês", es: "Espanhol", fr: "Francês", de: "Alemão", it: "Italiano", ru: "Russo", tr: "Turco", ar: "Árabe", ja: "Japonês", ko: "Coreano", zh: "Chinês", th: "Tailandês", vi: "Vietnamita", id: "Indonésio", pl: "Polonês" };

export function describeStream(stream: Stream) {
  // A regex instead of URL: React Native's URL may lack hostname/pathname.
  const [, rawHost = "", rawPath = ""] = /^https?:\/\/([^/?#]+)([^?#]*)/i.exec(stream.url) ?? [];
  const host = rawHost.toLowerCase().replace(/^www\./, "");
  const path = rawPath.split("/").filter(Boolean);
  const platform: keyof typeof platforms = host.endsWith("twitch.tv") ? "twitch" : host.endsWith("youtube.com") || host === "youtu.be" ? "youtube" : host.endsWith("kick.com") ? "kick" : "other";
  // Channel pages carry the channel in the path; video links do not, so the platform name stands in.
  const first = path[0] ?? "";
  const channel = platform === "youtube" ? (first.startsWith("@") ? first.slice(1) : ["c", "user"].includes(first) && path[1] ? path[1] : platforms.youtube.label) : first && first !== "videos" ? first : platforms[platform].label;
  const language = stream.language ? languages[stream.language.toLowerCase().slice(0, 2)] ?? stream.language.toUpperCase() : null;
  return { platform, channel, language };
}

// Portuguese first, then official broadcasts.
const rank = (stream: Stream) => (stream.language?.toLowerCase().startsWith("pt") ? 0 : 2) + (stream.official ? 0 : 1);

export function WatchOptions({ streams }: { streams: Stream[] }) {
  const colors = useColors();
  const sorted = [...streams].sort((a, b) => rank(a) - rank(b));
  return <View>
    <Text style={[styles.title, { color: colors.mutedForeground }]}>Onde assistir</Text>
    <View style={[styles.panel, { backgroundColor: colors.card }]}>
      {sorted.map((stream, index) => {
        const { platform, channel, language } = describeStream(stream);
        const brand = platforms[platform];
        return <Pressable key={stream.url} accessibilityRole="link" accessibilityLabel={`Assistir em ${channel}, ${brand.label}`} onPress={() => void Linking.openURL(stream.url)} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View style={[styles.logo, { backgroundColor: brand.color }]}>{brand.icon ? <Feather name={brand.icon} size={17} color="#FFFFFF" /> : <Text style={styles.kick}>K</Text>}</View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={[styles.channel, { color: colors.foreground }]}>{channel}</Text>
            <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>{[brand.label !== channel ? brand.label : null, language, stream.official ? "oficial" : null].filter(Boolean).join(" · ")}</Text>
          </View>
          <Feather name="external-link" size={16} color={colors.mutedForeground} />
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: "600", marginTop: 24, marginBottom: 9 },
  panel: { borderRadius: 22, paddingHorizontal: 14 },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  kick: { color: "#081018", fontSize: 16, fontWeight: "900" },
  copy: { flex: 1, minWidth: 0 },
  channel: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 12, marginTop: 2 },
});
