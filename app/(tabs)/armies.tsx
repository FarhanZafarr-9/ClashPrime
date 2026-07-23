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
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { ArmyCard } from '../../src/components/ArmyCard';
import { EmptyState } from '../../src/components/EmptyState';
import { Skeleton } from '../../src/components/Skeleton';
import type { ClashArmy, UnitDef, EquipmentDef, PetDef } from '../../src/types/armies';
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

const ARMY_TAG_PILLS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'All', label: 'All', icon: 'apps-outline' },
  { key: 'CWL/War', label: 'CWL/War', icon: 'shield-outline' },
  { key: 'Legends League', label: 'Legends', icon: 'trophy-outline' },
  { key: 'Farming', label: 'Farming', icon: 'leaf-outline' },
  { key: 'Spam', label: 'Spam', icon: 'flash-outline' },
  { key: 'Beginner Friendly', label: 'Beginner', icon: 'happy-outline' },
];

export default function ArmiesScreen() {
  const { player } = usePlayer();
  const { colors } = useTheme();
  const [armies, setArmies] = useState<ClashArmy[]>([]);
  const [unitsById, setUnitsById] = useState<Map<number, UnitDef>>(new Map());
  const [equipmentById, setEquipmentById] = useState<Map<number, EquipmentDef>>(new Map());
  const [petsById, setPetsById] = useState<Map<number, PetDef>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedArmies, setSavedArmies] = useState<SavedArmy[]>([]);
  const [armyFavorites, setArmyFavorites] = useState<Set<string>>(new Set());

  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;
  const [selectedTag, setSelectedTag] = useState('All');

  const thLevel = player?.townHallLevel || 16;

  const fetchArmies = useCallback(async (bypass?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const { armies: list, unitsById: defs, equipmentById: eqDefs, petsById: pDefs } = await getPopularArmies(bypass);
      setArmies(list);
      if (defs.size > 0) setUnitsById(defs);
      if (eqDefs.size > 0) setEquipmentById(eqDefs);
      if (pDefs.size > 0) setPetsById(pDefs);
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
    const campTroops = army.units.filter((u) => u.home === 'armyCamp' && unitsById.get(u.unitId)?.type !== 'Spell');
    const campSpells = army.units.filter((u) => u.home === 'armyCamp' && unitsById.get(u.unitId)?.type === 'Spell');
    const ccTroops = army.units.filter((u) => u.home === 'clanCastle' && unitsById.get(u.unitId)?.type !== 'Spell');
    const ccSpells = army.units.filter((u) => u.home === 'clanCastle' && unitsById.get(u.unitId)?.type === 'Spell');
    const toStr = (list: typeof army.units) => list.map((u) => {
      const def = unitsById.get(u.unitId);
      return def ? `${u.amount}x${def.clashId}` : null;
    }).filter(Boolean).join('-');
    let link = 'https://link.clashofclans.com/en?action=CopyArmy&army=';
    if (ccTroops.length) link += `i${toStr(ccTroops)}`;
    if (ccSpells.length) link += `d${toStr(ccSpells)}`;
    link += `u${toStr(campTroops)}`;
    link += `s${toStr(campSpells)}`;
    Linking.openURL(link);
  };

  React.useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, []);

  const thArmies = armies.filter((a) => a.townHall === thLevel);
  const currentArmies = selectedTag === 'All'
    ? thArmies
    : thArmies.filter((a) => a.tags.includes(selectedTag));
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

          {/* Tag filter pills */}
          <View style={styles.filterSection}>
            <View style={styles.filterPills}>
              {ARMY_TAG_PILLS.map((pill) => (
                <Pressable
                  key={pill.key}
                  onPress={() => { setSelectedTag(pill.key); setDisplayCount(PAGE_SIZE); }}
                  style={[styles.filterPill, selectedTag === pill.key && styles.filterPillActive]}
                >
                  <Ionicons
                    name={pill.icon}
                    size={13}
                    color={selectedTag === pill.key ? Colors.bg : Colors.textSecondary}
                  />
                  <Text style={[styles.filterPillText, selectedTag === pill.key && styles.filterPillTextActive]}>
                    {pill.label}
                  </Text>
                </Pressable>
              ))}
            </View>
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
                    equipmentById={equipmentById}
                    petsById={petsById}
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
            {currentArmies.length > 0 && hasMore && (
              <View style={{ gap: Spacing.base }}>
                {[0, 1].map((i) => (
                  <View key={i} style={{ borderRadius: 10, borderWidth: 0.75, borderColor: colors.border, backgroundColor: colors.bgCard, padding: Spacing.base, gap: Spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                      <Skeleton width={36} height={36} borderRadius={4} />
                      <View style={{ flex: 1 }}>
                        <Skeleton width="60%" height={16} borderRadius={4} />
                        <Skeleton width="35%" height={10} borderRadius={3} style={{ marginTop: 4 }} />
                      </View>
                      <Skeleton width={14} height={14} borderRadius={7} />
                    </View>
                    <View style={{ flexDirection: 'row', borderWidth: 0.75, borderColor: colors.border, borderRadius: 6, overflow: 'hidden' }}>
                      <View style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 14 }}>
                        <Skeleton width="60%" height={10} borderRadius={3} />
                      </View>
                      <View style={{ width: 1, backgroundColor: colors.border }} />
                      <View style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 14 }}>
                        <Skeleton width="60%" height={10} borderRadius={3} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {currentArmies.length > 0 && !hasMore && (
              <Text style={[styles.endMessage, { color: colors.textTertiary }]}>You've reached the end</Text>
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
    borderWidth: 0.75,
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
    borderWidth: 0.75,
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
  endMessage: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    fontStyle: 'italic',
  },
});
