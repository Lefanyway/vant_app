import { Image } from "react-native";
import { useColors } from "@/hooks/useColors";
import { AssetEntityType, resolveEsportsAsset } from "@/lib/assetResolver";
import { MissingLogo } from "@/components/MissingLogo";

export function ResolvedLogo({ type, name, size = 32, game }: { type: AssetEntityType; name: string; size?: number; game?: string }) {
  const colors = useColors();
  const asset = resolveEsportsAsset({ type, name, game });
  if (asset.status !== "resolved" || (!asset.logoUrl && !asset.logoSource)) return <MissingLogo size={size} />;
  return <Image source={asset.logoSource ?? { uri: asset.logoUrl }} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel={`${name} logo`} onError={() => { if (__DEV__) console.warn(`Error loading esports asset: ${name}`); }} />;
}