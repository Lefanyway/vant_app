import { Feather } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';
import { router } from 'expo-router';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '@/context/NotificationsContext';
import { useColors } from '@/hooks/useColors';

const valorantMark = require('../assets/generated/games/valorant-mark.png');

export function MobileHeader({ title = 'Buscar no VANT', children }: { title?: string; children?: React.ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { unread } = useNotifications();
  return <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.secondary }]}>
    <View style={styles.top}>
      <View style={styles.icon}><Image source={valorantMark} resizeMode="contain" accessibilityLabel="Valorant" style={styles.mark} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Buscar equipes e competições" onPress={() => router.navigate('/search')} style={[styles.search, { backgroundColor: colors.card }]}>
        <Feather name="search" size={22} color={colors.foreground} /><Text style={[styles.placeholder, { color: colors.mutedForeground }]} numberOfLines={1}>{title}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Notificações, ${unread} novas` : 'Notificações'} onPress={() => router.push('/notifications')} style={styles.bell}>
        <Feather name="bell" size={21} color={colors.foreground} />
        {unread ? <View style={[styles.badge, { backgroundColor: colors.primary }]}><Text style={[styles.badgeText, { color: colors.primaryForeground }]}>{unread > 9 ? '9+' : unread}</Text></View> : null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Perfil" onPress={() => router.push('/profile')} style={styles.bell}><Feather name="user" size={22} color={colors.foreground} /></Pressable>
    </View>
    {children}
  </View>;
}

export function ScreenTabs<T extends string>({ items, selected, onChange }: { items: { key: T; label: string }[]; selected: T; onChange: (key: T) => void }) {
  const colors = useColors();
  return <View style={styles.tabs}>{items.map(item => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: selected === item.key }} onPress={() => onChange(item.key)} style={[styles.tab, { borderBottomColor: selected === item.key ? colors.foreground : 'transparent' }]}><Text style={[styles.tabText, { color: selected === item.key ? colors.foreground : colors.mutedForeground }]}>{item.label}</Text></Pressable>)}</View>;
}

export function EmptyState({ title, description, onRetry }: { title: string; description?: string; onRetry?: () => void }) {
  const colors = useColors();
  return <View style={styles.empty}><Feather name={onRetry ? 'wifi-off' : 'calendar'} size={28} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>{description ? <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>{description}</Text> : null}{onRetry ? <Pressable onPress={onRetry} style={[styles.retry, { backgroundColor: colors.accent }]}><Text style={{ color: colors.primary, fontWeight: '600' }}>Tentar novamente</Text></Pressable> : null}</View>;
}

// Every loading placeholder pulses the same way, so a slow network never looks frozen.
export function Pulse({ label = 'Carregando', children }: { label?: string; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const native = Platform.OS !== 'web';
    const loop = Animated.loop(Animated.sequence([Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: native }), Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: native })]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View accessibilityLabel={label} style={{ opacity }}>{children}</Animated.View>;
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  const colors = useColors();
  return <Pulse>{Array.from({ length: count }, (_, n) => <View key={n} style={[styles.skeleton, { backgroundColor: colors.card }]}><View style={[styles.skeletonTitle, { backgroundColor: colors.secondary }]} />{[0, 1].map(row => <View key={row} style={styles.skeletonRow}><View style={[styles.skeletonLogo, { backgroundColor: colors.secondary }]} /><View style={[styles.skeletonLine, { backgroundColor: colors.secondary }]} /></View>)}</View>)}</Pulse>;
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 12 }, top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10 },
  search: { flex: 1, minWidth: 0, height: 42, borderRadius: 24, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  placeholder: { fontSize: 15, flex: 1 }, mark: { width: 24, height: 24 }, icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bell: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 2, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }, badgeText: { fontSize: 10, fontWeight: '700' },
  tabs: { flexDirection: 'row', marginHorizontal: -12 }, tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3 }, tabText: { fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 12 }, emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' }, emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: 'center' }, retry: { borderRadius: 22, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center', marginTop: 6 },
  skeleton: { padding: 18, borderRadius: 24, marginBottom: 12 }, skeletonTitle: { height: 14, width: '58%', borderRadius: 6, marginBottom: 24 }, skeletonRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 }, skeletonLogo: { width: 28, height: 28, borderRadius: 8 }, skeletonLine: { height: 13, width: '65%', borderRadius: 5 },
});
