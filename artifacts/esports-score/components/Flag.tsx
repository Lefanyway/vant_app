import { Image } from "expo-image";
import { Text } from "react-native";
import { useColors } from "@/hooks/useColors";

// Countries arrive as ISO codes ("BR"); flagcdn serves each flag as an SVG, which draws the same on every platform.
export function Flag({ code, width = 24 }: { code: string; width?: number }) {
  const colors = useColors();
  if (!/^[a-z]{2}$/i.test(code)) return <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{code}</Text>;
  return <Image source={{ uri: `https://flagcdn.com/${code.toLowerCase()}.svg` }} contentFit="cover" accessibilityLabel={code.toUpperCase()} style={{ width, height: Math.round(width * 0.75), borderRadius: 3 }} />;
}
