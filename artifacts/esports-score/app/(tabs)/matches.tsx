import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Scoreboard } from "@/components/Scoreboard";
import { font } from "@/constants/type";
import { useColors } from "@/hooks/useColors";

export default function Matches() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 4, paddingHorizontal: 12, paddingBottom: 108 + insets.bottom }}>
      <Text style={{ color: colors.foreground, fontFamily: font.bold, fontSize: 22, marginBottom: 6 }}>Partidas</Text>
      <Scoreboard showSearch={false} />
    </View>
  );
}
