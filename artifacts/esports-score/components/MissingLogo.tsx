import { SvgXml } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

const missingLogo = (color: string) => `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="7" width="16" height="18" rx="2" stroke="${color}" stroke-width="1.5"/><path d="M12 12h8M12 16h8M12 20h5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity=".65"/></svg>`;

export function MissingLogo({ size = 32 }: { size?: number }) {
  const colors = useColors();
  return <SvgXml xml={missingLogo(colors.mutedForeground)} width={size} height={size} accessibilityLabel="Logo indisponível" />;
}