import { useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { SlideInLeft, SlideInRight } from "react-native-reanimated";

// Swiping sideways moves to the next or previous tab; vertical drags are left to the scroll view.
// `entering` slides the new tab in from the side it came from.
export function useSwipeTabs<T extends string>(tabs: readonly T[], selected: T, onChange: (tab: T) => void) {
  const index = tabs.indexOf(selected);
  const [last, setLast] = useState(index);
  const [direction, setDirection] = useState(1);
  if (index !== last) { setDirection(index > last ? 1 : -1); setLast(index); }
  const go = (step: number) => { const next = tabs[index + step]; if (next) onChange(next); };
  const gesture = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-14, 14],
    runOnJS: true,
    onDeactivate: (event) => {
      if (event.canceled) return;
      if (event.translationX < -60) go(1);
      else if (event.translationX > 60) go(-1);
    },
  });
  return { gesture, entering: (direction > 0 ? SlideInRight : SlideInLeft).duration(220) };
}

export function SwipeTabs<T extends string>({ tabs, selected, onChange, children, style }: { tabs: readonly T[]; selected: T; onChange: (tab: T) => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { gesture, entering } = useSwipeTabs(tabs, selected, onChange);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View key={selected} entering={entering} style={[{ flex: 1 }, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}
