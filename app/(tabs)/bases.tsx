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
import { BaseCard } from '../../src/components/BaseCard';
import { EmptyState } from '../../src/components/EmptyState';
import type { ScrapedBase, ScrapeResult } from '../../src/types/bases';
import { scrapeBasesForTH } from '../../src/api/baseScraper';
import { BasesScreenSkeleton } from '../../src/components/SkeletonScreens';
import {
  getSavedBases,
  getFavorites,
  saveBase,
  removeBase,
  toggleFavorite,
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
};

const CATEGORY_PILLS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'All', label: 'All', icon: 'apps-outline' },
  { key: 'War', label: 'War', icon: 'shield-outline' },
  { key: 'Trophy', label: 'Trophy', icon: 'trophy-outline' },
  { key: 'Farming', label: 'Farming', icon: 'leaf-outline' },
  { key: 'Hybrid', label: 'Hybrid', icon: 'layers-outline' },
  { key: 'CWL', label: 'CWL', icon: 'medal-outline' },
];

export default function BaseLibraryScreen() {
  const { player } = usePlayer();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [baseData, setBaseData] = useState<ScrapeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [savedBases, setSavedBases] = useState<SavedBase[]>([]);
  const [baseFavorites, setBaseFavorites] = useState<Set<string>>(new Set());

  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;

  const thLevel = player?.townHallLevel || 16;

  const fetchBases = useCallback(async () => {
    try {
      setLoading(true);
      setScrapeError(null);
      const data = await scrapeBasesForTH(thLevel, { maxPages: 2 });
      setBaseData(data);
    } catch (e: any) {
      setScrapeError(e.message || 'Failed to load bases');
    } finally {
      setLoading(false);
    }
  }, [thLevel]);

  const loadSavedData = useCallback(async () => {
    const [saved, favs] = await Promise.all([
      getSavedBases(),
      getFavorites(),
    ]);
    setSavedBases(saved);
    setBaseFavorites(new Set(favs));
  }, []);

  useEffect(() => {
    fetchBases();
    loadSavedData();
  }, [fetchBases, loadSavedData]);

  const allBases = useMemo(() => {
    if (!baseData) return [];
    const bases: ScrapedBase[] = [];
    for (const group of Object.values(baseData.groups)) {
      bases.push(...group);
    }
    return bases;
  }, [baseData]);

  const filteredBases = useMemo(() => {
    const catLower = selectedCategory.toLowerCase();
    return allBases.filter((b) => {
      if (selectedCategory !== 'All') {
        if (b.type !== catLower && CATEGORY_MAP[b.type] !== selectedCategory) return false;
      }
      return true;
    });
  }, [allBases, selectedCategory]);

  const isSaved = (detailUrl: string) => savedBases.some((b) => b.url === detailUrl);

  const handleFavorite = async (detailUrl: string) => {
    const isFav = baseFavorites.has(detailUrl);
    const newFavs = new Set(baseFavorites);
    if (isFav) newFavs.delete(detailUrl);
    else newFavs.add(detailUrl);
    setBaseFavorites(newFavs);
    await toggleFavorite(detailUrl);
  };

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

  const handleRemoveSaved = async (id: string) => {
    await removeBase(id);
    loadSavedData();
  };

  const handleCopy = (base: ScrapedBase) => {
    if (base.game_copy_link) {
      Linking.openURL(base.game_copy_link);
    }
  };

  React.useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [selectedCategory]);

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
    // Sort within each year by hotScore desc
    for (const [, arr] of groups) arr.sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));
    nullGroup.sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));

    const sections: { year: number | null; title: string; bases: ScrapedBase[] }[] = [];
    // Years in descending order
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Base Library</Text>
          {loading ? null : <Text style={styles.subtitle}>TH{thLevel} layouts from ClashLy</Text>}
        </View>
        <Pressable onPress={fetchBases} hitSlop={12} style={styles.refreshBtn}>
          <Ionicons name="refresh-circle-outline" size={28} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Category filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Category</Text>
        <View style={styles.filterPills}>
          {CATEGORY_PILLS.map((pill) => (
            <Pressable
              key={pill.key}
              onPress={() => setSelectedCategory(pill.key)}
              style={[styles.filterPill, selectedCategory === pill.key && styles.filterPillActive]}
            >
              <Ionicons
                name={pill.icon}
                size={13}
                color={selectedCategory === pill.key ? Colors.bg : Colors.textSecondary}
              />
              <Text style={[styles.filterPillText, selectedCategory === pill.key && styles.filterPillTextActive]}>
                {pill.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <BasesScreenSkeleton />
      ) : scrapeError ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="cloud-offline-outline" size={36} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{scrapeError}</Text>
          <Pressable onPress={fetchBases} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
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
                description={`No ${selectedCategory.toLowerCase() === 'all' ? '' : selectedCategory.toLowerCase() + ' '}bases for TH${thLevel}. Try a different filter.`}
              />
            ) : (
              visibleSections.map((section) => (
                <View key={section.year ?? 'unknown'}>
                  <Text style={styles.yearHeader}>
                    {section.title}
                    <Text style={styles.yearCount}> · {section.bases.length}</Text>
                  </Text>
                  {section.bases.map((scrapedBase) => {
                    const isFav = baseFavorites.has(scrapedBase.detail_url);
                    const isSavedBase = isSaved(scrapedBase.detail_url);
                    return (
                      <BaseCard
                        key={String(scrapedBase.id)}
                        name={scrapedBase.title}
                        category={CATEGORY_MAP[scrapedBase.type] || scrapedBase.type}
                        townHallLevel={scrapedBase.th_level}
                        rating={scrapedBase.rating_out_of_5}
                        tags={scrapedBase.tags}
                        previewImage={scrapedBase.preview_image_url}
                        views={scrapedBase.views_raw}
                        downloads={scrapedBase.votes}
                        year={scrapedBase.year}
                        updated={scrapedBase.updated}
                        hasLink={scrapedBase.has_link}
                        isFavorite={isFav}
                        isSaved={isSavedBase}
                        onFavorite={() => handleFavorite(scrapedBase.detail_url)}
                        onCopy={() => handleCopy(scrapedBase)}
                        onSave={() => handleSave(scrapedBase)}
                      />
                    );
                  })}
                </View>
              ))
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
