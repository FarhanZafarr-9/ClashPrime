import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import PressableRipple from '../../src/components/PressableRipple';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { AchievementCard } from '../../src/components/AchievementCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { groupAchievementsByStars, getTotalStars } from '../../src/utils/achievements';
import { getBuildingItemImage } from '../../src/utils/buildingData';
import { getTownHallImageSource } from '../../src/utils/buildingImages';
import type { Village } from '../../src/types/clash';

type AchievementVillageFilter = 'all' | Village;

const ACHIEVEMENT_FILTER_PILLS: {
  key: AchievementVillageFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'all', label: 'All', icon: 'planet-outline' },
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'builderBase', label: 'Builder', icon: 'hammer-outline' },
  { key: 'clanCapital', label: 'Capital', icon: 'flag-outline' },
];

const PILL_COLUMNS = 3;

const STARS_IMAGE = require('../../assets/stats/war_stars.png');

/**
 * Seamless-grid corner rounding, matching the Bases, Armies and Hero Journey
 * pills: the pills read as one rounded block, so only the four outermost corners
 * take the large radius and the interior seams stay at Radius.sm.
 *
 * Derived from the cell index rather than hardcoded, because villages with no
 * achievements are dropped and the last row is often partial. A cell can be
 * simultaneously the first and last of its row, and both the top and bottom of
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

export default function AchievementsScreen() {
  const { player, loading } = usePlayer();
  const { colors } = useTheme();
  const [achievementVillageFilter, setAchievementVillageFilter] = useState<AchievementVillageFilter>('all');
  const [expandedAchievement, setExpandedAchievement] = useState<string | null>(null);

  if (loading || !player) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} >
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const achievementVillageCounts = {
    all: player.achievements.length,
    home: player.achievements.filter((a) => a.village === 'home').length,
    builderBase: player.achievements.filter((a) => a.village === 'builderBase').length,
    clanCapital: player.achievements.filter((a) => a.village === 'clanCapital').length,
  };

  // Each village pill leads with its own hall art - the same pairing the Bases
  // village toggle uses - and carries the number of awards it would switch to.
  // The Clan Capital has no package art, so it falls back to its icon.
  const pillImage: Record<AchievementVillageFilter, number | null> = {
    all: STARS_IMAGE,
    home: getTownHallImageSource(player.townHallLevel),
    builderBase: getBuildingItemImage('Builder Hall', player.builderHallLevel, true),
    clanCapital: null,
  };

  // Villages with no awards are dropped, matching the Bases, Armies and Hero
  // Journey screens. "All" always stays so there is a way back to everything.
  const availablePills = ACHIEVEMENT_FILTER_PILLS.filter(
    (f) => f.key === 'all' || achievementVillageCounts[f.key] > 0
  );

  // If the active village stops existing there is nothing to show, so fall back to
  // the first available pill rather than leaving an empty screen behind.
  const activeFilter = availablePills.some((f) => f.key === achievementVillageFilter)
    ? achievementVillageFilter
    : availablePills[0]?.key ?? 'all';

  const activeAchievements = activeFilter === 'all'
    ? player.achievements
    : player.achievements.filter((a) => a.village === activeFilter);
  const activeStarTotals = getTotalStars(activeAchievements);
  const activeGroups = groupAchievementsByStars(activeAchievements);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Awards</Text>
          <Text style={styles.subtitle}>Milestones across all villages</Text>
        </View>
        {player.achievements.length === 0 ? (
          <View style={styles.center}>
            <EmptyState
              icon="🏆"
              title="No achievements yet"
              description="Complete in-game milestones to earn achievements. Pull to refresh after playing."
            />
          </View>
        ) : (
          <>
            <View style={styles.achievementSummary}>
              <View style={styles.achievementSummaryRow}>
                <View style={styles.achievementSummaryIcon}>
                  <Ionicons name="star-outline" size={16} color={Colors.textPrimary} />
                </View>
                <View style={styles.achievementSummaryText}>
                  <Text style={styles.achievementSummaryTitle}>
                    {activeStarTotals.earned}/{activeStarTotals.max} stars
                  </Text>
                  <Text style={styles.achievementSummarySub}>
                    {activeAchievements.filter((a) => a.stars === 3).length}/{activeAchievements.length} complete
                  </Text>
                </View>
                <Text style={styles.achievementSummaryPct}>
                  {activeStarTotals.max > 0 ? Math.round((activeStarTotals.earned / activeStarTotals.max) * 100) : 0}%
                </Text>
              </View>
              <View style={styles.achievementSummaryBarRow}>
                <View style={styles.achievementSummaryBar}>
                  <View
                    style={[
                      styles.achievementSummaryFill,
                      { width: `${activeStarTotals.max > 0 ? (activeStarTotals.earned / activeStarTotals.max) * 100 : 0}%` },
                    ]}
                  />
                </View>
              </View>
            </View>

            <View style={styles.filterSection}>
              <View style={styles.pillRow}>
                {availablePills.map((pill, ci) => {
                  const isActive = pill.key === activeFilter;
                  const count = achievementVillageCounts[pill.key];
                  return (
                    <PressableRipple
                      key={pill.key}
                      onPress={() => setAchievementVillageFilter(pill.key)}
                      style={[
                        styles.pill,
                        pillCornerStyle(ci, availablePills.length),
                        isActive && styles.pillActive,
                      ]}
                    >
                      {pillImage[pill.key] != null ? (
                        <Image source={pillImage[pill.key]!} style={styles.pillImg} resizeMode="contain" />
                      ) : (
                        <Ionicons
                          name={pill.icon}
                          size={15}
                          color={isActive ? Colors.bg : Colors.textSecondary}
                        />
                      )}
                      <View style={styles.pillTextCol}>
                        <Text style={[styles.pillText, isActive && styles.pillTextActive]} numberOfLines={1}>
                          {pill.label}
                        </Text>
                        <Text style={[styles.pillSubText, isActive && styles.pillSubTextActive]} numberOfLines={1}>
                          {`${count} award${count === 1 ? '' : 's'}`}
                        </Text>
                      </View>
                    </PressableRipple>
                  );
                })}
              </View>
            </View>

            {activeAchievements.length === 0 ? (
              <EmptyState
                icon="🏆"
                title="No achievements in this village"
                description="Try another filter or sync your profile."
              />
            ) : (
              <View style={{ paddingHorizontal: Spacing.base }}>
                {activeGroups.map((group) => (
                  <View key={group.group}>
                    <SectionHeader title={`${group.label} (${group.items.length})`} />
                    {group.items.map((a, idx) => {
                      const key = `${a.name}-${a.village}-${idx}`;
                      return (
                        <AchievementCard
                          key={key}
                          achievement={a}
                          expanded={expandedAchievement === key}
                          showVillage={activeFilter === 'all'}
                          isFirst={idx === 0}
                          isLast={idx === group.items.length - 1}
                          onPress={() => setExpandedAchievement(expandedAchievement === key ? null : key)}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingBottom: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  achievementSummary: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: Spacing.lg,
  },
  achievementSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  achievementSummaryIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementSummaryText: {
    flex: 1,
  },
  achievementSummaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  achievementSummarySub: {
    fontSize: 12,
    color: Colors.textTertiary,
    opacity: 0.85,
  },
  achievementSummaryPct: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  achievementSummaryBarRow: {
    marginTop: Spacing.sm,
  },
  achievementSummaryBar: {
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  achievementSummaryFill: {
    height: '100%',
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },
  filterSection: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
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
});
