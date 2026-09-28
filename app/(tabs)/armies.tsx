import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
  Share,
  Alert,
  Image,
} from 'react-native';
import PressableRipple from '../../src/components/PressableRipple';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { ArmyCard } from '../../src/components/ArmyCard';
import { EmptyState } from '../../src/components/EmptyState';
import { Skeleton } from '../../src/components/Skeleton';
import type { ClashArmy, UnitDef, EquipmentDef, PetDef } from '../../src/types/armies';
import { getPopularArmies } from '../../src/api/clashArmies';
import { getMaxTownHall } from '../../src/utils/buildingData';
import { getArmyItemImage } from '../../src/utils/armyData';
import { buildCopyArmyLink } from '../../src/utils/armyLinks';
import { ArmiesScreenSkeleton } from '../../src/components/SkeletonScreens';
import SharePreviewModal, { useShareCardWidth } from '../../src/components/share/SharePreviewModal';
import ArmyShareCard from '../../src/components/ArmyShareCard';
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

const PILL_COLUMNS = 3;

/**
 * Seamless-grid corner rounding, matching the Buildings category pills and the
 * Army tab chips: the pills read as one rounded block, so only the four outermost
 * corners take the large radius and the interior seams stay at Radius.sm.
 *
 * Derived from the cell index rather than hardcoded, because the pill count
 * varies with the fetched armies and the last row is often partial. A cell can be
 * simultaneously the first and last of its row, and both the top and bottom of the
 * block (single row, or a lone trailing pill), so each corner is tested
 * independently instead of by a single "is this a corner cell" branch.
 */
function pillCornerStyle(index: number, total: number) {
  const outer = Radius.xl * 1.25;
  const firstRowCount = Math.min(PILL_COLUMNS, total);
  const lastRowStart = Math.floor((total - 1) / PILL_COLUMNS) * PILL_COLUMNS;
  return {
    ...(index === 0 && { borderTopLeftRadius: outer }),
    ...(index === firstRowCount - 1 && { borderTopRightRadius: outer }),
    ...(index === lastRowStart && { borderBottomLeftRadius: outer }),
    ...(index === total - 1 && { borderBottomRightRadius: outer }),
  };
}

/**
 * The troop art leading a tag pill, taken from the highest-scoring army carrying
 * that tag so the pill previews what the player is about to filter to. The first
 * army-camp troop with package art wins; army camps come first because the clan
 * castle leg is usually a single hero.
 */
function leadingUnitImage(army: ClashArmy | undefined, unitsById: Map<number, UnitDef>) {
  if (!army) return null;
  const campUnits = army.units.filter((u) => u.home === 'armyCamp');
  for (const unit of campUnits) {
    const def = unitsById.get(unit.unitId);
    if (!def) continue;
    const kind = def.type === 'Spell' ? 'spell' : def.type === 'Siege' ? 'siege' : 'troop';
    const variants = [
      def.name,
      ...(kind === 'spell' ? [`${def.name} Spell`, `${def.name} Potion`] : []),
      ...(kind === 'siege' ? [`${def.name} Machine`, `${def.name} Workshop`] : []),
    ];
    for (const variant of variants) {
      const src = getArmyItemImage(variant);
      if (src) return src;
    }
  }
  return null;
}

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

  const thLevel = player?.townHallLevel || getMaxTownHall();

  const [cardArmy, setCardArmy] = useState<ClashArmy | null>(null);
  const shareCardWidth = useShareCardWidth();

  const openShareCard = useCallback((army: ClashArmy) => {
    setCardArmy(army);
  }, []);

  const fetchArmies = useCallback(async (bypass?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const { armies: list, unitsById: defs, equipmentById: eqDefs, petsById: pDefs } = await getPopularArmies(bypass, thLevel);
      setArmies(list);
      if (defs.size > 0) setUnitsById(defs);
      if (eqDefs.size > 0) setEquipmentById(eqDefs);
      if (pDefs.size > 0) setPetsById(pDefs);
    } catch (e: any) {
      setError(e.message || 'Failed to load armies');
    } finally {
      setLoading(false);
    }
  }, [thLevel]);

  const loadSavedData = useCallback(async () => {
    const [sArmies, aFavs] = await Promise.all([
      getSavedArmies(),
      getArmyFavorites(),
    ]);
    setSavedArmies(sArmies);
    setArmyFavorites(new Set(aFavs));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await Promise.all([fetchArmies(), loadSavedData()]);
    })();
    return () => { cancelled = true; };
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
    Linking.openURL(buildCopyArmyLink(army.units, unitsById));
  };

  const handleShareArmy = async (army: ClashArmy) => {
    try {
      await Share.share({
        message: `${army.name} · TH${army.townHall} army from ClashLy\n${buildCopyArmyLink(army.units, unitsById)}\n${army.shareLink || `https://clasharmies.com/armies/${army.id}`}`,
        title: army.name,
      });
    } catch {
      // Share sheet dismissed — no action needed.
    }
  };

  const thArmies = useMemo(
    () => armies.filter((a) => a.townHall === thLevel).sort((a, b) => b.score - a.score),
    [armies, thLevel],
  );

  // Each tag pill leads with the troop art of its top-scoring army and carries the
  // number of armies it would switch to, matching the Buildings category pills.
  const tagMeta = useMemo(() => {
    const out: Record<string, { image: number | null; count: number }> = {};
    for (const pill of ARMY_TAG_PILLS) {
      const matches = pill.key === 'All'
        ? thArmies
        : thArmies.filter((a) => a.tags.includes(pill.key));
      out[pill.key] = { image: leadingUnitImage(matches[0], unitsById), count: matches.length };
    }
    return out;
  }, [thArmies, unitsById]);

  // Tags with no armies at this hall are dropped, matching the Buildings screen.
  // "All" always stays so there is a way back to everything.
  const availableTags = useMemo(
    () => ARMY_TAG_PILLS.filter((p) => p.key === 'All' || (tagMeta[p.key]?.count ?? 0) > 0),
    [tagMeta],
  );

  const activeTag = availableTags.some((p) => p.key === selectedTag)
    ? selectedTag
    : availableTags[0]?.key ?? 'All';

  const currentArmies = activeTag === 'All'
    ? thArmies
    : thArmies.filter((a) => a.tags.includes(activeTag));
  const visibleArmies = currentArmies.slice(0, displayCount);
  const hasMore = displayCount < currentArmies.length;

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 200 && hasMore) {
      setDisplayCount((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  return (
    <SafeAreaView style={styles.container} >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Army Library</Text>
          {loading ? null : <Text style={styles.subtitle}>Community armies from ClashArmies</Text>}
        </View>
        <PressableRipple onPress={() => fetchArmies(true)} hitSlop={12} style={styles.refreshBtn}>
          <Ionicons name="refresh-circle-outline" size={28} color={Colors.textSecondary} />
        </PressableRipple>
      </View>

      {/* Content */}
      {loading ? (
        <ArmiesScreenSkeleton />
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="cloud-offline-outline" size={36} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <PressableRipple onPress={() => fetchArmies(true)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </PressableRipple>
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
            <View style={styles.pillRow}>
              {availableTags.map((pill, ci) => {
                const isActive = pill.key === activeTag;
                const meta = tagMeta[pill.key];
                return (
                  <PressableRipple
                    key={pill.key}
                    onPress={() => { setSelectedTag(pill.key); setDisplayCount(PAGE_SIZE); }}
                    style={[
                      styles.pill,
                      pillCornerStyle(ci, availableTags.length),
                      isActive && styles.pillActive,
                    ]}
                  >
                    {meta?.image != null ? (
                      <Image source={meta.image} style={styles.pillImg} resizeMode="contain" />
                    ) : (
                      <Ionicons
                        name={pill.icon}
                        size={15}
                        color={isActive ? Colors.bg : Colors.textSecondary}
                      />
                    )}
                    <View style={styles.pillTextCol}>
                      <Text
                        style={[styles.pillText, isActive && styles.pillTextActive]}
                        numberOfLines={1}
                      >
                        {pill.label}
                      </Text>
                      <Text
                        style={[styles.pillSubText, isActive && styles.pillSubTextActive]}
                        numberOfLines={1}
                      >
                        {`${meta?.count ?? 0} arm${(meta?.count ?? 0) === 1 ? 'y' : 'ies'}`}
                      </Text>
                    </View>
                  </PressableRipple>
                );
              })}
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
                    onShare={() => handleShareArmy(army)}
                    onShareCard={() => openShareCard(army)}
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
              <Text style={[styles.endMessage, { color: colors.textTertiary }]}>You&apos;ve reached the end</Text>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}

      <SharePreviewModal
        visible={cardArmy !== null}
        onClose={() => setCardArmy(null)}
        cardWidth={shareCardWidth}
        shareTitle={cardArmy?.name}
        onError={(message) => Alert.alert('Share Failed', message)}
      >
        {({ measure }) =>
          cardArmy ? (
            <ArmyShareCard
              army={cardArmy}
              unitsById={unitsById}
              equipmentById={equipmentById}
              petsById={petsById}
              width={shareCardWidth}
              measure={measure}
            />
          ) : null
        }
      </SharePreviewModal>
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
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  pill: {
    // Fixed third-of-a-row basis with no grow and no shrink, so the wrap point is
    // decided purely by the container width and can never be pushed wider by the
    // pill's own content. 32% leaves room for the two 4px gaps; a fourth pill
    // needs another 32% and so always wraps. The gap does the spacing -
    // space-between would push a short final row to opposite edges and break the
    // seamless block.
    width: '32%',
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  pillImg: {
    width: 18,
    height: 18,
  },
  pillTextCol: {
    flex: 1,
    minWidth: 0,
  },
  pillText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  pillTextActive: {
    color: Colors.bg,
  },
  pillSubText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  pillSubTextActive: {
    color: Colors.bg,
    opacity: 0.7,
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
