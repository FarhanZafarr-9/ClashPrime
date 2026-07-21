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
import { useDialog } from '../../src/components/AlertDialog';
import { BasesScreenSkeleton } from '../../src/components/SkeletonScreens';
import { getSavedBases, getFavorites, saveBase, removeBase, toggleFavorite } from '../../src/hooks/usePlayer';
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
const FILTER_PILLS: { key: 'library' | 'saved' | 'favorites'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'library', label: 'Library', icon: 'library-outline' },
  { key: 'saved', label: 'Saved', icon: 'bookmark-outline' },
  { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
];

export default function BaseLibraryScreen() {
  const { player, refresh: refreshPlayer } = usePlayer();
  const { show: showDialog, Dialog } = useDialog();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedFilter, setSelectedFilter] = useState<FILTER_PILLS[number]['key']>('library');
  const [baseData, setBaseData] = useState<ScrapeResult | null>(null);
  const [loadingBases, setLoadingBases] = useState(true);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [savedBases, setSavedBases] = useState<SavedBase[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;

  const thLevel = player?.townHallLevel || 16;

  const fetchBases = useCallback(async () => {
    try {
      setLoadingBases(true);
      setScrapeError(null);
      const data = await scrapeBasesForTH(thLevel, { maxPages: 2 });
      setBaseData(data);
    } catch (e: any) {
      setScrapeError(e.message || 'Failed to load bases');
    } finally {
      setLoadingBases(false);
    }
  }, [thLevel]);

  const loadSavedData = useCallback(async () => {
    const [saved, favs] = await Promise.all([getSavedBases(), getFavorites()]);
    setSavedBases(saved);
    setFavorites(new Set(favs));
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

  const savedBaseIds = useMemo(() => new Set(savedBases.map((b) => b.id)), [savedBases]);

  const filtered = useMemo(() => {
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
    const isFav = favorites.has(detailUrl);
    const newFavs = new Set(favorites);
    if (isFav) newFavs.delete(detailUrl);
    else newFavs.add(detailUrl);
    setFavorites(newFavs);
    await toggleFavorite(detailUrl);
  };

  const handleSaveBase = async (base: ScrapedBase) => {
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
    } else {
      showDialog({ title: 'No Copy Link', message: 'This base does not have an in-game copy link.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
    }
  };

  const getFilteredBases = () => {
    switch (selectedFilter) {
      case 'saved':
        return savedBases;
      case 'favorites':
        return filtered.filter((b) => favorites.has(b.detail_url));
      case 'library':
      default:
        return filtered;
    }
  };

  React.useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [selectedCategory, selectedFilter]);

  const currentBases = getFilteredBases();
  const visibleBases = currentBases.slice(0, displayCount);
  const hasMore = displayCount < currentBases.length;

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
          {loadingBases ? null : (
            <Text style={styles.subtitle}>TH{thLevel} layouts from ClashLy</Text>
          )}
        </View>
        <Pressable onPress={fetchBases} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {loadingBases ? (
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
              {currentBases.length} base{currentBases.length !== 1 ? 's' : ''}
              {currentBases.length > PAGE_SIZE && ` · showing ${Math.min(displayCount, currentBases.length)}`}
            </Text>
            {selectedFilter === 'library' && (baseData?.total_bases || 0) !== filtered.length && (
              <Text style={styles.countSubtext}>
                {baseData?.total_bases || 0} total
              </Text>
            )}
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>View</Text>
            <View style={styles.filterPills}>
              {FILTER_PILLS.map((pill) => (
                <Pressable
                  key={pill.key}
                  onPress={() => setSelectedFilter(pill.key)}
                  style={[
                    styles.filterPill,
                    selectedFilter === pill.key && styles.filterPillActive,
                  ]}
                >
                  <Ionicons
                    name={pill.icon}
                    size={13}
                    color={selectedFilter === pill.key ? Colors.bg : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedFilter === pill.key && styles.filterPillTextActive,
                    ]}
                  >
                    {pill.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Category</Text>
            <View style={styles.filterPills}>
              {CATEGORY_PILLS.map((pill) => (
                <Pressable
                  key={pill.key}
                  onPress={() => setSelectedCategory(pill.key)}
                  style={[
                    styles.filterPill,
                    selectedCategory === pill.key && styles.filterPillActive,
                  ]}
                >
                  <Ionicons
                    name={pill.icon}
                    size={13}
                    color={selectedCategory === pill.key ? Colors.bg : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterPillText,
                      selectedCategory === pill.key && styles.filterPillTextActive,
                    ]}
                  >
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
            {currentBases.length === 0 ? (
              <EmptyState
                icon={selectedFilter === 'library' ? '🔍' : selectedFilter === 'saved' ? '🔖' : '♡'}
                title={
                  selectedFilter === 'library'
                    ? 'No bases found'
                    : selectedFilter === 'saved'
                    ? 'No saved bases'
                    : 'No favorites yet'
                }
                description={
                  selectedFilter === 'library'
                    ? `No ${selectedCategory.toLowerCase() === 'all' ? '' : selectedCategory.toLowerCase() + ' '}bases for TH${thLevel}. Try a different filter.`
                    : selectedFilter === 'saved'
                    ? 'Save bases from the Library to access them quickly.'
                    : 'Tap the heart icon on any base to add it to your favorites.'
                }
              />
            ) : (
              visibleBases.map((base) => {
                if (selectedFilter === 'saved') {
                  const savedBase = base as SavedBase;
                  return (
                    <View key={savedBase.id} style={styles.savedItem}>
                      <View style={styles.itemIcon}>
                        <Text style={styles.itemIconText}>TH{savedBase.townHallLevel}</Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{savedBase.name}</Text>
                        <Text style={styles.itemMeta}>{savedBase.category} · Rating {savedBase.rating}</Text>
                      </View>
                      <Pressable onPress={() => handleRemoveSaved(savedBase.id)} hitSlop={8}>
                        <Ionicons name="trash-outline" size={16} color={Colors.textTertiary} />
                      </Pressable>
                    </View>
                  );
                }

                const scrapedBase = base as ScrapedBase;
                const isFav = favorites.has(scrapedBase.detail_url);
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
                    onSave={() => handleSaveBase(scrapedBase)}
                  />
                );
              })
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}
      <Dialog />
    </SafeAreaView>
  );
}

type FILTER_PILLS = typeof FILTER_PILLS;

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
    padding: Spacing.sm,
    marginTop: Spacing.xs,
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
  countSubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
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