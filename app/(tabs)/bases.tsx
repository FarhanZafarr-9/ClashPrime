import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { BaseCard } from '../../src/components/BaseCard';
import SegmentedSwitch, { type SegmentedSwitchOption } from '../../src/components/SegmentedSwitch';
import { EmptyState } from '../../src/components/EmptyState';
import { Skeleton } from '../../src/components/Skeleton';
import type { ScrapedBase, ScrapeResult, Village } from '../../src/types/bases';
import {
  scrapeBasesForTH,
  scrapeBasesForBH,
  getCachedBases,
  getStoredSourceFilter,
  setStoredSourceFilter,
  type BaseSourceFilter,
} from '../../src/api/baseScraper';
import { getMaxTownHall, getBuildingItemImage } from '../../src/utils/buildingData';
import { getTownHallImageSource } from '../../src/utils/buildingImages';
import { BasesScreenSkeleton } from '../../src/components/SkeletonScreens';
import SharePreviewModal, { useShareCardWidth } from '../../src/components/share/SharePreviewModal';
import BaseShareCard from '../../src/components/BaseShareCard';
import {
  getSavedBases,
  saveBase,
} from '../../src/hooks/usePlayer';
import type { SavedBase } from '../../src/hooks/usePlayer';

const CATEGORY_MAP: Record<string, string> = {
  war: 'War',
  trophy: 'Trophy',
  farming: 'Farming',
  hybrid: 'Hybrid',
  cwl: 'CWL',
  funny: 'Funny',
  builder: 'Builder',
  progress: 'Progress',
  general: 'Home Village',
};

const CATEGORY_PILLS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'All', label: 'All', icon: 'apps-outline' },
  { key: 'War', label: 'War', icon: 'shield-outline' },
  { key: 'Trophy', label: 'Trophy', icon: 'trophy-outline' },
  { key: 'Farming', label: 'Farming', icon: 'leaf-outline' },
  { key: 'Hybrid', label: 'Hybrid', icon: 'layers-outline' },
  { key: 'CWL', label: 'CWL', icon: 'medal-outline' },
  // clash-bases-only categories: pills drop automatically on hall levels (and
  // on Builder Base) where no layout carries the type.
  { key: 'Progress', label: 'Progress', icon: 'construct-outline' },
  { key: 'Fun', label: 'Fun', icon: 'happy-outline' },
];

/**
 * A scraped base belongs to a pill when its raw type either matches the pill key
 * or maps onto it through CATEGORY_MAP (scraped types are lower-cased).
 */
function matchesCategory(base: ScrapedBase, key: string): boolean {
  if (key === 'All') return true;
  return base.type === key.toLowerCase() || CATEGORY_MAP[base.type] === key;
}

const SOURCE_OPTIONS: SegmentedSwitchOption<BaseSourceFilter>[] = [
  { key: 'both', icon: 'albums-outline', label: 'Both' },
  { key: 'clashly', icon: 'flame-outline', label: 'ClashLy' },
  { key: 'clash-bases', icon: 'library-outline', label: 'Clash Bases' },
];

const PILL_COLUMNS = 3;

/**
 * Seamless-grid corner rounding, matching the Buildings category pills and the
 * Army tab chips: the pills read as one rounded block, so only the four outermost
 * corners take the large radius and the interior seams stay at Radius.sm.
 *
 * Derived from the cell index rather than hardcoded, because the pill count
 * varies with the scraped results and the last row is often partial. A cell can
 * be simultaneously the first and last of its row, and both the top and bottom of
 * the block (single row, or a lone trailing pill), so each corner is tested
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

export default function BaseLibraryScreen() {
  const { player } = usePlayer();
  const { colors } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedVillage, setSelectedVillage] = useState<Village>('home');
  const [baseData, setBaseData] = useState<ScrapeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [savedBases, setSavedBases] = useState<SavedBase[]>([]);

  // Which catalogues feed the Home Village list. ClashLy's volume (700+ per
  // mid TH) buries the clash-bases entries deep in the year sections, so the
  // toggle is the only practical way to browse one source's curation.
  const [sourceFilter, setSourceFilterState] = useState<BaseSourceFilter>('both');
  useEffect(() => {
    let cancelled = false;
    getStoredSourceFilter().then((f) => {
      if (!cancelled) setSourceFilterState(f);
    });
    return () => { cancelled = true; };
  }, []);
  const changeSourceFilter = useCallback((f: BaseSourceFilter) => {
    setSourceFilterState(f);
    setStoredSourceFilter(f);
  }, []);

  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;

  const [cardBase, setCardBase] = useState<ScrapedBase | null>(null);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const shareCardWidth = useShareCardWidth();

  const openShareCard = useCallback((base: ScrapedBase) => {
    setPreviewLoaded(false);
    setCardBase(base);
  }, []);

  const thLevel = player?.townHallLevel || getMaxTownHall();
  const bhLevel = player?.builderHallLevel || 10;
  const showBuilderBase = thLevel >= 6;
  const hallLevel = selectedVillage === 'home' ? thLevel : bhLevel;

  // The layouts already scrolled to are what the snapshot has to cover, so a cache
  // holding fewer of them is refetched instead of ending the list short. Kept in a
  // ref so paging the list does not re-trigger the load.
  const displayCountRef = useRef(PAGE_SIZE);
  useEffect(() => {
    displayCountRef.current = displayCount;
  }, [displayCount]);

  // Which village/hall the rendered layouts belong to, so a toggle never leaves the
  // other hall's bases on screen while its own snapshot is being fetched.
  const dataKeyRef = useRef<string | null>(null);

  const loadBases = useCallback(async (bypass = false) => {
    const minItems = Math.max(displayCountRef.current, PAGE_SIZE);
    const dataKey = `${selectedVillage}-${hallLevel}`;
    try {
      setScrapeError(null);
      if (!bypass) {
        // Paint the stored snapshot straight away so navigating back is instant,
        // then reconcile below - a stale or short snapshot is refetched there.
        const snapshot = await getCachedBases(selectedVillage, hallLevel);
        if (snapshot) {
          setBaseData(snapshot.data);
          dataKeyRef.current = dataKey;
          setLoading(false);
        } else if (dataKeyRef.current !== dataKey) {
          setBaseData(null);
          setLoading(true);
        }
      }
      const data = selectedVillage === 'home'
        ? await scrapeBasesForTH(hallLevel, { minItems, bypass })
        : await scrapeBasesForBH(hallLevel, { minItems, bypass });
      setBaseData(data);
      dataKeyRef.current = dataKey;
    } catch (e: any) {
      setScrapeError(e.message || 'Failed to load bases');
    } finally {
      setLoading(false);
    }
  }, [hallLevel, selectedVillage]);

  const fetchBases = useCallback(async () => {
    setLoading(true);
    await loadBases(true);
  }, [loadBases]);

  const loadSavedData = useCallback(async () => {
    const saved = await getSavedBases();
    setSavedBases(saved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await Promise.all([loadBases(), loadSavedData()]);
    })();
    return () => { cancelled = true; };
  }, [loadBases, loadSavedData]);

  const allBases = useMemo(() => {
    if (!baseData) return [];
    const bases: ScrapedBase[] = [];
    for (const group of Object.values(baseData.groups)) {
      bases.push(...group);
    }
    // Builder Base snapshots are ClashLy-only, so the source filter only ever
    // applies to Home Village data.
    if (sourceFilter === 'both' || baseData.village !== 'home') return bases;
    return bases.filter((b) => b.source === sourceFilter);
  }, [baseData, sourceFilter]);

  // Each category pill leads with a real layout from the scraped results, so the
  // pill is recognisable by the base art rather than a generic glyph, and carries
  // the number of layouts it would switch to. Hall levels can be missing from the
  // scrape, so the first layout with a preview is used instead of the first one.
  const catMeta = useMemo(() => {
    const out: Record<string, { image: string | null; count: number }> = {};
    for (const pill of CATEGORY_PILLS) {
      const matches = allBases.filter((b) => matchesCategory(b, pill.key));
      out[pill.key] = {
        image: matches.find((b) => !!b.preview_image_url)?.preview_image_url ?? null,
        count: matches.length,
      };
    }
    return out;
  }, [allBases]);

  // Categories with no layouts for the current hall are dropped, matching the
  // Buildings screen. "All" always stays so there is a way back to everything.
  const availableCats = useMemo(
    () => CATEGORY_PILLS.filter((p) => p.key === 'All' || (catMeta[p.key]?.count ?? 0) > 0),
    [catMeta],
  );

  const activeCategory = availableCats.some((p) => p.key === selectedCategory)
    ? selectedCategory
    : availableCats[0]?.key ?? 'All';

  // Pills are chunked into explicit rows rather than left to flex-wrap on a fixed
  // percentage width, so each pill can be flex: 1 and fill its row exactly. The gap
  // is the only spacing, and a partial trailing row spans it whole.
  const pillRows = useMemo(() => {
    const rows: typeof availableCats[] = [];
    for (let i = 0; i < availableCats.length; i += PILL_COLUMNS) {
      rows.push(availableCats.slice(i, i + PILL_COLUMNS));
    }
    return rows;
  }, [availableCats]);

  const filteredBases = useMemo(
    () => allBases.filter((b) => matchesCategory(b, activeCategory)),
    [allBases, activeCategory],
  );

  // The village switch leads with the halls the player are actually at.
  const thHallImage = getTownHallImageSource(thLevel);
  const bhHallImage = getBuildingItemImage('Builder Hall', bhLevel, true);

  const isSaved = (detailUrl: string) => savedBases.some((b) => b.url === detailUrl);

  const handleSave = async (base: ScrapedBase) => {
    const newBase: SavedBase = {
      id: base.detail_url,
      name: base.title,
      category: CATEGORY_MAP[base.type] || base.type,
      townHallLevel: base.th_level,
      rating: base.rating_out_of_5,
      tags: base.tags,
      thumbnail: base.preview_image_url,
      url: base.detail_url,
      copiedAt: new Date().toISOString(),
    };
    await saveBase(newBase);
    loadSavedData();
  };

  const handleCopy = (base: ScrapedBase) => {
    if (base.game_copy_link) {
      Linking.openURL(base.game_copy_link);
    }
  };

  const handleShare = async (base: ScrapedBase) => {
    try {
      const category = CATEGORY_MAP[base.type] || base.type;
      const sourceName = base.source === 'clash-bases' ? 'Clash Bases' : 'ClashLy';
      await Share.share({
        message: `${base.title} · ${category} ${base.village === 'builder' ? 'BH' : 'TH'}${base.th_level} base layout from ${sourceName}\n${base.detail_url}`,
        title: base.title,
      });
    } catch {
      // Share sheet dismissed — no action needed.
    }
  };

  const [prevResetKey, setPrevResetKey] = useState(`${activeCategory}|${sourceFilter}`);
  const resetKey = `${activeCategory}|${sourceFilter}`;
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setDisplayCount(PAGE_SIZE);
  }

  const currentBases = filteredBases;

  const yearSections = useMemo(() => {
    const groups = new Map<number, ScrapedBase[]>();
    const nullGroup: ScrapedBase[] = [];
    for (const b of currentBases) {
      if (b.year != null) {
        if (!groups.has(b.year)) groups.set(b.year, []);
        groups.get(b.year)!.push(b);
      } else {
        nullGroup.push(b);
      }
    }
    for (const [, arr] of groups) arr.sort((a, b) => b.views - a.views);
    nullGroup.sort((a, b) => b.views - a.views);

    const sections: { year: number | null; title: string; bases: ScrapedBase[] }[] = [];
    const sortedYears = [...groups.keys()].sort((a, b) => b - a);
    for (const y of sortedYears) {
      sections.push({ year: y, title: String(y), bases: groups.get(y)! });
    }
    if (nullGroup.length > 0) {
      sections.push({ year: null, title: 'Unknown', bases: nullGroup });
    }
    return sections;
  }, [currentBases]);

  const visibleSections = useMemo(() => {
    let remaining = displayCount;
    const result: typeof yearSections = [];
    for (const section of yearSections) {
      const take = Math.min(section.bases.length, remaining);
      if (take > 0) {
        result.push({ ...section, bases: section.bases.slice(0, take) });
        remaining -= take;
      }
      if (remaining <= 0) break;
    }
    return result;
  }, [yearSections, displayCount]);

  const totalBases = currentBases.length;
  const hasMore = displayCount < totalBases;

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 200 && hasMore) {
      setDisplayCount((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  const hallLabel = selectedVillage === 'home' ? 'TH' : 'BH';

  return (
    <SafeAreaView style={styles.container} >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Base Library</Text>
          {loading ? null : (
            <Text style={styles.subtitle}>
              {selectedVillage === 'home'
                ? `${hallLabel}${hallLevel} layouts · ${
                    sourceFilter === 'both'
                      ? 'ClashLy + Clash Bases'
                      : sourceFilter === 'clashly'
                        ? 'from ClashLy'
                        : 'from Clash Bases'
                  }`
                : `${hallLabel}${hallLevel} layouts from ClashLy`}
            </Text>
          )}
        </View>
        <PressableRipple onPress={fetchBases} hitSlop={12} style={styles.refreshBtn}>
          <Ionicons name="refresh-circle-outline" size={28} color={Colors.textSecondary} />
        </PressableRipple>
      </View>

      {/* Village + source switches: the same compact hall pills as the Time to
          Max and Army tabs. The source filter only applies to Home Village
          (Builder Base is ClashLy-only), so it sits under the village switch
          only there. */}
      {!loading && (
        <View style={styles.switchesWrap}>
          {showBuilderBase && (
            <SegmentedSwitch
              options={[
                { key: 'home', image: thHallImage, icon: 'home-outline', label: `TH${thLevel}` },
                { key: 'builder', image: bhHallImage, icon: 'hammer-outline', label: `BH${bhLevel}` },
              ]}
              value={selectedVillage}
              onChange={(v) => setSelectedVillage(v)}
            />
          )}
          {selectedVillage === 'home' && (
            <SegmentedSwitch
              options={SOURCE_OPTIONS}
              value={sourceFilter}
              onChange={changeSourceFilter}
            />
          )}
        </View>
      )}

      {/* Category filter */}
      <View style={styles.filterSection}>
        <View style={styles.pillRow}>
          {loading ? (
            // The counts come from the scrape, so until it lands every pill would
            // read "0 bases" and "All" would look empty. Placeholders keep the
            // block's shape without claiming a number.
            <View style={styles.pillLine}>
              {Array.from({ length: PILL_COLUMNS }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.pill,
                    pillCornerStyle(i, PILL_COLUMNS),
                    styles.pillPlaceholder,
                  ]}
                >
                  <Skeleton width={18} height={18} borderRadius={4} />
                  <View style={[styles.pillTextCol, styles.pillPlaceholderText]}>
                    <Skeleton width="70%" height={11} borderRadius={4} />
                    <Skeleton width="45%" height={9} borderRadius={4} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            pillRows.map((row) => (
              <View key={row[0].key} style={styles.pillLine}>
                {row.map((pill) => {
                  const isActive = pill.key === activeCategory;
                  const meta = catMeta[pill.key];
                  return (
                    <PressableRipple
                      key={pill.key}
                      onPress={() => setSelectedCategory(pill.key)}
                      style={[
                        styles.pill,
                        pillCornerStyle(availableCats.indexOf(pill), availableCats.length),
                        isActive && styles.pillActive,
                      ]}
                    >
                      {meta?.image ? (
                        <Image source={{ uri: meta.image }} style={styles.pillImg} resizeMode="cover" />
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
                          {`${meta?.count ?? 0} base${(meta?.count ?? 0) === 1 ? '' : 's'}`}
                        </Text>
                      </View>
                    </PressableRipple>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <BasesScreenSkeleton />
      ) : scrapeError ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="cloud-offline-outline" size={36} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{scrapeError}</Text>
          <PressableRipple onPress={fetchBases} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </PressableRipple>
        </View>
      ) : (
        <>
          <View style={styles.countBar}>
            <Text style={styles.countText}>
              {totalBases} base{totalBases !== 1 ? 's' : ''}
              {totalBases > PAGE_SIZE && ` · showing ${Math.min(displayCount, totalBases)}`}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          >
            {totalBases === 0 ? (
              <EmptyState
                icon={'🔍'}
                title={'No bases found'}
                description={`No ${activeCategory === 'All' ? '' : activeCategory.toLowerCase() + ' '}bases for ${hallLabel}${hallLevel}. Try a different filter.`}
              />
            ) : (
              visibleSections.map((section) => (
                <View key={section.year ?? 'unknown'}>
                  <Text style={styles.yearHeader}>
                    {section.title}
                    <Text style={styles.yearCount}> · {section.bases.length}</Text>
                  </Text>
                  {section.bases.map((scrapedBase) => {
                    const isSavedBase = isSaved(scrapedBase.detail_url);
                    return (
                      <BaseCard
                        key={String(scrapedBase.id)}
                        name={scrapedBase.title}
                        townHallLevel={scrapedBase.th_level}
                        village={scrapedBase.village}
                        rating={scrapedBase.rating_out_of_5}
                        tags={scrapedBase.tags}
                        previewImage={scrapedBase.preview_image_url}
                        views={scrapedBase.views_raw}
                        downloads={scrapedBase.votes}
                        year={scrapedBase.year}
                        updated={scrapedBase.updated}
                        description={scrapedBase.description}
                        builder={scrapedBase.builder}
                        source={scrapedBase.source}
                        isSaved={isSavedBase}
                        hasLink={scrapedBase.has_link}
                        onCopy={() => handleCopy(scrapedBase)}
                        onSave={() => handleSave(scrapedBase)}
                        onShare={() => handleShare(scrapedBase)}
                        onShareCard={() => openShareCard(scrapedBase)}
                      />
                    );
                  })}
                </View>
              ))
            )}
            {totalBases > 0 && hasMore && (
              <View style={{ gap: Spacing.base }}>
                {[0, 1].map((i) => (
                  <View key={i} style={{ borderRadius: Radius.lg, borderWidth: 0.75, borderColor: colors.border, backgroundColor: colors.bgCard, overflow: 'hidden' }}>
                    <View style={{ width: '100%', aspectRatio: 1.6, backgroundColor: colors.bgSubtle }} />
                    <View style={{ padding: Spacing.base, gap: Spacing.sm }}>
                      <View>
                        <Skeleton width="60%" height={16} borderRadius={4} />
                        <Skeleton width={54} height={9} borderRadius={4} style={{ marginTop: 4 }} />
                      </View>
                      <View style={{ flexDirection: 'row', gap: Spacing.md }}>
                        <Skeleton width={60} height={44} borderRadius={Radius.md} />
                        <Skeleton style={{ flex: 1 }} height={44} borderRadius={Radius.md} />
                        <Skeleton width={60} height={44} borderRadius={Radius.md} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {totalBases > 0 && !hasMore && (
              <Text style={[styles.endMessage, { color: colors.textTertiary }]}>You&apos;ve reached the end</Text>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}

      <SharePreviewModal
        visible={cardBase !== null}
        onClose={() => setCardBase(null)}
        cardWidth={shareCardWidth}
        shareTitle={cardBase?.title}
        ready={!cardBase?.preview_image_url || previewLoaded}
        onError={(message) => Alert.alert('Share Failed', message)}
      >
        {({ measure }) =>
          cardBase ? (
            <BaseShareCard
              base={cardBase}
              category={CATEGORY_MAP[cardBase.type] || cardBase.type}
              width={shareCardWidth}
              measure={measure}
              onPreviewLoad={() => setPreviewLoaded(true)}
              onPreviewError={() => setPreviewLoaded(true)}
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
  switchesWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  filterSection: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
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
    borderRadius: 4,
  },
  pillPlaceholder: {
    gap: 6,
  },
  // The two placeholder bars sit where the pill's label and count go, which are
  // one fontSize apart; without the nudge they read as a single tall block.
  pillPlaceholderText: {
    gap: 5,
  },
  pillTextCol: {
    flex: 1,
    minWidth: 0,
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
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
  yearHeader: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  yearCount: {
    fontWeight: '400',
    fontSize: 12,
    color: Colors.textTertiary,
  },
  endMessage: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
    fontStyle: 'italic',
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
  itemIconText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 10,
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
