import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../theme';
import PressableRipple from './PressableRipple';
import { Skeleton } from './Skeleton';
import { usePlayer } from '../hooks/usePlayerContext';

type IconDef = { set: 'ion' | 'mc'; name: string };

const MAIN_TABS: { key: string; icon: IconDef }[] = [
  { key: 'index', icon: { set: 'ion', name: 'home' } },
  { key: 'army', icon: { set: 'mc', name: 'sword-cross' } },
  { key: 'buildings', icon: { set: 'mc', name: 'castle' } },
  { key: 'bases', icon: { set: 'ion', name: 'grid' } },
  { key: 'events', icon: { set: 'ion', name: 'calendar-outline' } },
  { key: 'settings', icon: { set: 'ion', name: 'settings-sharp' } },
];

const EXTRA_TABS: { key: string; icon: IconDef }[] = [
  { key: 'armies', icon: { set: 'ion', name: 'shield-half-outline' } },
  { key: 'achievements', icon: { set: 'ion', name: 'trophy-outline' } },
  { key: 'war', icon: { set: 'ion', name: 'flag-outline' } },
  { key: 'saved', icon: { set: 'ion', name: 'bookmarks-outline' } },
];

function TabIcon({ icon, color, size }: { icon: IconDef; color: string; size?: number }) {
  const s = size ?? 18;
  return icon.set === 'mc' ? (
    <MaterialCommunityIcons name={icon.name as any} size={s} color={color} />
  ) : (
    <Ionicons name={icon.name as any} size={s} color={color} />
  );
}

export default function FloatingTabBar({ state, navigation }: any) {
  const { player, loading } = usePlayer();
  const activeKey = state.routeNames[state.index];
  const [showExtras, setShowExtras] = useState(false);

  // The home tab's data is still loading; show skeleton placeholders instead of
  // a real nav bar so it doesn't look half-broken while the screen shimmers.
  const skeletons = activeKey === 'index' && loading && !player;

  useEffect(() => {
    const onExtra = EXTRA_TABS.some((t) => t.key === activeKey);
    setShowExtras(onExtra);
  }, [activeKey]);

  const navigate = (key: string) => {
    const route = state.routes.find((r: any) => r.key === key || r.name === key);
    if (route) {
      navigation.navigate(route.name);
    }
  };

  const visibleTabs = showExtras ? EXTRA_TABS : MAIN_TABS;

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {skeletons ? (
          <>
            {MAIN_TABS.map((tab) => (
              <View key={tab.key} style={[styles.tabItem, styles.tabItemSkeleton]}>
                <Skeleton width={22} height={22} borderRadius={8} />
              </View>
            ))}
            <View style={[styles.tabItem, styles.tabItemSkeleton]}>
              <Skeleton width={22} height={22} borderRadius={8} />
            </View>
          </>
        ) : (
        <>
        {visibleTabs.map((tab) => {
          const isActive = activeKey === tab.key;
          return (
            <PressableRipple
              key={tab.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => navigate(tab.key)}
            >
              <TabIcon icon={tab.icon} color={isActive ? Colors.textPrimary : Colors.textMuted} />
            </PressableRipple>
          );
        })}
        <PressableRipple style={styles.tabItem} onPress={() => setShowExtras((v) => !v)}>
          <Ionicons
            name={showExtras ? 'chevron-back' : 'chevron-forward'}
            size={18}
            color={Colors.textSecondary}
          />
        </PressableRipple>
        </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: Spacing.base,
    pointerEvents: 'box-none',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.bgElevated,
    borderRadius: 8,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: 4,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    minWidth: 40,
    height: 46,
    borderRadius: 8,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: Colors.accentSubtle,
  },
  tabItemSkeleton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
