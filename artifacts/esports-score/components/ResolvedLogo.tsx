import { Image } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AssetEntityType, resolveEsportsAsset } from "@/lib/assetResolver";
import { MissingLogo } from "@/components/MissingLogo";

export function ResolvedLogo({ type, name, size = 32, game, logoUrl }: { type: AssetEntityType; name: string; size?: number; game?: string; logoUrl?: string }) {
  const colors = useColors();
  const asset = logoUrl ? null : resolveEsportsAsset({ type, name, game });
  const source = logoUrl ? { uri: logoUrl } : asset?.logoSource ?? (asset?.logoUrl ? { uri: asset.logoUrl } : undefined);
  if (!source) return <MissingLogo size={size} />;
  return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={`${name} logo`} onError={() => { if (__DEV__) console.warn(`Error loading esports asset: ${name}`); }} />;
}