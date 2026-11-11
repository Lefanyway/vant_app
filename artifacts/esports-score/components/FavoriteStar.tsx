import { Ionicons } from "@expo/vector-icons";
import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, Pressable } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import type { Match } from "@/lib/data";

export function FavoriteStar({ match }: { match: Match }) {
  const colors = useColors();
  const { favoriteMatches, pinMatch } = useApp();
  const saved = (favoriteMatches ?? []).includes(match.id);
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remover ${match.teamA.name} contra ${match.teamB.name} dos favoritos` : `Favoritar ${match.teamA.name} contra ${match.teamB.name}`}
      accessibilityState={{ selected: saved }}
      hitSlop={4}
      onPress={() => {
        pinMatch?.(match);
        if (reduceMotion) return;
        scale.setValue(0.86);
        Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== "web", speed: 28, bounciness: 6 }).start();
      }}
      style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={saved ? "star" : "star-outline"} size={20} color={saved ? colors.primary : colors.mutedForeground} />
      </Animated.View>
    </Pressable>
  );
}
