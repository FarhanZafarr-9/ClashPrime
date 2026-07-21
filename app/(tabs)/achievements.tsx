import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { AchievementCard } from '../../src/components/AchievementCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { groupAchievements, getTotalStars } from '../../src/utils/achievements';
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
  const achievementGroups = groupAchievements(filteredAchievements);
  const starTotals = getTotalStars(filteredAchievements);
  const achievementVillageCounts = {
    all: player.achievements.length,
    home: player.achievements.filter((a) => a.village === 'home').length,
    builderBase: player.achievements.filter((a) => a.village === 'builderBase').length,
    clanCapital: player.achievements.filter((a) => a.village === 'clanCapital').length,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
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
              <View style={styles.achievementSummaryTop}>
                <Text style={styles.achievementSummaryTitle}>
                  {starTotals.earned} / {starTotals.max} stars
                </Text>
                <Text style={styles.achievementSummarySub}>
                  {filteredAchievements.filter((a) => a.stars === 3).length} complete
                </Text>
              </View>
              <View style={styles.achievementSummaryBar}>
                <View
                  style={[
                    styles.achievementSummaryFill,
                    { width: `${starTotals.max > 0 ? (starTotals.earned / starTotals.max) * 100 : 0}%` },
                  ]}
                />
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
                <Pressable
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
                </Pressable>
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
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: Spacing.lg,
  },
  achievementSummaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  achievementSummaryTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  achievementSummarySub: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  achievementSummaryBar: {
    height: 4,
    backgroundColor: Colors.borderSubtle,
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
    borderWidth: 1,
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
