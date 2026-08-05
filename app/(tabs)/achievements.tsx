import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
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
import type { Village } from '../../src/types/clash';

type AchievementVillageFilter = 'all' | Village;

export default function AchievementsScreen() {
  const { player, loading, refresh } = usePlayer();
  const { colors } = useTheme();
  const [achievementVillageFilter, setAchievementVillageFilter] = useState<AchievementVillageFilter>('all');
  const [expandedAchievement, setExpandedAchievement] = useState<string | null>(null);

  if (loading || !player) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredAchievements = achievementVillageFilter === 'all'
    ? player.achievements
    : player.achievements.filter((a) => a.village === achievementVillageFilter);
  const achievementGroups = groupAchievementsByStars(filteredAchievements);
  const starTotals = getTotalStars(filteredAchievements);
  const achievementVillageCounts = {
    all: player.achievements.length,
    home: player.achievements.filter((a) => a.village === 'home').length,
    builderBase: player.achievements.filter((a) => a.village === 'builderBase').length,
    clanCapital: player.achievements.filter((a) => a.village === 'clanCapital').length,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
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
                    {starTotals.earned}/{starTotals.max} stars
                  </Text>
                  <Text style={styles.achievementSummarySub}>
                    {filteredAchievements.filter((a) => a.stars === 3).length}/{filteredAchievements.length} complete
                  </Text>
                </View>
                <Text style={styles.achievementSummaryPct}>
                  {starTotals.max > 0 ? Math.round((starTotals.earned / starTotals.max) * 100) : 0}%
                </Text>
              </View>
              <View style={styles.achievementSummaryBarRow}>
                <View style={styles.achievementSummaryBar}>
                  <View
                    style={[
                      styles.achievementSummaryFill,
                      { width: `${starTotals.max > 0 ? (starTotals.earned / starTotals.max) * 100 : 0}%` },
                    ]}
                  />
                </View>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.achievementFilters}
            >
              {([
                { key: 'all' as const, label: 'All', icon: 'planet-outline' as const },
                { key: 'home' as const, label: 'Home', icon: 'home-outline' as const },
                { key: 'builderBase' as const, label: 'Builder', icon: 'hammer-outline' as const },
                { key: 'clanCapital' as const, label: 'Capital', icon: 'flag-outline' as const },
              ]).filter((f) => f.key === 'all' || achievementVillageCounts[f.key] > 0).map((f) => (
                <PressableRipple
                  key={f.key}
                  onPress={() => setAchievementVillageFilter(f.key)}
                  style={[
                    styles.achievementFilterPill,
                    achievementVillageFilter === f.key && styles.achievementFilterPillActive,
                  ]}
                >
                  <Ionicons
                    name={f.icon}
                    size={12}
                    color={achievementVillageFilter === f.key ? Colors.bg : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.achievementFilterText,
                      achievementVillageFilter === f.key && styles.achievementFilterTextActive,
                    ]}
                  >
                    {f.label}
                    {f.key !== 'all' ? ` (${achievementVillageCounts[f.key]})` : ''}
                  </Text>
                </PressableRipple>
              ))}
            </ScrollView>

            {filteredAchievements.length === 0 ? (
              <EmptyState
                icon="🏆"
                title="No achievements in this village"
                description="Try another filter or sync your profile."
              />
            ) : (
              <View style={{ paddingHorizontal: Spacing.base }}>
                {achievementGroups.map((group) => (
                  <View key={group.group}>
                    <SectionHeader title={`${group.label} (${group.items.length})`} />
                    {group.items.map((a, idx) => {
                      const key = `${a.name}-${a.village}-${idx}`;
                      return (
                        <AchievementCard
                          key={key}
                          achievement={a}
                          expanded={expandedAchievement === key}
                          showVillage={achievementVillageFilter === 'all'}
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
  achievementFilters: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
  },
  achievementFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  achievementFilterPillActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  achievementFilterText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  achievementFilterTextActive: {
    color: Colors.bg,
  },
});
