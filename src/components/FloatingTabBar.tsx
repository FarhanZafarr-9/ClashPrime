import React, { useState, useEffect } from 'react';
import { View, StyleSheet, BackHandler } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Radius } from '../theme';
import PressableRipple from './PressableRipple';
import { Skeleton } from './Skeleton';
import { usePlayer } from '../hooks/usePlayerContext';

type IconDef = { set: 'ion' | 'mc'; name: string };

/** Pages of tabs, in display order. The chevron cycles through these.
 * 'search' is a pseudo-entry: it pushes the /player route instead of switching tabs. */
const TAB_GROUPS: string[][] = [
  ['index', 'army', 'buildings', 'maxtime', 'events'],
  ['hero-journey', 'bases', 'armies', 'war', 'search'],
  ['settings', 'saved', 'achievements'],
];

const TAB_ICONS: Record<string, IconDef> = {
  index: { set: 'ion', name: 'home' },
  army: { set: 'mc', name: 'sword-cross' },
  'hero-journey': { set: 'mc', name: 'shield-crown' },
  buildings: { set: 'mc', name: 'castle' },
  maxtime: { set: 'ion', name: 'analytics-outline' },
  events: { set: 'ion', name: 'calendar-outline' },
  settings: { set: 'ion', name: 'settings-outline' },
  bases: { set: 'ion', name: 'grid' },
  armies: { set: 'ion', name: 'shield-half-outline' },
  war: { set: 'ion', name: 'flag-outline' },
  saved: { set: 'ion', name: 'bookmarks-outline' },
  achievements: { set: 'ion', name: 'trophy-outline' },
  search: { set: 'ion', name: 'search-outline' },
};

function TabIcon({ icon, color, size }: { icon: IconDef; color: string; size?: number }) {
  const s = size ?? 18;
  return icon.set === 'mc' ? (
    <MaterialCommunityIcons name={icon.name as any} size={s} color={color} />
  ) : (
    <Ionicons name={icon.name as any} size={s} color={color} />
  );
}

function groupOf(key: string): number {
  return TAB_GROUPS.findIndex((g) => g.includes(key));
}

export default function FloatingTabBar({ state, navigation }: any) {
  const { player, loading } = usePlayer();
  const router = useRouter();
  const activeKey: string = state.routeNames[state.index];
  const [page, setPage] = useState(() => {
    const g = groupOf(activeKey);
    return g >= 0 ? g : 0;
  });

  // Follow the active tab: deep links / back nav land on the right page.
  useEffect(() => {
    const g = groupOf(activeKey);
    if (g >= 0 && g !== page) setPage(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const parentState = navigation.getParent()?.getState();
      const pushedAboveTabs =
        parentState &&
        Array.isArray(parentState.routes) &&
        parentState.routes.length > 1 &&
        parentState.index === parentState.routes.length - 1;
      if (pushedAboveTabs) {
        navigation.getParent()?.goBack();
        return true;
      }
      if (state.history?.length > 1) {
        navigation.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [state, navigation]);

  // The home tab's data is still loading; show skeleton placeholders instead of
  // a real nav bar so it doesn't look half-broken while the screen shimmers.
  const skeletons = activeKey === 'index' && loading && !player;

  const visibleTabs = TAB_GROUPS[Math.min(page, TAB_GROUPS.length - 1)];

  const navigate = (name: string) => {
    if (name === 'search') {
      router.push('/player');
      return;
    }
    const route = state.routes.find((r: any) => r.name === name);
    if (route) navigation.navigate(route.name);
  };

  const nextPage = () => setPage((p: number) => (p + 1) % TAB_GROUPS.length);

  return (
    <View style={styles.container}>
      {!skeletons && (
        <View style={styles.pagePill}>
          {TAB_GROUPS.map((_, i) => (
            <View key={i} style={[styles.pageDot, i === page && styles.pageDotActive]} />
          ))}
        </View>
      )}
      <View style={styles.bar}>
        {skeletons ? (
          <>
            {visibleTabs.map((tab) => (
              <View key={tab} style={[styles.tabItem, styles.tabItemSkeleton]}>
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
              const isActive = activeKey === tab;
              return (
                <PressableRipple
                  key={tab}
                  style={[styles.tabItem, isActive && styles.tabItemActive]}
                  onPress={() => navigate(tab)}
                >
                  <TabIcon
                    icon={TAB_ICONS[tab] ?? { set: 'ion', name: 'ellipse-outline' }}
                    color={isActive ? Colors.bg : Colors.textMuted}
                  />
                </PressableRipple>
              );
            })}
            <PressableRipple style={styles.tabItemChevron} onPress={nextPage}>
              <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
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
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.md,
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
    borderRadius: Radius.md,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: Colors.textPrimary,
  },
  tabItemSkeleton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemChevron: {
    minWidth: 36,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagePill: {
    position: 'absolute',
    bottom: 82,
    right: 28,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCardHover,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  pageDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    opacity: 0.5,
  },
  pageDotActive: {
    backgroundColor: Colors.textSecondary,
    opacity: 1,
  },
});