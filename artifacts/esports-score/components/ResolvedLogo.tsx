import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AssetEntityType, resolveEsportsAsset } from "@/lib/assetResolver";

export const logoSlot = {
  list: { size: 28, maxWidth: 28 },
  header: { size: 36, maxWidth: 36 },
  profile: { size: 72, maxWidth: 72 },
} as const;

function initials(name: string) {
  if (/^(tbd|team|unknown)$/i.test(name.trim())) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function ResolvedLogo({ type, name, size = 28, maxWidth: _maxWidth, game, logoUrl, entityId }: { type: AssetEntityType; name: string; size?: number; maxWidth?: number; game?: string; logoUrl?: string; entityId?: string }) {
  const colors = useColors();
  const identity = `${type}:${entityId ?? name}:${logoUrl ?? "local"}`;
  const [loadedIdentity, setLoadedIdentity] = useState("");
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [localFailed, setLocalFailed] = useState(false);
  useEffect(() => { setRemoteFailed(false); setLocalFailed(false); }, [logoUrl, name, type, entityId]);
  const asset = resolveEsportsAsset({ type, name, game, entityId });
  const localSource = !localFailed ? asset?.logoSource : undefined;
  const source = localSource || (logoUrl && !remoteFailed ? { uri: logoUrl } : undefined);
  // Reserve one square column before loading: wordmarks never move the names.
  // One neutral plate keeps black, white and colored marks readable.
  const plate = type === "team" || type === "competition";
  const inset = Math.max(3, Math.round(size * .12));
  return (
    <View accessibilityLabel={!source ? `Logo de ${name} indisponível` : undefined} style={{ width: size, height: size, flexShrink: 0, borderRadius: Math.round(size * .2), overflow: "hidden", backgroundColor: plate ? "#65717D" : colors.secondary, alignItems: "center", justifyContent: "center" }}>
      {source && loadedIdentity !== identity ? <Text style={{ position: "absolute", color: "#FFFFFF", fontSize: Math.max(10, size * .3), fontWeight: "600" }}>{initials(name)}</Text> : null}
      {source ? <Image source={source} contentFit="contain" transition={0} onLoad={() => setLoadedIdentity(identity)} cachePolicy="memory-disk" recyclingKey={entityId ?? `${type}:${name}`} accessibilityLabel={`Logo de ${name}`} style={{ width: size - inset * 2, height: size - inset * 2 }} onError={() => { if (localSource) setLocalFailed(true); else setRemoteFailed(true); }} /> : <Text maxFontSizeMultiplier={1.2} style={{ color: colors.mutedForeground, fontSize: Math.max(10, Math.round(size * .3)), fontWeight: "700" }}>{initials(name)}</Text>}
    </View>
  );
}
