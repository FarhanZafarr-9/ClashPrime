import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { getPopularArmies, getCachedArmies } from '../../src/api/clashArmies';
import { getMaxTownHall } from '../../src/utils/buildingData';
import { getArmyItemImage } from '../../src/utils/armyData';
import { scoreArmyForPlayer, type ArmyScore } from '../../src/utils/armyScore';
import { buildCopyArmyLink } from '../../src/utils/armyLinks';
import { ArmiesScreenSkeleton } from '../../src/components/SkeletonScreens';
import SharePreviewModal, { useShareCardWidth } from '../../src/components/share/SharePreviewModal';
import ArmyShareCard from '../../src/components/ArmyShareCard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_ARMIES_KEY = 'clashprime_saved_armies';

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
 * The troop art leading a tag pill, as an ordered list of candidates rather than
 * a single image. Tags overlap heavily - a top Farming and a top Spam army
 * usually share the same core camp composition - so giving every pill just its
 * own army's first unit put the same sprite on several pills. tagMeta walks the
 * visible pills and takes the first candidate nobody has claimed, falling back
 * to the tag's glyph when a pill runs out. Army camps come first because the
 * clan castle leg is usually a single hero.
 */
function leadingUnitImages(army: ClashArmy | undefined, unitsById: Map<number, UnitDef>): number[] {
  if (!army) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const unit of army.units) {
    if (unit.home !== 'armyCamp') continue;
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
      if (src && !seen.has(src)) {
        seen.add(src);
        out.push(src);
      }
    }
  }
  return out;
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

  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;
  const [selectedTag, setSelectedTag] = useState('All');

  const thLevel = player?.townHallLevel || getMaxTownHall();

  const [cardArmy, setCardArmy] = useState<ClashArmy | null>(null);
  const shareCardWidth = useShareCardWidth();

  const openShareCard = useCallback((army: ClashArmy) => {
    setCardArmy(army);
  }, []);

  // The armies already scrolled to are what the snapshot has to cover, so a cache
  // holding fewer of them is refetched instead of ending the list short. Kept in a
  // ref so paging the list does not re-trigger the load.
  const displayCountRef = useRef(PAGE_SIZE);
  useEffect(() => {
    displayCountRef.current = displayCount;
  }, [displayCount]);

  // Which town hall the rendered armies belong to, so a hall change never leaves
  // the old list on screen while its own snapshot is being fetched.
  const dataKeyRef = useRef<string | null>(null);

  const loadArmies = useCallback(async (bypass?: boolean) => {
    const minItems = Math.max(displayCountRef.current, PAGE_SIZE);
    const dataKey = `${thLevel}`;
    try {
      setError(null);
      if (!bypass) {
        // Paint the stored list straight away so navigating back is instant, then
        // reconcile below - a stale or short snapshot is refetched there.
        const snapshot = await getCachedArmies(thLevel);
        if (snapshot) {
          setArmies(snapshot.armies);
          setUnitsById(snapshot.unitsById);
          setEquipmentById(snapshot.equipmentById);
          setPetsById(snapshot.petsById);
          dataKeyRef.current = dataKey;
          setLoading(false);
        } else if (dataKeyRef.current !== dataKey) {
          setArmies([]);
          setLoading(true);
        }
      }
      const { armies: list, unitsById: defs, equipmentById: eqDefs, petsById: pDefs } = await getPopularArmies(bypass, thLevel, { minItems });
      setArmies(list);
      if (defs.size > 0) setUnitsById(defs);
      if (eqDefs.size > 0) setEquipmentById(eqDefs);
      if (pDefs.size > 0) setPetsById(pDefs);
      dataKeyRef.current = dataKey;
    } catch (e: any) {
      setError(e.message || 'Failed to load armies');
    } finally {
      setLoading(false);
    }
  }, [thLevel]);

  const fetchArmies = useCallback(async (bypass?: boolean) => {
    setLoading(true);
    await loadArmies(bypass);
  }, [loadArmies]);

  const loadSavedData = useCallback(async () => {
    const sArmies = await getSavedArmies();
    setSavedArmies(sArmies);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await Promise.all([loadArmies(), loadSavedData()]);
    })();
    return () => { cancelled = true; };
  }, [loadArmies, loadSavedData]);

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

  // How maxed the player is for each army's items at their own Town Hall, shown
  // beside ClashArmies' community score. Null until the definitions and the
  // player are both in, and null throughout when nobody is logged in.
  const maxedScores = useMemo(() => {
    if (!player || unitsById.size === 0) return new Map<number, ArmyScore>();
    const out = new Map<number, ArmyScore>();
    const defs = { unitsById, equipmentById, petsById };
    for (const army of thArmies) {
      const s = scoreArmyForPlayer(army, defs, player, thLevel);
      if (s) out.set(army.id, s);
    }
    return out;
  }, [thArmies, player, unitsById, equipmentById, petsById, thLevel]);

  // Counts are resolved first because they decide which pills are visible, and the
  // leading art is then handed out in that visible order - claiming art for a pill
  // that later drops out would needlessly deny it to one the player can see.
  const tagCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const pill of ARMY_TAG_PILLS) {
      out[pill.key] = pill.key === 'All'
        ? thArmies.length
        : thArmies.filter((a) => a.tags.includes(pill.key)).length;
    }
    return out;
  }, [thArmies]);

  // Tags with no armies at this hall are dropped, matching the Buildings screen.
  // "All" always stays so there is a way back to everything.
  const availableTags = useMemo(
    () => ARMY_TAG_PILLS.filter((p) => p.key === 'All' || (tagCounts[p.key] ?? 0) > 0),
    [tagCounts],
  );

  // Each tag pill leads with troop art from its top-scoring army, no two pills
  // showing the same sprite, and carries the number of armies it would switch to.
  const tagMeta = useMemo(() => {
    const out: Record<string, { image: number | null; count: number }> = {};
    const claimed = new Set<number>();
    for (const pill of availableTags) {
      const topArmy = thArmies.find((a) => a.tags.includes(pill.key));
      const candidates = leadingUnitImages(topArmy, unitsById);
      const image = candidates.find((src) => !claimed.has(src)) ?? null;
      if (image != null) claimed.add(image);
      out[pill.key] = { image, count: tagCounts[pill.key] ?? 0 };
    }
    return out;
  }, [availableTags, tagCounts, thArmies, unitsById]);

  const activeTag = availableTags.some((p) => p.key === selectedTag)
    ? selectedTag
    : availableTags[0]?.key ?? 'All';

  // Pills are chunked into explicit rows rather than left to flex-wrap on a fixed
  // percentage width, so each pill can be flex: 1 and fill its row exactly. The gap
  // is the only spacing, and a partial trailing row spans it whole.
  const pillRows = useMemo(() => {
    const rows: typeof availableTags[] = [];
    for (let i = 0; i < availableTags.length; i += PILL_COLUMNS) {
      rows.push(availableTags.slice(i, i + PILL_COLUMNS));
    }
    return rows;
  }, [availableTags]);

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
              {pillRows.map((row) => (
                <View key={row[0].key} style={styles.pillLine}>
                  {row.map((pill) => {
                    const isActive = pill.key === activeTag;
                    const meta = tagMeta[pill.key];
                    return (
                      <PressableRipple
                        key={pill.key}
                        onPress={() => { setSelectedTag(pill.key); setDisplayCount(PAGE_SIZE); }}
                        style={[
                          styles.pill,
                          pillCornerStyle(availableTags.indexOf(pill), availableTags.length),
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
              ))}
            </View>
          </View>

          <ScrollView
contentContainerStyle={styles.list}
          overScrollMode="never"
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
                const isSavedArmy = savedArmies.some((s) => s.id === String(army.id));
                return (
                  <ArmyCard
                    key={army.id}
                    army={army}
                    unitsById={unitsById}
                    equipmentById={equipmentById}
                    petsById={petsById}
                    isSaved={isSavedArmy}
                    maxed={maxedScores.get(army.id)}
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
    gap: Spacing.xs,
  },
  pillLine: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  pill: {
    // flex: 1 rather than a hardcoded percentage width, so a row of pills shares
    // the row exactly (gap-only spacing) and a partial trailing row fills it.
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard
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
