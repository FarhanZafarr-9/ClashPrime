import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { HomeScreenSkeleton } from '../../src/components/SkeletonScreens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { filterHomeTroops } from '../../src/types/clash';
import { getMaxLevelAtTH } from '../../src/utils/thMaxLevels';
import { getTownHallImageUrl } from '../../src/utils/thImages';
import { Card } from '../../src/components/Card';
import { ProgressSummaryCard } from '../../src/components/ProgressSummaryCard';

export default function HomeScreen() {
  const { player, loading, error, lastSync, refresh } = usePlayer();
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    if (error && player) {
      Alert.alert('Sync Error', error, [{ text: 'OK' }]);
    }
  }, [error, player]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  if (loading && !player) {
    return <HomeScreenSkeleton />;
  }

  if (error && !player) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={refresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!player) return null;

  const homeHeroes = player.heroes.filter((h: { village: string }) => h.village === 'home');
  const homeTroops = filterHomeTroops(player.troops);
  const homeSpells = player.spells.filter((s: { village?: string }) => s.village === 'home' || !s.village);
  const th = player.townHallLevel;

  const heroesMaxed = homeHeroes.filter((h) => {
    const max = getMaxLevelAtTH(h.name, th);
    return max !== null ? h.level >= max : h.level >= h.maxLevel;
  }).length;
  const troopsMaxed = homeTroops.filter((t) => {
    const max = getMaxLevelAtTH(t.name, th);
    return max !== null ? t.level >= max : t.level >= t.maxLevel;
  }).length;
  const spellsMaxed = homeSpells.filter((s) => {
    const max = getMaxLevelAtTH(s.name, th);
    return max !== null ? s.level >= max : s.level >= s.maxLevel;
  }).length;
  const equipMaxed = player.heroEquipment.filter((e) => e.level >= e.maxLevel).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.textSecondary}
            colors={[Colors.textSecondary]}
            progressBackgroundColor={Colors.bgCard}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>ClashPrime</Text>
          <Text style={styles.timestamp}>
            {lastSync
              ? `Synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Pull to refresh'}
          </Text>
        </View>

        <Card style={styles.playerCard}>
          <View style={styles.playerRow}>
            <View style={styles.avatar}>
              {getTownHallImageUrl(player.townHallLevel) ? (
                <Image
                  source={{ uri: getTownHallImageUrl(player.townHallLevel)! }}
                  style={styles.avatarImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.avatarText}>{player.name.charAt(0)}</Text>
              )}
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.playerTag}>{player.tag}</Text>
              <View style={styles.playerMeta}>
                {player.clan && (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaText}>{player.clan.name}</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>Lv.{player.clan.clanLevel}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.thBadge}>
              <Text style={styles.thLevel}>{player.townHallLevel}</Text>
              <Text style={styles.thLabel}>TH</Text>
            </View>
          </View>
          <View style={styles.playerStatsRow}>
            <View style={styles.miniStat}>
              <Ionicons name="trophy-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.miniStatValue}>{player.bestTrophies.toLocaleString()}</Text>
            </View>
            <View style={styles.miniStat}>
              <Ionicons name="star-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.miniStatValue}>{player.warStars.toLocaleString()}</Text>
            </View>
            <View style={styles.miniStat}>
              <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.miniStatValue}>{player.expLevel}</Text>
            </View>
            <View style={styles.miniStat}>
              <Ionicons name="arrow-up-outline" size={14} color={Colors.textTertiary} />
              <Text style={styles.miniStatValue}>{player.leagueTier?.name?.split(' ')[0] || 'N/A'}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Progress Overview</Text>
        </View>

        <View style={styles.progressGrid}>
          <ProgressSummaryCard
            category="Heroes"
            completed={heroesMaxed}
            total={homeHeroes.length}
            lockedMessage={homeHeroes.length === 0 ? 'Unlocks at TH4' : undefined}
            items={homeHeroes.filter((h: { level: number; name: string }) => {
              const max = getMaxLevelAtTH(h.name, th);
              return max !== null ? h.level < max : false;
            })}
          />
          <ProgressSummaryCard
            category="Troops"
            completed={troopsMaxed}
            total={homeTroops.length}
          />
          <ProgressSummaryCard
            category="Spells"
            completed={spellsMaxed}
            total={homeSpells.length}
            lockedMessage={homeSpells.length === 0 ? 'Unlocks at TH5' : undefined}
          />
          <ProgressSummaryCard
            category="Equipment"
            completed={equipMaxed}
            total={player.heroEquipment.length}
            lockedMessage={player.heroEquipment.length === 0 ? 'Unlocks at TH15' : undefined}
          />
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
        </View>

        <View style={styles.statsTable}>
          <View style={styles.statsRow}>
            <Text style={[styles.statsCell, styles.statsHeader]}>Stat</Text>
            <Text style={[styles.statsCell, styles.statsHeader, { textAlign: 'right' }]}>Value</Text>
          </View>
          {[
            { label: 'Trophies', value: player.trophies },
            { label: 'Best Trophies', value: player.bestTrophies },
            { label: 'War Stars', value: player.warStars },
            { label: 'Donations', value: player.donations },
            { label: 'Received', value: player.donationsReceived },
            { label: 'Capital Gold', value: player.clanCapitalContributions },
            ...(player.builderBaseTrophies !== undefined
              ? [{ label: 'Builder Trophies', value: player.builderBaseTrophies }]
              : []),
          ].map((s) => (
            <View
              key={s.label}
              style={[styles.statsRow, { backgroundColor: Colors.bgCard }]}
            >
              <Text style={[styles.statsCell, { color: Colors.textSecondary, textAlign: 'left' }]}>{s.label}</Text>
              <Text
                style={[
                  styles.statsCell,
                  { color: Colors.textPrimary, fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },
                ]}
              >
                {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn}>
            <Ionicons name="grid-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.actionText}>View Bases</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.actionText}>Refresh</Text>
          </Pressable>
        </View>

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
    paddingBottom: 80,
  },
  loadingText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  errorTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
  },
  errorText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    maxWidth: 280,
  },
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.full,
    marginTop: Spacing.sm,
  },
  retryText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  greeting: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  timestamp: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  playerCard: {
    marginHorizontal: Spacing.base,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.lg,
  },
  avatarText: {
    ...Typography.title2,
    color: Colors.textTertiary,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  playerTag: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  metaDot: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  thBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thLevel: {
    ...Typography.headline,
    color: Colors.bg,
    fontSize: 18,
    lineHeight: 20,
  },
  thLabel: {
    ...Typography.caption,
    color: Colors.bg,
    fontSize: 8,
    opacity: 0.7,
  },
  playerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.base,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatValue: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  sectionLabel: {
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
  },
  statsTable: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  statsCell: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    ...Typography.caption,
  },
  statsHeader: {
    backgroundColor: Colors.bgSubtle,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.base,
    borderRadius: Radius.lg,
  },
  actionText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
