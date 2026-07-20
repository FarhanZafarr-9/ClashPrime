import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { Chip } from '../../src/components/Chip';
import { BaseCard } from '../../src/components/BaseCard';
import { EmptyState } from '../../src/components/EmptyState';
import type { ScrapedBase, ScrapeResult } from '../../src/types/bases';
import { scrapeBasesForTH } from '../../src/api/baseScraper';
import { useDialog } from '../../src/components/AlertDialog';
import { BasesScreenSkeleton } from '../../src/components/SkeletonScreens';

const CATEGORY_MAP: Record<string, string> = {
  war: 'War',
  trophy: 'Trophy',
  farming: 'Farming',
  hybrid: 'Hybrid',
  cwl: 'CWL',
  funny: 'Funny',
  builder: 'Builder',
};

const CATEGORIES = ['All', 'War', 'Trophy', 'Farming', 'Hybrid', 'CWL'];

export default function BaseLibraryScreen() {
  const { player, refresh: refreshPlayer } = usePlayer();
  const { show: showDialog, Dialog } = useDialog();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [baseData, setBaseData] = useState<ScrapeResult | null>(null);
  const [loadingBases, setLoadingBases] = useState(true);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchBases();
  }, [fetchBases]);

  const allBases = useMemo(() => {
    if (!baseData) return [];
    const bases: ScrapedBase[] = [];
    for (const group of Object.values(baseData.groups)) {
      bases.push(...group);
    }
    return bases;
  }, [baseData]);

  const filtered = useMemo(() => {
    const catLower = selectedCategory.toLowerCase();
    return allBases.filter((b) => {
      if (selectedCategory !== 'All') {
        if (b.type !== catLower && CATEGORY_MAP[b.type] !== selectedCategory) return false;
      }
      return true;
    });
  }, [allBases, selectedCategory]);

  const handleFavorite = (detailUrl: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(detailUrl)) next.delete(detailUrl);
      else next.add(detailUrl);
      return next;
    });
  };

  const handleCopy = (base: ScrapedBase) => {
    if (base.game_copy_link) {
      Linking.openURL(base.game_copy_link);
    } else {
      showDialog({ title: 'No Copy Link', message: 'This base does not have an in-game copy link.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
    }
  };

  if (loadingBases) {
    return <BasesScreenSkeleton />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Base Library</Text>
          <Text style={styles.subtitle}>TH{thLevel} layouts from ClashLy</Text>
        </View>
        <Pressable onPress={fetchBases} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {loadingBases ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.textPrimary} />
          <Text style={styles.loadingText}>Loading TH{thLevel} bases…</Text>
        </View>
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
              {filtered.length} base{filtered.length !== 1 ? 's' : ''}
            </Text>
            {(baseData?.total_bases || 0) !== filtered.length && (
              <Text style={styles.countSubtext}>
                {baseData?.total_bases || 0} total
              </Text>
            )}
          </View>



          <View style={styles.chipsContainer}>
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                selected={selectedCategory === cat}
                onPress={() => setSelectedCategory(cat)}
              />
            ))}
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {filtered.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No bases found"
                description={`No ${selectedCategory.toLowerCase() === 'all' ? '' : selectedCategory.toLowerCase() + ' '}bases for TH${thLevel}. Try a different filter or search.`}
              />
            ) : (
              filtered.map((base) => (
                <BaseCard
                  key={String(base.id)}
                  name={base.title}
                  category={CATEGORY_MAP[base.type] || base.type}
                  townHallLevel={base.th_level}
                  rating={base.rating_out_of_5}
                  tags={base.tags}
                  previewImage={base.preview_image_url}
                  views={base.views_raw}
                  downloads={base.votes}
                  year={base.year}
                  updated={base.updated}
                  hasLink={base.has_link}
                  isFavorite={favorites.has(base.detail_url)}
                  onFavorite={() => handleFavorite(base.detail_url)}
                  onCopy={() => handleCopy(base)}
                />
              ))
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}
      <Dialog />
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
  loadingText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
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
  searchContainer: {
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    padding: 0,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  list: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
});
