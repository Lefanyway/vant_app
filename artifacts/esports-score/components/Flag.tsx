import { Image } from "expo-image";
import { View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { flags } from "@/lib/flags";

// Countries arrive as ISO codes ("BR"). The flags ship with the app, so they show offline and all share one 4:3 shape.
const aliases: Record<string, string> = { uk: "gb", en: "gb-eng" };

export function Flag({ code, width = 24 }: { code?: string | null; width?: number }) {
  const colors = useColors();
  const key = code?.trim().toLowerCase() ?? "";
  const source = flags[aliases[key] ?? key];
  const shape = { width, height: Math.round(width * 0.75), borderRadius: 3 };
  // Unknown country: an empty slot of the same size keeps the rows aligned.
  if (!source) return <View accessibilityLabel="País não informado" style={[shape, { backgroundColor: colors.secondary }]} />;
  return <Image source={source} contentFit="cover" accessibilityLabel={key.toUpperCase()} style={shape} />;
}
