import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { HomeScreenSkeleton } from '../../src/components/SkeletonScreens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { useGameData } from '../../src/hooks/useGameData';
import { getMaxLevelAtTH, getUnlockableItems } from '../../src/utils/thMaxLevels';
import { getTroopImageUrl, getHeroImageUrl, getEquipmentImageUrl } from '../../src/utils/troopImages';
import { getTownHallImageUrl } from '../../src/utils/thImages';
import { Card } from '../../src/components/Card';
import { ProgressSummaryCard } from '../../src/components/ProgressSummaryCard';
import { getTroopDetail } from '../../src/api/troopDetail';

export default function HomeScreen() {
  const router = useRouter();
  const { player, loading, error, lastSync, refresh } = usePlayer();
  const { superTroopNames } = useGameData();
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
  const homeTroops = player.troops.filter((t) => {
    if (t.village !== 'home') return false;
    if (superTroopNames.includes(t.name) || t.name.startsWith('Super ') || t.name.startsWith('Sneaky ') || t.name.startsWith('Rocket ')) return false;
    return true;
  });
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

  const ownedNames = new Set([
    ...player.troops.map((t: { name: string }) => t.name.toLowerCase()),
    ...player.spells.map((s: { name: string }) => s.name.toLowerCase()),
  ]);
  const unlockableItems = getUnlockableItems(th, ownedNames);

  const prevTh = Math.max(1, th - 1);
  const rushedItems: { name: string; currentLevel: number; maxLevelAtPrevTH: number; type: string }[] = [];
  if (th > 1) {
    for (const t of homeTroops) {
      const maxPrev = getMaxLevelAtTH(t.name, prevTh);
      if (maxPrev !== null && t.level < maxPrev) rushedItems.push({ name: t.name, currentLevel: t.level, maxLevelAtPrevTH: maxPrev, type: 'troop' });
    }
    for (const h of homeHeroes) {
      const maxPrev = getMaxLevelAtTH(h.name, prevTh);
      if (maxPrev !== null && h.level < maxPrev) rushedItems.push({ name: h.name, currentLevel: h.level, maxLevelAtPrevTH: maxPrev, type: 'hero' });
    }
    for (const s of homeSpells) {
      const maxPrev = getMaxLevelAtTH(s.name, prevTh);
      if (maxPrev !== null && s.level < maxPrev) rushedItems.push({ name: s.name, currentLevel: s.level, maxLevelAtPrevTH: maxPrev, type: 'spell' });
    }
    for (const e of player.heroEquipment) {
      const maxPrev = getMaxLevelAtTH(e.name, prevTh);
      if (maxPrev !== null && e.level < maxPrev) rushedItems.push({ name: e.name, currentLevel: e.level, maxLevelAtPrevTH: maxPrev, type: 'equipment' });
    }
  }

  const [upgradesOpen, setUpgradesOpen] = useState(false);
  const [upgradeCosts, setUpgradeCosts] = useState<Record<string, { cost: number; timeSeconds: number }> | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const fetchedRef = useRef(false);

  const [rushedOpen, setRushedOpen] = useState(false);
  const [rushedCosts, setRushedCosts] = useState<Record<string, { cost: number; timeSeconds: number }> | null>(null);
  const [loadingRushedCosts, setLoadingRushedCosts] = useState(false);
  const rushedFetchedRef = useRef(false);

  useEffect(() => {
    if (!upgradesOpen || fetchedRef.current || unlockableItems.length === 0) return;
    fetchedRef.current = true;
    setLoadingCosts(true);

    const parseCost = (s: string): number => {
      const cleaned = s.replace(/[^0-9.KkMmBb]/g, '');
      if (!cleaned) return 0;
      const num = parseFloat(cleaned);
      if (isNaN(num)) return 0;
      if (/b/i.test(cleaned)) return num * 1_000_000_000;
      if (/m/i.test(cleaned)) return num * 1_000_000;
      if (/k/i.test(cleaned)) return num * 1_000;
      return num;
    };

    const parseTime = (s: string): number => {
      if (!s || /[—\-]/.test(s)) return 0;
      const d = s.match(/(\d+)\s*d/);
      const h = s.match(/(\d+)\s*h/);
      const m = s.match(/(\d+)\s*m/);
      return (d ? parseInt(d[1]) * 86400 : 0) + (h ? parseInt(h[1]) * 3600 : 0) + (m ? parseInt(m[1]) * 60 : 0);
    };

    (async () => {
      const results: Record<string, { cost: number; timeSeconds: number }> = {};
      await Promise.all(unlockableItems.map(async (item) => {
        const maxLvl = getMaxLevelAtTH(item.name, th);
        if (!maxLvl) return;
        const detail = await getTroopDetail(item.name);
        if (!detail?.levels) return;
        let cost = 0;
        let timeSeconds = 0;
        for (const lvl of detail.levels) {
          if (lvl.level > maxLvl) break;
          if (lvl.upgradeCost) cost += parseCost(lvl.upgradeCost);
          if (lvl.upgradeTime) timeSeconds += parseTime(lvl.upgradeTime);
        }
        if (cost > 0 || timeSeconds > 0) results[item.name] = { cost, timeSeconds };
      }));
      setUpgradeCosts(results);
      setLoadingCosts(false);
    })();
  }, [upgradesOpen, th, unlockableItems]);

  const parseCost = (s: string): number => {
    const cleaned = s.replace(/[^0-9.KkMmBb]/g, '');
    if (!cleaned) return 0;
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    if (/b/i.test(cleaned)) return num * 1_000_000_000;
    if (/m/i.test(cleaned)) return num * 1_000_000;
    if (/k/i.test(cleaned)) return num * 1_000;
    return num;
  };

  const parseTime = (s: string): number => {
    if (!s || /[—\-]/.test(s)) return 0;
    const d = s.match(/(\d+)\s*d/);
    const h = s.match(/(\d+)\s*h/);
    const m = s.match(/(\d+)\s*m/);
    return (d ? parseInt(d[1]) * 86400 : 0) + (h ? parseInt(h[1]) * 3600 : 0) + (m ? parseInt(m[1]) * 60 : 0);
  };

  useEffect(() => {
    if (!rushedOpen || rushedFetchedRef.current || rushedItems.length === 0) return;
    rushedFetchedRef.current = true;
    setLoadingRushedCosts(true);

    (async () => {
      const results: Record<string, { cost: number; timeSeconds: number }> = {};
      await Promise.all(rushedItems.map(async (item) => {
        const detail = await getTroopDetail(item.name);
        if (!detail?.levels) return;
        let cost = 0;
        let timeSeconds = 0;
        for (const lvl of detail.levels) {
          if (lvl.level > item.maxLevelAtPrevTH) break;
          if (lvl.level <= item.currentLevel) continue;
          if (lvl.upgradeCost) cost += parseCost(lvl.upgradeCost);
          if (lvl.upgradeTime) timeSeconds += parseTime(lvl.upgradeTime);
        }
        if (cost > 0 || timeSeconds > 0) results[item.name] = { cost, timeSeconds };
      }));
      setRushedCosts(results);
      setLoadingRushedCosts(false);
    })();
  }, [rushedOpen, rushedItems]);

  const fmtCost = (n: number): string => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
  };

  const fmtTime = (s: number): string => {
    if (s <= 0) return '';
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${Math.floor(s / 60)}m`;
  };

  const aggregateCost = upgradeCosts ? Object.values(upgradeCosts).reduce((sum, v) => sum + v.cost, 0) : 0;
  const aggregateTime = upgradeCosts ? Object.values(upgradeCosts).reduce((sum, v) => sum + v.timeSeconds, 0) : 0;
  const aggregateRushedCost = rushedCosts ? Object.values(rushedCosts).reduce((sum, v) => sum + v.cost, 0) : 0;
  const aggregateRushedTime = rushedCosts ? Object.values(rushedCosts).reduce((sum, v) => sum + v.timeSeconds, 0) : 0;

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
              : 'The Prime Clash experience, like never before'}
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
            lockedMessage={homeHeroes.length === 0 ? 'Unlocks at TH7' : undefined}
            items={homeHeroes.filter((h: { level: number; name: string }) => {
              const max = getMaxLevelAtTH(h.name, th);
              return max !== null ? h.level < max : false;
            })}
            onPress={() => router.push('/(tabs)/army?tab=heroes')}
          />
          <ProgressSummaryCard
            category="Troops"
            completed={troopsMaxed}
            total={homeTroops.length}
            onPress={() => router.push('/(tabs)/army?tab=troops')}
          />
          <ProgressSummaryCard
            category="Spells"
            completed={spellsMaxed}
            total={homeSpells.length}
            lockedMessage={homeSpells.length === 0 ? 'Unlocks at TH5' : undefined}
            onPress={() => router.push('/(tabs)/army?tab=spells')}
          />
          <ProgressSummaryCard
            category="Equipment"
            completed={equipMaxed}
            total={player.heroEquipment.length}
            lockedMessage={player.heroEquipment.length === 0 ? 'Unlocks at TH15' : undefined}
            onPress={() => router.push('/(tabs)/army?tab=equipment')}
          />
        </View>

        {unlockableItems.length > 0 && (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionTitle}>Available Upgrades</Text>
            </View>
            <View style={styles.upgradeCard}>
              <Pressable style={styles.upgradeHeader} onPress={() => setUpgradesOpen((v) => !v)}>
                <View style={styles.upgradeHeaderLeft}>
                  <Ionicons name="arrow-up-circle-outline" size={16} color={Colors.textPrimary} />
                  <Text style={styles.upgradeHeaderText}>{unlockableItems.length} locked</Text>
                  {loadingCosts && <Text style={styles.upgradeHeaderMeta}> …</Text>}
                  {!loadingCosts && upgradeCosts && aggregateCost > 0 && (
                    <Text style={styles.upgradeHeaderMeta}>· {fmtCost(aggregateCost)}{aggregateTime > 0 ? ` · ${fmtTime(aggregateTime)}` : ''}</Text>
                  )}
                </View>
                <Ionicons name={upgradesOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textTertiary} />
              </Pressable>
              {upgradesOpen && (() => {
                let lastTh = -1;
                return unlockableItems.flatMap((item, i) => {
                  const troopUrl = getTroopImageUrl(item.name);
                  const thUrl = getTownHallImageUrl(item.unlockTh);
                  const levelsAtTH = getMaxLevelAtTH(item.name, th);
                  const isNewTh = item.unlockTh !== lastTh;
                  lastTh = item.unlockTh;
                  const elements: React.ReactNode[] = [];
                  if (isNewTh) {
                    elements.push(
                      <View key={`th-${item.unlockTh}`} style={[styles.upgradeThSection, i > 0 && styles.upgradeThSectionBorder]}>
                        <Image source={{ uri: thUrl! }} style={styles.upgradeThSectionIcon} resizeMode="contain" />
                        <Text style={styles.upgradeThSectionTitle}>Town Hall {item.unlockTh}</Text>
                      </View>
                    );
                  }
                  const itemCost = upgradeCosts?.[item.name];
                  elements.push(
                    <View key={item.name} style={[styles.upgradeRow, i < unlockableItems.length - 1 && styles.upgradeRowBorder]}>
                      <View style={styles.upgradeIconWrap}>
                        {troopUrl ? (
                          <Image source={{ uri: troopUrl }} style={styles.upgradeIcon} resizeMode="contain" />
                        ) : (
                          <Ionicons name={item.type === 'spell' ? 'flask-outline' : 'person-outline'} size={16} color={Colors.textTertiary} />
                        )}
                      </View>
                      <View style={styles.upgradeInfo}>
                        <Text style={styles.upgradeName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.upgradeHint}>{levelsAtTH} {levelsAtTH === 1 ? 'level' : 'levels'} at TH{th}</Text>
                      </View>
                      {itemCost ? (
                        <View style={styles.upgradeCostPill}>
                          <Text style={styles.upgradeCostText}>{fmtCost(itemCost.cost)}</Text>
                          {itemCost.timeSeconds > 0 && <Text style={styles.upgradeCostSub}>{fmtTime(itemCost.timeSeconds)}</Text>}
                        </View>
                      ) : loadingCosts ? (
                        <View style={styles.upgradeCostPill}>
                          <Text style={styles.upgradeCostText}>…</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                  return elements;
                });
              })()}
            </View>
          </>
        )}

        {rushedItems.length > 0 && (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionTitle}>Rushed</Text>
            </View>
            <View style={styles.upgradeCard}>
              <Pressable style={styles.upgradeHeader} onPress={() => setRushedOpen((v) => !v)}>
                <View style={styles.upgradeHeaderLeft}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
                  <Text style={styles.upgradeHeaderText}>{rushedItems.length} rushed</Text>
                  {loadingRushedCosts && <Text style={styles.upgradeHeaderMeta}> …</Text>}
                  {!loadingRushedCosts && rushedCosts && aggregateRushedCost > 0 && (
                    <Text style={styles.upgradeHeaderMeta}>· {fmtCost(aggregateRushedCost)}{aggregateRushedTime > 0 ? ` · ${fmtTime(aggregateRushedTime)}` : ''}</Text>
                  )}
                </View>
                <Ionicons name={rushedOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textTertiary} />
              </Pressable>
              {rushedOpen && (() => {
                const groups: { label: string; key: string; icon: string; items: typeof rushedItems }[] = [
                  { label: 'Heroes', key: 'hero', icon: 'shield-half-outline', items: [] },
                  { label: 'Troops', key: 'troop', icon: 'sword-cross', items: [] },
                  { label: 'Spells', key: 'spell', icon: 'flask-outline', items: [] },
                  { label: 'Equipment', key: 'equipment', icon: 'trophy-outline', items: [] },
                ];
                for (const item of rushedItems) {
                  const g = groups.find((g) => g.key === item.type);
                  if (g) g.items.push(item);
                }
                const visible = groups.filter((g) => g.items.length > 0);
                return visible.flatMap((group, gi) => {
                  const elements: React.ReactNode[] = [];
                  if (gi > 0) {
                    elements.push(<View key={`rs-sep-${gi}`} style={styles.upgradeThSectionBorder} />);
                  }
                  elements.push(
                    <View key={`rs-hdr-${group.key}`} style={styles.upgradeThSection}>
                      <Ionicons name={group.icon as any} size={14} color={Colors.textTertiary} />
                      <Text style={styles.upgradeThSectionTitle}>{group.label} ({group.items.length})</Text>
                    </View>
                  );
                  group.items.forEach((item, i) => {
                    const iconUrl = item.type === 'hero' ? getHeroImageUrl(item.name) : item.type === 'equipment' ? getEquipmentImageUrl(item.name) : getTroopImageUrl(item.name);
                    const costData = rushedCosts?.[item.name];
                    elements.push(
                      <View key={item.name} style={[styles.upgradeRow, i < group.items.length - 1 && styles.upgradeRowBorder]}>
                        <View style={styles.upgradeIconWrap}>
                          {iconUrl ? (
                            <Image source={{ uri: iconUrl }} style={styles.upgradeIcon} resizeMode="contain" />
                          ) : (
                            <Ionicons name="person-outline" size={16} color={Colors.textTertiary} />
                          )}
                        </View>
                        <View style={styles.upgradeInfo}>
                          <Text style={styles.upgradeName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.upgradeHint}>Lv{item.currentLevel} → Lv{item.maxLevelAtPrevTH}</Text>
                        </View>
                        {costData ? (
                          <View style={styles.upgradeCostPill}>
                            <Text style={styles.upgradeCostText}>{fmtCost(costData.cost)}</Text>
                            {costData.timeSeconds > 0 && <Text style={styles.upgradeCostSub}>{fmtTime(costData.timeSeconds)}</Text>}
                          </View>
                        ) : loadingRushedCosts ? (
                          <View style={styles.upgradeCostPill}>
                            <Text style={styles.upgradeCostText}>…</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  });
                  return elements;
                });
              })()}
            </View>
          </>
        )}

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/(tabs)/saved')}>
            <Ionicons name="bookmarks-outline" size={16} color={Colors.textPrimary} />
            <Text style={styles.actionText}>Saved</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/(tabs)/war')}>
            <Ionicons name="flag-outline" size={16} color={Colors.textPrimary} />
            <Text style={styles.actionText}>War</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => router.push('/(tabs)/settings')}>
            <Ionicons name="settings-sharp" size={16} color={Colors.textPrimary} />
            <Text style={styles.actionText}>Settings</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={16} color={Colors.textPrimary} />
            <Text style={styles.actionText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
        </View>

        <View style={styles.statsTable}>
          {[
            {
              title: 'PvP',
              rows: [
                { label: 'Trophies', value: player.trophies, icon: 'trophy-outline' as const },
                { label: 'Best Trophies', value: player.bestTrophies, icon: 'trophy' as const, accentColor: Colors.warning },
                { label: 'War Stars', value: player.warStars, icon: 'star-outline' as const },
                { label: 'Attack Wins', value: player.attackWins, icon: 'flame-outline' as const },
                { label: 'Defense Wins', value: player.defenseWins, icon: 'shield-outline' as const },
              ],
            },
            {
              title: 'Clan',
              rows: [
                { label: 'Donations', value: player.donations, icon: 'gift-outline' as const },
                { label: 'Received', value: player.donationsReceived, icon: 'arrow-down-outline' as const, accentColor: player.donationsReceived > player.donations ? Colors.success : undefined },
                { label: 'Capital Gold', value: player.clanCapitalContributions, icon: 'cash-outline' as const },
              ],
            },
            {
              title: 'Builder Base',
              rows: [
                ...(player.builderBaseTrophies !== undefined
                  ? [{ label: 'Builder Trophies', value: player.builderBaseTrophies, icon: 'hammer-outline' as const }]
                  : []),
                ...(player.bestBuilderBaseTrophies !== undefined
                  ? [{ label: 'Best Builder', value: player.bestBuilderBaseTrophies, icon: 'hammer' as const, accentColor: Colors.warning }]
                  : []),
              ],
            },
          ].filter((g) => g.rows.length > 0).flatMap((group, gi, arr) => [
            gi > 0 ? <View key={`sep-${gi}`} style={styles.statsRowSep} /> : null,
            <View key={`hdr-${gi}`} style={styles.statsGroupHeader}>
              <Text style={styles.statsGroupTitle}>{group.title}</Text>
            </View>,
            ...group.rows.map((row, ri) => (
              <View
                key={`${group.title}-${ri}`}
                style={[styles.statsRow, row.accentColor ? { borderLeftColor: row.accentColor } : null]}
              >
                <Ionicons name={row.icon} size={13} color={Colors.textTertiary} style={styles.statsIcon} />
                <Text style={styles.statsLabel}>{row.label}</Text>
                <Text style={[styles.statsValue, row.accentColor ? { color: row.accentColor } : null]}>
                  {typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
                </Text>
              </View>
            )),
          ])}
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
    marginBottom: Spacing.sm
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
    borderRadius: Radius.sm,
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
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
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
    gap: Spacing.xs,
  },
  statsTable: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  statsGroupHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.bgCard,
  },
  statsGroupTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.base,
    borderLeftWidth: 2.5,
    borderLeftColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  statsIcon: {
    marginRight: Spacing.sm,
  },
  statsLabel: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'left',
  },
  statsValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  statsRowSep: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.md,
  },
  upgradeCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  upgradeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  upgradeHeaderText: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  upgradeHeaderMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  upgradeRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  upgradeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  upgradeIcon: {
    width: 26,
    height: 26,
  },
  upgradeInfo: {
    flex: 1,
  },
  upgradeName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  upgradeHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  upgradeThSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.bgSubtle,
  },
  upgradeThSectionBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  upgradeThSectionIcon: {
    width: 18,
    height: 18,
  },
  upgradeThSectionTitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  upgradeCostPill: {
    alignItems: 'flex-end',
    gap: 1,
  },
  upgradeCostText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontSize: 10,
  },
  upgradeCostSub: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    fontSize: 9,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  actionBtn: {
    width: '49%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  actionText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
    fontSize: 11,
    textAlign: 'left',
    marginLeft: 24,
  },
});
