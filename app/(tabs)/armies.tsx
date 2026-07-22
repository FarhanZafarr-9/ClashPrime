import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { ArmyCard } from '../../src/components/ArmyCard';
import { EmptyState } from '../../src/components/EmptyState';
import type { ClashArmy, UnitDef } from '../../src/types/armies';
import { getPopularArmies } from '../../src/api/clashArmies';
import { ArmiesScreenSkeleton } from '../../src/components/SkeletonScreens';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_ARMIES_KEY = 'clashprime_saved_armies';
const ARMY_FAVORITES_KEY = 'clashprime_army_favorites';

interface SavedArmy {
  id: string;
  name: string;
  townHallLevel: number;
  username: string;
  score: number;
  copiedAt: string;
}

async function getSavedArmies(): Promise<SavedArmy[]> {
  const raw = await AsyncStorage.getItem(SAVED_ARMIES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function saveArmy(army: SavedArmy): Promise<void> {
  const list = await getSavedArmies();
  const existing = list.findIndex((b) => b.id === army.id);
  if (existing >= 0) list[existing] = army;
  else list.unshift(army);
  await AsyncStorage.setItem(SAVED_ARMIES_KEY, JSON.stringify(list));
}

async function removeSavedArmy(id: string): Promise<void> {
  const list = await getSavedArmies();
  await AsyncStorage.setItem(SAVED_ARMIES_KEY, JSON.stringify(list.filter((b) => b.id !== id)));
}

async function getArmyFavorites(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(ARMY_FAVORITES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function toggleArmyFavorite(id: string): Promise<boolean> {
  const favs = await getArmyFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) { favs.splice(idx, 1); await AsyncStorage.setItem(ARMY_FAVORITES_KEY, JSON.stringify(favs)); return false; }
  else { favs.push(id); await AsyncStorage.setItem(ARMY_FAVORITES_KEY, JSON.stringify(favs)); return true; }
}

export default function ArmiesScreen() {
  const { player } = usePlayer();
  const [armies, setArmies] = useState<ClashArmy[]>([]);
  const [unitsById, setUnitsById] = useState<Map<number, UnitDef>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedArmies, setSavedArmies] = useState<SavedArmy[]>([]);
  const [armyFavorites, setArmyFavorites] = useState<Set<string>>(new Set());

  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;

  const thLevel = player?.townHallLevel || 16;

  const fetchArmies = useCallback(async (bypass?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const { armies: list, unitsById: defs } = await getPopularArmies(bypass);
      setArmies(list);
      if (defs.size > 0) setUnitsById(defs);
    } catch (e: any) {
      setError(e.message || 'Failed to load armies');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSavedData = useCallback(async () => {
    const [sArmies, aFavs] = await Promise.all([
      getSavedArmies(),
      getArmyFavorites(),
    ]);
    setSavedArmies(sArmies);
    setArmyFavorites(new Set(aFavs));
  }, []);

  useEffect(() => {
    fetchArmies();
    loadSavedData();
  }, [fetchArmies, loadSavedData]);

  const handleArmyFavorite = async (id: number) => {
    const key = String(id);
    const isFav = armyFavorites.has(key);
    const newFavs = new Set(armyFavorites);
    if (isFav) newFavs.delete(key);
    else newFavs.add(key);
    setArmyFavorites(newFavs);
    await toggleArmyFavorite(key);
  };

  const handleSaveArmy = async (army: ClashArmy) => {
    const id = String(army.id);
    const existing = savedArmies.find((s) => s.id === id);
    if (existing) {
      await removeSavedArmy(id);
    } else {
      await saveArmy({
        id,
        name: army.name,
        townHallLevel: army.townHall,
        username: army.username,
        score: army.score,
        copiedAt: new Date().toISOString(),
      });
    }
    loadSavedData();
  };

  const handleCopyArmy = (army: ClashArmy) => {
    const troopEntries = army.units.map((u) => {
      const def = unitsById.get(u.unitId);
      if (!def) return null;
      return { name: def.name, level: 1, maxLevel: 1, count: u.amount };
    }).filter(Boolean) as { name: string; level: number; maxLevel: number; count: number }[];
    if (troopEntries.length > 0) {
      const encoded = btoa(JSON.stringify(troopEntries));
      Linking.openURL(`https://link.clashofclans.com/en?action=CopyArmy&army=${encoded}`);
    }
  };

  React.useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, []);

  const currentArmies = armies.filter((a) => a.townHall === thLevel);
  const visibleArmies = currentArmies.slice(0, displayCount);
  const hasMore = displayCount < currentArmies.length;

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 200 && hasMore) {
      setDisplayCount((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Army Library</Text>
          {loading ? null : <Text style={styles.subtitle}>Community armies from ClashArmies</Text>}
        </View>
        <Pressable onPress={() => fetchArmies(true)} hitSlop={12} style={styles.refreshBtn}>
          <Ionicons name="refresh-circle-outline" size={28} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Content */}
      {loading ? (
        <ArmiesScreenSkeleton />
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="cloud-offline-outline" size={36} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => fetchArmies(true)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.countBar}>
            <Text style={styles.countText}>
              {currentArmies.length} arm{currentArmies.length !== 1 ? 'ies' : 'y'}
              {currentArmies.length > PAGE_SIZE && ` · showing ${Math.min(displayCount, currentArmies.length)}`}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            {currentArmies.length === 0 ? (
              <EmptyState
                icon={'⚔️'}
                title={'No armies found'}
                description={'No armies available right now. Pull down to refresh.'}
              />
            ) : (
              visibleArmies.map((army) => {
                const isFav = armyFavorites.has(String(army.id));
                const isSavedArmy = savedArmies.some((s) => s.id === String(army.id));
                return (
                  <ArmyCard
                    key={army.id}
                    army={army}
                    unitsById={unitsById}
                    isFavorite={isFav}
                    isSaved={isSavedArmy}
                    onFavorite={() => handleArmyFavorite(army.id)}
                    onSave={() => handleSaveArmy(army)}
                    onCopy={() => handleCopyArmy(army)}
                    onPress={() => {
                      if (army.guide?.youtubeUrl) {
                        Linking.openURL(army.guide.youtubeUrl);
                      }
                    }}
                  />
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexShrink: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  refreshBtn: {
    padding: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingBottom: 80,
  },
  errorText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    maxWidth: 260,
  },
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.full,
  },
  retryText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  countBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  countText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  filterSection: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  filterLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    paddingHorizontal: Spacing.xs,
  },
  filterPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  filterPillText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: Colors.bg,
  },
  list: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  itemMeta: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
