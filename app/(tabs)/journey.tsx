import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView as SafeAreaViewDep } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import PressableRipple from '../../src/components/PressableRipple';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { useBuilderCount } from '../../src/hooks/useBuilderCount';
import { useGameData } from '../../src/hooks/useGameData';
import { getArmyTroopDetail, getAllItemsAtTH } from '../../src/utils/armyData';
import { computeThJourney, formatJourneyTime, formatJourneyCost, type ThJourneyStep } from '../../src/utils/thJourney';
import { getMaxTownHall } from '../../src/utils/buildingData';
import { JourneyNode } from '../../src/components/JourneyNode';
import type { ClashPlayer } from '../../src/types/clash';
import type { TroopDetail } from '../../src/api/troopDetail';

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'heroes', label: 'Heroes' },
  { key: 'troops', label: 'Troops' },
  { key: 'spells', label: 'Spells' },
  { key: 'pets', label: 'Pets' },
  { key: 'sieges', label: 'Sieges' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'building-ups', label: 'Bldg Ups' },
  { key: 'army-ups', label: 'Army Ups' },
];

export default function JourneyScreen() {
  const { player, loading: playerLoading, refresh } = usePlayer();
  const { count: builderCount, loaded: builderLoaded } = useBuilderCount();
  const { colors } = useTheme();
  const { loading: gameDataLoading } = useGameData();

  const [armyDetails, setArmyDetails] = useState<Record<string, TroopDetail | null>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [filters, setFilters] = useState<Set<string>>(new Set(['all']));
  const [journeySteps, setJourneySteps] = useState<ThJourneyStep[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const th = player?.townHallLevel ?? 1;
  const maxTh = getMaxTownHall();

  const currentStep = journeySteps.find(s => s.isCurrent);
  const cumulative = currentStep?.cumulative ?? { buildTimeSec: 0, researchTimeSec: 0, buildCost: 0, researchCost: 0 };

  const loadArmyDetails = React.useCallback(async () => {
    if (!player) return;
    setDetailsLoading(true);
    try {
      const names = new Set<string>();
      for (let t = th; t <= maxTh; t++) {
        const items = getAllItemsAtTH(t);
        for (const item of items) names.add(item.name);
      }
      const fetched = await Promise.all(
        [...names].map(name => getArmyTroopDetail(name).catch(() => null))
      );
      const next: Record<string, TroopDetail | null> = {};
      [...names].forEach((name, i) => { next[name] = fetched[i]; });
      setArmyDetails(next);
    } finally {
      setDetailsLoading(false);
    }
  }, [player, th]);

  const computeJourney = React.useCallback(() => {
    if (!player || !builderLoaded) return;
    const steps = computeThJourney(th, player, builderCount, armyDetails);
    setJourneySteps(steps);
  }, [player, builderLoaded, builderCount, th]);

  useEffect(() => {
    if (player && builderLoaded && !gameDataLoading) {
      computeJourney();
      loadArmyDetails();
    }
  }, [player, builderLoaded, gameDataLoading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    computeJourney();
    await loadArmyDetails();
    setRefreshing(false);
  };

  const handleFilterChange = (filter: string) => {
    setFilters(prev => {
      const next = new Set(prev);
      if (filter === 'all') {
        if (next.has('all')) {
          next.clear();
        } else {
          next.clear();
          next.add('all');
        }
      } else {
        next.delete('all');
        if (next.has(filter)) {
          next.delete(filter);
        } else {
          next.add(filter);
        }
      }
      return next;
    });
  };

  const isFilterActive = (key: string) => filters.size === 0 || filters.has('all') || filters.has(key);

  if (playerLoading || !builderLoaded || gameDataLoading) {
    return (
      <SafeAreaViewDep style={styles.container}>
        <View style={styles.skeletonContainer}>
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonSubtitle} />
          </View>
          <View style={styles.skeletonFilters} />
          {[...Array(5)].map((_, i) => (
            <View key={i} style={styles.skeletonNode} />
          ))}
        </View>
      </SafeAreaViewDep>
    );
  }

  if (!player) {
    return (
      <SafeAreaViewDep style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No Account</Text>
          <Text style={styles.emptyDesc}>Add a player account to see your Hero Journey</Text>
        </View>
      </SafeAreaViewDep>
    );
  }

  return (
    <SafeAreaViewDep style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Hero Journey</Text>
            <Text style={styles.subtitle}>TH{th} → TH{maxTh}</Text>
          </View>
          <View style={styles.headerRight}>
            <PressableRipple style={styles.builderSelector} onPress={() => {}}>
              <Ionicons name="hammer-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.builderCountText}>{builderCount} builders</Text>
              <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
            </PressableRipple>
          </View>
        </View>

        {/* Cumulative Summary Card */}
        <View style={styles.cumulativeCard}>
          <View style={styles.cumulativeHeader}>
            <Text style={styles.cumulativeTitle}>Total to TH{maxTh}</Text>
          </View>
          <View style={styles.cumulativeStats}>
            <View style={styles.cumulativeStat}>
              <Text style={styles.cumulativeStatLabel}>Build Time</Text>
              <Text style={styles.cumulativeStatValue}>{formatTimeShort(cumulative.buildTimeSec)}</Text>
            </View>
            <View style={styles.cumulativeStat}>
              <Text style={styles.cumulativeStatLabel}>Research Time</Text>
              <Text style={styles.cumulativeStatValue}>{formatTimeShort(cumulative.researchTimeSec)}</Text>
            </View>
            <View style={styles.cumulativeStat}>
              <Text style={styles.cumulativeStatLabel}>Build Cost</Text>
              <Text style={styles.cumulativeStatValue}>{formatCostBreakdown({ Gold: cumulative.buildCost })}</Text>
            </View>
            <View style={styles.cumulativeStat}>
              <Text style={styles.cumulativeStatLabel}>Research Cost</Text>
              <Text style={styles.cumulativeStatValue}>{formatCostBreakdown({ Elixir: cumulative.researchCost })}</Text>
            </View>
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterBar}>
          {FILTER_OPTIONS.map(opt => {
            const active = isFilterActive(opt.key);
            return (
              <PressableRipple
                key={opt.key}
                onPress={() => handleFilterChange(opt.key)}
                style={[
                  styles.filterChip,
                  active && styles.filterChipActive,
                ]}
              >
                <Text style={[
                  styles.filterChipText,
                  active && styles.filterChipTextActive,
                ]}>
                  {opt.label}
                </Text>
              </PressableRipple>
            );
          })}
        </View>

        {/* Journey Timeline */}
        {journeySteps.length === 0 ? (
          <View style={styles.emptyJourney}>
            <Ionicons name="compass-outline" size={48} color={Colors.textTertiary} />
            <Text style={styles.emptyJourneyTitle}>No journey data</Text>
            <Text style={styles.emptyJourneyDesc}>Compute journey after data loads</Text>
          </View>
        ) : (
          journeySteps.map((step, i) => (
            <JourneyNode
              key={step.th}
              step={step}
              index={i}
              isFirst={i === 0}
              isLast={i === journeySteps.length - 1}
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          ))
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaViewDep>
  );
}

function formatTimeShort(sec: number): string {
  if (sec <= 0) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function formatCostBreakdown(byResource: Record<string, number>): string {
  if (!byResource) return '—';
  const entries = Object.entries(byResource).filter(([, v]) => v > 0);
  if (entries.length === 0) return '—';
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([res, v]) => {
      if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B ${res}`;
      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M ${res}`;
      if (v >= 1_000) return `${Math.round(v / 1_000)}K ${res}`;
      return `${v} ${res}`;
    })
    .join(' · ');
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    ...Typography.title1,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  builderSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  builderCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cumulativeCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cumulativeHeader: {
    marginBottom: Spacing.md,
  },
  cumulativeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  cumulativeStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  cumulativeStat: {
    flex: 1,
    minWidth: '45%',
  },
  cumulativeStatLabel: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  cumulativeStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: 'monospace',
  },
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  filterChip: {
    minWidth: 70,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.bg,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  emptyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  emptyJourney: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyJourneyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  emptyJourneyDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  bottomSpacer: {
    height: Spacing.xxxl,
  },
  skeletonContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  skeletonHeader: {
    marginBottom: Spacing.lg,
  },
  skeletonTitle: {
    width: '40%',
    height: 28,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
  },
  skeletonSubtitle: {
    width: '25%',
    height: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    marginTop: Spacing.xs,
  },
  skeletonFilters: {
    height: 36,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.md,
  },
  skeletonNode: {
    height: 120,
    marginBottom: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCardHover,
  },
});