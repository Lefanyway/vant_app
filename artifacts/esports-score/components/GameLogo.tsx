import { SvgXml } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

type GameLogoProps = { game: "valorant" | "cs2" | "lol"; active?: boolean; size?: number };

const logos = {
  valorant: (color: string) => `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6h7.2l4.4 7.7L23 6H28L16.4 26h-5.1l4.7-8.1L7 6Z" fill="${color}"/><path d="M8 26h6.1l2.3-4H10.3L8 26Z" fill="${color}" opacity=".7"/></svg>`,
  cs2: (color: string) => `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="8.2" stroke="${color}" stroke-width="1.5"/><path d="M16 4v6M16 22v6M4 16h6M22 16h6M10.7 10.7l4 4M21.3 21.3l-4-4M21.3 10.7l-4 4M10.7 21.3l4-4" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="16" r="2.2" fill="${color}"/></svg>`,
  lol: (color: string) => `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 4.5 25 8v7.2c0 5.2-3.7 9.7-9 12.3-5.3-2.6-9-7.1-9-12.3V8l9-3.5Z" stroke="${color}" stroke-width="1.5"/><path d="M11 20.5h4.1V12h2v10.1H11v-1.6Z" fill="${color}"/><path d="M18.8 12h2.1v10h-2.1V12Z" fill="${color}" opacity=".65"/></svg>`,
};

export function GameLogo({ game, active = false, size = 32 }: GameLogoProps) {
  const colors = useColors();
  const color = active ? colors.primary : colors.mutedForeground;
  return <SvgXml xml={logos[game](color)} width={size} height={size} />;
}