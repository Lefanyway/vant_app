import { Image } from "expo-image";
import { useState } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function PlayerAvatar({ name, imageUrl, size = 44 }: { name: string; imageUrl?: string; size?: number }) {
  const colors = useColors();
  const [failedUrl, setFailedUrl] = useState<string>();
  const [loadedUrl, setLoadedUrl] = useState<string>();
  const available = imageUrl && imageUrl !== failedUrl;
  return <View accessibilityLabel={`Foto de ${name}${available ? "" : " indisponível"}`} style={{ width: size, height: size, flexShrink: 0, borderRadius: 10, overflow: "hidden", backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" }}>
    {(!available || loadedUrl !== imageUrl) ? <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground }}>{name.slice(0, 2).toUpperCase()}</Text> : null}
    {available ? <Image source={{ uri: imageUrl }} recyclingKey={imageUrl} contentFit="cover" contentPosition="top center" cachePolicy="memory-disk" transition={0} onLoad={() => setLoadedUrl(imageUrl)} onError={() => setFailedUrl(imageUrl)} style={{ position: "absolute", width: size, height: size }} /> : null}
  </View>;
}
