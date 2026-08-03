import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Image,
  Alert,
  Modal,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  BackHandler,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import PressableRipple from '../../src/components/PressableRipple';
import { HomeScreenSkeleton } from '../../src/components/SkeletonScreens';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { useTimers } from '../../src/hooks/useTimerContext';
import { backfillAccountNames } from '../../src/hooks/usePlayer';
import { useGameData } from '../../src/hooks/useGameData';
import { getMaxLevelAtTH, getUnlockableItems, getAllItemsAtTH } from '../../src/utils/thMaxLevels';
import { getTroopImageUrl, getHeroImageUrl, getEquipmentImageUrl } from '../../src/utils/troopImages';
import { STAT_ICONS } from '../../src/utils/statImages';
import { getTownHallImageUrl } from '../../src/utils/thImages';
import { getBuildingLevelImageSource } from '../../src/utils/buildingImages';
import { Card } from '../../src/components/Card';
import { ProgressSummaryCard } from '../../src/components/ProgressSummaryCard';
import { getTroopDetail } from '../../src/api/troopDetail';
import { useDialog } from '../../src/components/AlertDialog';
import {
  loadProgressSnapshot,
  saveProgressSnapshot,
  diffProgress,
  ProgressSnapshot,
  ProgressCategory,
  ProgressDiff,
} from '../../src/hooks/useProgressSnapshot';
import type { ClashPlayer } from '../../src/types/clash';

const CATEGORY_META: Record<ProgressCategory, { label: string; icon: { set: 'ion' | 'mc'; name: string } }> = {
  heroes: { label: 'Heroes', icon: { set: 'ion', name: 'shield-half-outline' } },
  troops: { label: 'Troops', icon: { set: 'mc', name: 'sword-cross' } },
  spells: { label: 'Spells', icon: { set: 'ion', name: 'flask-outline' } },
  equipment: { label: 'Equipment', icon: { set: 'ion', name: 'trophy-outline' } },
};

export default function HomeScreen() {
  const router = useRouter();
  const { player, loading, error, lastSync, refresh, switchAccount, activeAccount, accounts } = usePlayer();
  const { superTroopNames } = useGameData();
  const { reminders, addTimer, dismissTimer } = useTimers();
  const { show: showDialog, Dialog } = useDialog();
  const [refreshing, setRefreshing] = useState(false);
  const [progressDiff, setProgressDiff] = useState<ProgressDiff | null>(null);
  const [addTimerVisible, setAddTimerVisible] = useState(false);
  const [timerLabel, setTimerLabel] = useState('');
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [addingTimer, setAddingTimer] = useState(false);
  const [showBH, setShowBH] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [switchingHome, setSwitchingHome] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (error && player) {
      Alert.alert('Sync Error', error, [{ text: 'OK' }]);
    }
  }, [error, player]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        showDialog({
          title: 'Exit ClashPrime?',
          message: 'Are you sure you want to close the app?',
          actions: [
            { label: 'Cancel', onPress: () => { } },
            { label: 'Exit', primary: true, destructive: true, onPress: () => BackHandler.exitApp() },
          ],
        });
        return true;
      });
      return () => sub.remove();
    }, [showDialog])
  );

  useEffect(() => {
    if (accounts.length > 0) {
      backfillAccountNames(accounts);
    }
  }, [accounts]);

  const handleHomeSwitch = useCallback(async (tag: string) => {
    if (tag === activeAccount?.tag || switchingHome) return;
    setSwitcherVisible(false);
    setSwitchingHome(true);
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    await switchAccount(tag);
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    setSwitchingHome(false);
  }, [switchAccount, activeAccount, switchingHome, fadeAnim]);

  const buildSnapshot = useCallback((p: ClashPlayer): ProgressSnapshot => {
    const th = p.townHallLevel ?? 0;
    const ownedTroops = (p.troops ?? []).filter((t) => {
      if (t.village !== 'home') return false;
      if (superTroopNames.includes(t.name) || t.name.startsWith('Super ') || t.name.startsWith('Sneaky ') || t.name.startsWith('Rocket ')) return false;
      return true;
    });
    const ownedSpells = (p.spells ?? []).filter((s: { village?: string }) => s.village === 'home' || !s.village);
    const ownedHeroes = (p.heroes ?? []).filter((h: { village: string }) => h.village === 'home');
    const equip = p.heroEquipment ?? [];

    const calc = (ownedItems: { name: string; level: number }[], allAtTH: { name: string; maxLevel: number }[]) => {
      if (allAtTH.length === 0) return 0;
      const ownedMap = new Map(ownedItems.map((i) => [i.name.toLowerCase(), i.level]));
      let sum = 0;
      for (const { name, maxLevel } of allAtTH) {
        const level = ownedMap.get(name.toLowerCase()) ?? 0;
        sum += maxLevel > 0 ? level / maxLevel : 0;
      }
      return Math.min(sum / allAtTH.length, 1);
    };

    const allTroopsAtTH = getAllItemsAtTH(th).filter((i) => i.type === 'troop');
    const allSpellsAtTH = getAllItemsAtTH(th).filter((i) => i.type === 'spell');
    const allHeroesAtTH = getAllItemsAtTH(th).filter((i) => i.type === 'hero');

    const itemsMap = (list: { name: string; level: number }[]) => {
      const m: Record<string, number> = {};
      for (const it of list) m[it.name] = it.level;
      return m;
    };

    return {
      timestamp: Date.now(),
      categories: {
        heroes: calc(ownedHeroes, allHeroesAtTH),
        troops: calc(ownedTroops, allTroopsAtTH),
        spells: calc(ownedSpells, allSpellsAtTH),
        equipment: equip.length > 0 ? equip.reduce((s, e) => s + (e.maxLevel > 0 ? e.level / e.maxLevel : 0), 0) / equip.length : 0,
      },
      items: {
        heroes: itemsMap(ownedHeroes),
        troops: itemsMap(ownedTroops),
        spells: itemsMap(ownedSpells),
        equipment: itemsMap(equip),
      },
    };
  }, [superTroopNames]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const tag = player?.tag;
    const baseline = tag ? await loadProgressSnapshot(tag) : null;
    const fresh = await refresh();
    if (tag && fresh) {
      const after = buildSnapshot(fresh);
      if (baseline) {
        const diff = diffProgress(baseline, after);
        if (diff.hasChanges) setProgressDiff(diff);
      }
      await saveProgressSnapshot(tag, after);
    }
    setRefreshing(false);
  }, [refresh, player?.tag, buildSnapshot]);

  // ── Derived data (null-safe when player is null) ──
  const th = player?.townHallLevel ?? 0;
  const homeHeroes = player?.heroes?.filter((h: { village: string }) => h.village === 'home') ?? [];
  const homeTroops = player?.troops?.filter((t) => {
    if (t.village !== 'home') return false;
    if (superTroopNames.includes(t.name) || t.name.startsWith('Super ') || t.name.startsWith('Sneaky ') || t.name.startsWith('Rocket ')) return false;
    return true;
  }) ?? [];
  const homeSpells = player?.spells?.filter((s: { village?: string }) => s.village === 'home' || !s.village) ?? [];
  const heroEquipment = player?.heroEquipment ?? [];

  const ownedNames = new Set([
    ...(player?.troops ?? []).map((t: { name: string }) => t.name.toLowerCase()),
    ...(player?.spells ?? []).map((s: { name: string }) => s.name.toLowerCase()),
    ...(player?.heroes ?? []).map((h: { name: string }) => h.name.toLowerCase()),
  ]);
  const unlockableItems = th > 0 ? getUnlockableItems(th, ownedNames) : [];

  const prevTh = Math.max(1, th - 1);
  const rushedItems: { name: string; currentLevel: number; maxLevelAtPrevTH: number; type: string }[] = [];
  if (th > 1 && player) {
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
    for (const e of heroEquipment) {
      const maxPrev = getMaxLevelAtTH(e.name, prevTh);
      if (maxPrev !== null && e.level < maxPrev) rushedItems.push({ name: e.name, currentLevel: e.level, maxLevelAtPrevTH: maxPrev, type: 'equipment' });
    }
  }

  // ── Cost helpers ──
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

  // ── State / refs / effects (must be before early returns) ──
  const [upgradesOpen, setUpgradesOpen] = useState(false);
  const [upgradeCosts, setUpgradeCosts] = useState<Record<string, { cost: number; timeSeconds: number }> | null>(null);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const upgradeFetchedKeyRef = useRef('');

  const [rushedOpen, setRushedOpen] = useState(false);
  const [rushedCosts, setRushedCosts] = useState<Record<string, { cost: number; timeSeconds: number }> | null>(null);
  const [loadingRushedCosts, setLoadingRushedCosts] = useState(false);
  const rushedFetchedKeyRef = useRef('');

  useEffect(() => {
    if (!upgradesOpen || unlockableItems.length === 0) return;
    const key = unlockableItems.map((i) => i.name).join(',');
    if (upgradeFetchedKeyRef.current === key) return;
    upgradeFetchedKeyRef.current = key;
    setLoadingCosts(true);

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

  useEffect(() => {
    if (!rushedOpen || rushedItems.length === 0) return;
    const key = rushedItems.map((i) => `${i.name}:${i.currentLevel}:${i.maxLevelAtPrevTH}`).join('|');
    if (rushedFetchedKeyRef.current === key) return;
    rushedFetchedKeyRef.current = key;
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

  // ── Aggregates ──
  const aggregateCost = upgradeCosts ? Object.values(upgradeCosts).reduce((sum, v) => sum + v.cost, 0) : 0;
  const aggregateTime = upgradeCosts ? Object.values(upgradeCosts).reduce((sum, v) => sum + v.timeSeconds, 0) : 0;
  const aggregateRushedCost = rushedCosts ? Object.values(rushedCosts).reduce((sum, v) => sum + v.cost, 0) : 0;
  const aggregateRushedTime = rushedCosts ? Object.values(rushedCosts).reduce((sum, v) => sum + v.timeSeconds, 0) : 0;

  // ── Early returns (hooks must not follow) ──
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
          <PressableRipple onPress={refresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </PressableRipple>
        </View>
      </SafeAreaView>
    );
  }

  if (!player) return null;

  // ── Player-guaranteed computations ──
  const calcProgress = (
    ownedItems: { name: string; level: number }[],
    allAtTH: { name: string; maxLevel: number }[],
  ) => {
    if (allAtTH.length === 0) return 0;
    const ownedMap = new Map(ownedItems.map((i) => [i.name.toLowerCase(), i.level]));
    let sum = 0;
    for (const { name, maxLevel } of allAtTH) {
      const level = ownedMap.get(name.toLowerCase()) ?? 0;
      sum += maxLevel > 0 ? level / maxLevel : 0;
    }
    return Math.min(sum / allAtTH.length, 1);
  };
  const allTroopsAtTH = getAllItemsAtTH(th).filter((i) => i.type === 'troop');
  const allSpellsAtTH = getAllItemsAtTH(th).filter((i) => i.type === 'spell');
  const allHeroesAtTH = getAllItemsAtTH(th).filter((i) => i.type === 'hero');
  const heroesProgress = calcProgress(homeHeroes, allHeroesAtTH);
  const troopsProgress = calcProgress(homeTroops, allTroopsAtTH);
  const spellsProgress = calcProgress(homeSpells, allSpellsAtTH);
  const equipProgress = heroEquipment.length > 0
    ? heroEquipment.reduce((s, e) => s + (e.maxLevel > 0 ? e.level / e.maxLevel : 0), 0) / heroEquipment.length
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
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
            <View style={styles.headerTitleRow}>
              <Text style={styles.greeting}>ClashPrime</Text>
              <PressableRipple style={styles.switchBtn} onPress={() => setSwitcherVisible(true)}>
                <Ionicons name="people-outline" size={18} color={Colors.textSecondary} />
              </PressableRipple>
            </View>
            <Text style={styles.timestamp}>
              {lastSync
                ? `Synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'The Prime Clash experience, like never before'}
            </Text>
          </View>

          <Card style={styles.playerCard}>
            <View style={styles.playerCardInner}>
              <View style={styles.playerRow}>
                <View style={styles.avatar}>
                  {showBH
                    ? (() => {
                      const bhSrc = getBuildingLevelImageSource('Builder Hall', player.builderHallLevel ?? 1);
                      return bhSrc ? (
                        <Image source={bhSrc} style={styles.avatarImage} resizeMode="contain" />
                      ) : (
                        <Text style={styles.avatarText}>BH</Text>
                      );
                    })()
                    : getTownHallImageUrl(player.townHallLevel) ? (
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
                        {player.clan.badgeUrls?.small ? (
                          <Image source={{ uri: player.clan.badgeUrls.small }} style={styles.metaBadge} resizeMode="contain" />
                        ) : null}
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.thBadge}>
                  <Text style={styles.thLevel}>{showBH ? (player.builderHallLevel ?? 1) : (player.townHallLevel ?? 0)}</Text>
                  <Text style={styles.thLabel}>{showBH ? 'BH' : 'TH'}</Text>
                </View>
              </View>
              <PressableRipple style={styles.collapseRow} onPress={() => setStatsOpen((v) => !v)}>
                <View style={styles.collapseRowIcon}>
                  <Ionicons name="stats-chart" size={16} color={Colors.textSecondary} />
                </View>
                <View style={styles.collapseRowText}>
                  <Text style={styles.collapseRowTitle}>Stats</Text>
                  <Text style={styles.collapseRowSub}>{showBH ? 'Builder Base' : 'Home Village'}</Text>
                </View>
                <Ionicons name={statsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
              </PressableRipple>
              {statsOpen && (
                <View style={styles.statsGrid}>
                  {showBH ? (
                    <>
                      <View style={styles.statCell}>
                        <Image source={getBuildingLevelImageSource('Builder Hall', player.builderHallLevel ?? 1)} style={styles.statCellIcon} resizeMode="contain" />
                        <View style={styles.statCellText}>
                          <Text style={styles.statCellValue}>BH{player.builderHallLevel ?? 1}</Text>
                          <Text style={styles.statCellLabel}>Builder Hall</Text>
                        </View>
                      </View>
                      <View style={styles.statCell}>
                        <Image source={STAT_ICONS.exp} style={styles.statCellIcon} resizeMode="contain" />
                        <View style={styles.statCellText}>
                          <Text style={styles.statCellValue}>{player.expLevel}</Text>
                          <Text style={styles.statCellLabel}>Exp Level</Text>
                        </View>
                      </View>
                      <View style={styles.statCell}>
                        <Image source={STAT_ICONS.bhTrophies} style={styles.statCellIcon} resizeMode="contain" />
                        <View style={styles.statCellText}>
                          <Text style={styles.statCellValue}>{player.builderBaseTrophies?.toLocaleString() ?? 'N/A'}</Text>
                          <Text style={styles.statCellLabel}>Trophies</Text>
                        </View>
                      </View>
                      <View style={styles.statCell}>
                        <Image source={STAT_ICONS.bhBestTrophies} style={styles.statCellIcon} resizeMode="contain" />
                        <View style={styles.statCellText}>
                          <Text style={[styles.statCellValue, { color: Colors.warning }]}>{player.bestBuilderBaseTrophies?.toLocaleString() ?? 'N/A'}</Text>
                          <Text style={styles.statCellLabel}>Best</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.statCell}>
                        {player.leagueTier?.iconUrls?.small ? (
                          <Image source={{ uri: player.leagueTier.iconUrls.small }} style={styles.statCellLeagueImage} resizeMode="contain" />
                        ) : (
                          <Ionicons name="arrow-up-outline" size={20} color={Colors.textSecondary} />
                        )}
                        <View style={styles.statCellText}>
                          <Text style={styles.statCellValue} numberOfLines={1}>{player.leagueTier?.name?.split(' ')[0] || 'N/A'}</Text>
                          <Text style={styles.statCellLabel}>League</Text>
                        </View>
                      </View>
                      <View style={styles.statCell}>
                        <Image source={STAT_ICONS.exp} style={styles.statCellIcon} resizeMode="contain" />
                        <View style={styles.statCellText}>
                          <Text style={styles.statCellValue}>{player.expLevel}</Text>
                          <Text style={styles.statCellLabel}>Exp Level</Text>
                        </View>
                      </View>
                      <View style={styles.statCell}>
                        <Image source={STAT_ICONS.bestTrophies} style={styles.statCellIcon} resizeMode="contain" />
                        <View style={styles.statCellText}>
                          <Text style={styles.statCellValue}>{player.bestTrophies.toLocaleString()}</Text>
                          <Text style={styles.statCellLabel}>Best Trophies</Text>
                        </View>
                      </View>
                      <View style={styles.statCell}>
                        <Image source={STAT_ICONS.warStars} style={styles.statCellIcon} resizeMode="contain" />
                        <View style={styles.statCellText}>
                          <Text style={styles.statCellValue}>{player.warStars.toLocaleString()}</Text>
                          <Text style={styles.statCellLabel}>War Stars</Text>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              )}

              {!showBH && player.labels?.length > 0 && (
                <PressableRipple style={styles.collapseRow} onPress={() => setLabelsOpen((v) => !v)}>
                  <View style={styles.collapseRowIcon}>
                    <Ionicons name="pricetags-outline" size={16} color={Colors.textSecondary} />
                  </View>
                  <View style={styles.collapseRowText}>
                    <Text style={styles.collapseRowTitle}>Labels</Text>
                    <Text style={styles.collapseRowSub}>{player.labels.length} {player.labels.length === 1 ? 'label' : 'labels'}</Text>
                  </View>
                  <Ionicons name={labelsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
                </PressableRipple>
              )}
              {!showBH && labelsOpen && player.labels?.length > 0 && (
                <View style={styles.statsGrid}>
                  {player.labels.map((l) => (
                    <View key={l.id} style={styles.statCell}>
                      {l.iconUrls?.small ? (
                        <Image source={{ uri: l.iconUrls.small }} style={styles.statCellLabelImage} resizeMode="contain" />
                      ) : null}
                      <View style={styles.statCellText}>
                        <Text style={styles.statCellLabel}>{l.name}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <PressableRipple onPress={() => setShowBH(!showBH)} style={styles.swapBtnFloating} hitSlop={6}>
                <Ionicons name="swap-horizontal" size={14} color={Colors.bgCard} />
              </PressableRipple>
            </View>
          </Card>

          <View style={styles.sectionLabel}>
            <Text style={styles.sectionTitle}>Progress Overview</Text>
          </View>

          <View style={styles.progressGrid}>
            <ProgressSummaryCard
              category="Heroes"
              progress={heroesProgress}
              lockedMessage={allHeroesAtTH.length === 0 ? 'Unlocks at TH7' : undefined}
              items={allHeroesAtTH.map((h) => {
                const owned = homeHeroes.find((o: { name: string }) => o.name === h.name);
                return { name: h.name, level: owned?.level ?? 0, maxLevel: h.maxLevel };
              })}
              onPress={() => router.push('/(tabs)/army?tab=heroes')}
            />
            <ProgressSummaryCard
              category="Troops"
              progress={troopsProgress}
              items={allTroopsAtTH.map((t) => {
                const owned = homeTroops.find((o: { name: string }) => o.name === t.name);
                return { name: t.name, level: owned?.level ?? 0, maxLevel: t.maxLevel };
              })}
              onPress={() => router.push('/(tabs)/army?tab=troops')}
            />
            <ProgressSummaryCard
              category="Spells"
              progress={spellsProgress}
              lockedMessage={allSpellsAtTH.length === 0 ? 'Unlocks at TH5' : undefined}
              items={allSpellsAtTH.map((s) => {
                const owned = homeSpells.find((o: { name: string }) => o.name === s.name);
                return { name: s.name, level: owned?.level ?? 0, maxLevel: s.maxLevel };
              })}
              onPress={() => router.push('/(tabs)/army?tab=spells')}
            />
            <ProgressSummaryCard
              category="Equipment"
              progress={equipProgress}
              iconUri="https://www.clash.ninja/images/entities/171.png"
              lockedMessage={player.heroEquipment.length === 0 ? 'Unlocks at TH15' : undefined}
              items={player.heroEquipment.map((e: { name: string; level: number; maxLevel: number }) => ({
                name: e.name,
                level: e.level,
                maxLevel: e.maxLevel,
              }))}
              onPress={() => router.push('/(tabs)/army?tab=equipment')}
            />
          </View>

          {unlockableItems.length > 0 && (
            <>
              <View style={styles.sectionLabel}>
                <Text style={styles.sectionTitle}>Available Upgrades</Text>
              </View>
              <View style={styles.upgradeCard}>
                <PressableRipple style={styles.upgradeHeader} onPress={() => setUpgradesOpen((v) => !v)}>
                  <View style={styles.upgradeHeaderLeft}>
                    <Ionicons name="ban-outline" size={16} color="#FF3B30" />
                    <Text style={styles.upgradeHeaderText}>{unlockableItems.length} locked</Text>
                    {loadingCosts && <Text style={styles.upgradeHeaderMeta}> …</Text>}
                    {!loadingCosts && upgradeCosts && aggregateCost > 0 && (
                      <Text style={styles.upgradeHeaderMeta}>· {fmtCost(aggregateCost)}{aggregateTime > 0 ? ` · ${fmtTime(aggregateTime)}` : ''}</Text>
                    )}
                  </View>
                  <Ionicons name={upgradesOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textTertiary} />
                </PressableRipple>
                {upgradesOpen && (() => {
                  let lastTh = -1;
                  return unlockableItems.flatMap((item, i) => {
                    const imageUrl = item.type === 'hero' ? getHeroImageUrl(item.name) : getTroopImageUrl(item.name, 1);
                    const thUrl = getTownHallImageUrl(item.unlockTh);
                    const levelsAtTH = getMaxLevelAtTH(item.name, th);
                    const isNewTh = item.unlockTh !== lastTh;
                    lastTh = item.unlockTh;
                    const elements: React.ReactNode[] = [];
                    if (isNewTh) {
                      if (i > 0) {
                        elements.push(<View key={`th-sep-${item.unlockTh}`} style={styles.upgradeGroupSep} />);
                      }
                      elements.push(
                        <View key={`th-${item.unlockTh}`} style={styles.upgradeThSection}>
                          <Image source={{ uri: thUrl! }} style={styles.upgradeThSectionIcon} resizeMode="contain" />
                          <Text style={styles.upgradeThSectionTitle}>Town Hall {item.unlockTh}</Text>
                        </View>
                      );
                    }
                    const itemCost = upgradeCosts?.[item.name];
                    elements.push(
                      <View key={item.name} style={[styles.upgradeRow, i < unlockableItems.length - 1 && styles.upgradeRowBorder]}>
                        <View style={styles.upgradeIconWrap}>
                          {imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={styles.upgradeIcon} resizeMode="contain" />
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
                <PressableRipple style={styles.upgradeHeader} onPress={() => setRushedOpen((v) => !v)}>
                  <View style={styles.upgradeHeaderLeft}>
                    <Ionicons name="warning-outline" size={16} color={Colors.warning} />
                    <Text style={styles.upgradeHeaderText}>{rushedItems.length} rushed</Text>
                    {loadingRushedCosts && <Text style={styles.upgradeHeaderMeta}> …</Text>}
                    {!loadingRushedCosts && rushedCosts && aggregateRushedCost > 0 && (
                      <Text style={styles.upgradeHeaderMeta}>· {fmtCost(aggregateRushedCost)}{aggregateRushedTime > 0 ? ` · ${fmtTime(aggregateRushedTime)}` : ''}</Text>
                    )}
                  </View>
                  <Ionicons name={rushedOpen ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textTertiary} />
                </PressableRipple>
                {rushedOpen && (() => {
                  const groups: { label: string; key: string; icon: { set: 'ion' | 'mc'; name: string }; items: typeof rushedItems }[] = [
                    { label: 'Heroes', key: 'hero', icon: { set: 'ion', name: 'shield-half-outline' }, items: [] },
                    { label: 'Troops', key: 'troop', icon: { set: 'mc', name: 'sword-cross' }, items: [] },
                    { label: 'Spells', key: 'spell', icon: { set: 'ion', name: 'flask-outline' }, items: [] },
                    { label: 'Equipment', key: 'equipment', icon: { set: 'ion', name: 'trophy-outline' }, items: [] },
                  ];
                  for (const item of rushedItems) {
                    const g = groups.find((g) => g.key === item.type);
                    if (g) g.items.push(item);
                  }
                  const visible = groups.filter((g) => g.items.length > 0);
                  return visible.flatMap((group, gi) => {
                    const elements: React.ReactNode[] = [];
                    if (gi > 0) {
                      elements.push(<View key={`rs-sep-${gi}`} style={styles.upgradeGroupSep} />);
                    }
                    elements.push(
                      <View key={`rs-hdr-${group.key}`} style={styles.upgradeThSection}>
                        {group.icon.set === 'mc' ? (
                          <MaterialCommunityIcons name={group.icon.name as any} size={14} color={Colors.textTertiary} />
                        ) : (
                          <Ionicons name={group.icon.name as any} size={14} color={Colors.textTertiary} />
                        )}
                        <Text style={styles.upgradeThSectionTitle}>{group.label} ({group.items.length})</Text>
                      </View>
                    );
                    group.items.forEach((item, i) => {
                      const iconUrl = item.type === 'hero' ? getHeroImageUrl(item.name) : item.type === 'equipment' ? getEquipmentImageUrl(item.name) : getTroopImageUrl(item.name, item.currentLevel);
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
                            <View style={styles.upgradeHintRow}>
                              <Text style={styles.upgradeHint}>Lv{item.currentLevel}</Text>
                              <Ionicons name="arrow-forward" size={10} color={Colors.textTertiary} style={{ marginHorizontal: 2 }} />
                              <Text style={styles.upgradeHint}>Lv{item.maxLevelAtPrevTH}</Text>
                            </View>
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
            <PressableRipple style={styles.actionBtn} onPress={() => router.push('/(tabs)/saved')}>
              <Ionicons name="bookmarks-outline" size={16} color={Colors.textPrimary} />
              <Text style={styles.actionText}>Saved</Text>
            </PressableRipple>
            <PressableRipple style={styles.actionBtn} onPress={() => router.push('/(tabs)/war')}>
              <Ionicons name="flag-outline" size={16} color={Colors.textPrimary} />
              <Text style={styles.actionText}>War</Text>
            </PressableRipple>
            <PressableRipple style={styles.actionBtn} onPress={() => router.push('/(tabs)/settings')}>
              <Ionicons name="settings-sharp" size={16} color={Colors.textPrimary} />
              <Text style={styles.actionText}>Settings</Text>
            </PressableRipple>
            <PressableRipple style={styles.actionBtn} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={16} color={Colors.textPrimary} />
              <Text style={styles.actionText}>Refresh</Text>
            </PressableRipple>
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

          {/* ── Active Timers ── */}
          {reminders.length > 0 && (
            <>
              <View style={styles.sectionLabel}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.sectionTitle}>Active Timers</Text>
                  <PressableRipple style={styles.addTimerBtn} onPress={() => { setTimerLabel(''); setTimerMinutes(30); setAddTimerVisible(true); }}>
                    <Ionicons name="alarm-outline" size={14} color={Colors.textPrimary} />
                    <Text style={styles.addTimerBtnText}>Add</Text>
                  </PressableRipple>
                </View>
              </View>
              <View style={styles.timersCard}>
                {reminders.map((r) => {
                  const remaining = Math.max(0, new Date(r.targetDate).getTime() - Date.now());
                  const expired = r.status === 'expired' || remaining <= 0;
                  const days = Math.floor(remaining / 86400000);
                  const hours = Math.floor((remaining % 86400000) / 3600000);
                  const minutes = Math.floor((remaining % 3600000) / 60000);
                  const seconds = Math.floor((remaining % 60000) / 1000);
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const timeStr = days > 0
                    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
                    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
                  return (
                    <View key={r.id} style={styles.timerRow}>
                      <View style={styles.timerInfo}>
                        <Text style={styles.timerLabel} numberOfLines={1}>{r.label}</Text>
                        <Text style={[styles.timerCountdown, expired && styles.timerExpired]}>{expired ? 'Done!' : timeStr}</Text>
                      </View>
                      <PressableRipple style={styles.timerDismiss} onPress={() => dismissTimer(r.id)} hitSlop={8}>
                        <Ionicons name="close-circle-outline" size={20} color={Colors.textTertiary} />
                      </PressableRipple>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </Animated.View>

      {switchingHome && (
        <View style={styles.switchingOverlay}>
          <ActivityIndicator size="large" color={Colors.textPrimary} />
        </View>
      )}

      <Dialog />

      <Modal visible={addTimerVisible} transparent animationType="fade" onRequestClose={() => setAddTimerVisible(false)} statusBarTranslucent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalOverlay} onPress={() => setAddTimerVisible(false)}>
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>New Timer</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Label (e.g. Archer Queen)"
                placeholderTextColor={Colors.textMuted}
                value={timerLabel}
                onChangeText={setTimerLabel}
                autoFocus
              />
              <View style={styles.durationPresets}>
                {[15, 30, 60, 120, 240, 480, 720, 1440].map((m) => {
                  const label = m < 60 ? `${m}m` : m < 1440 ? `${m / 60}h` : `${m / 60 / 24}d`;
                  return (
                    <PressableRipple
                      key={m}
                      style={[styles.durationPill, timerMinutes === m && styles.durationPillActive]}
                      onPress={() => setTimerMinutes(m)}
                    >
                      <Text style={[styles.durationPillText, timerMinutes === m && styles.durationPillTextActive]}>{label}</Text>
                    </PressableRipple>
                  );
                })}
              </View>
              <View style={styles.modalActions}>
                <PressableRipple style={styles.modalCancelBtn} onPress={() => setAddTimerVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </PressableRipple>
                <PressableRipple
                  style={[styles.modalConfirmBtn, (!timerLabel.trim() || addingTimer) && { opacity: 0.4 }]}
                  disabled={!timerLabel.trim() || addingTimer}
                  onPress={async () => {
                    setAddingTimer(true);
                    await addTimer(timerLabel.trim(), timerMinutes);
                    setAddingTimer(false);
                    setAddTimerVisible(false);
                  }}
                >
                  {addingTimer ? (
                    <ActivityIndicator size="small" color={Colors.bg} />
                  ) : (
                    <Text style={styles.modalConfirmText}>Start Timer</Text>
                  )}
                </PressableRipple>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={switcherVisible} transparent animationType="fade" onRequestClose={() => setSwitcherVisible(false)} statusBarTranslucent>
        <Pressable style={styles.switcherOverlay} onPress={() => setSwitcherVisible(false)}>
          <View style={styles.switcherCard}>
            <View style={styles.switcherHeader}>
              <View style={styles.switcherHeaderIcon}>
                <Ionicons name="people" size={18} color={Colors.textPrimary} />
              </View>
              <View style={styles.switcherHeaderText}>
                <Text style={styles.switcherTitle}>Accounts</Text>
                <Text style={styles.switcherSubtitle}>Tap to switch</Text>
              </View>
            </View>
            {accounts.length === 0 && <Text style={styles.switcherEmpty}>No accounts added</Text>}
            {accounts.map((acct) => {
              const isActive = acct.tag === activeAccount?.tag;
              return (
                <PressableRipple
                  key={acct.tag}
                  style={[styles.switcherItem, isActive && styles.switcherItemActive]}
                  onPress={() => handleHomeSwitch(acct.tag)}
                >
                  <View style={styles.switcherAvatar}>
                    {acct.townHallLevel > 0 && getTownHallImageUrl(acct.townHallLevel) ? (
                      <Image source={{ uri: getTownHallImageUrl(acct.townHallLevel)! }} style={styles.switcherAvatarImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="person" size={18} color={Colors.textSecondary} />
                    )}
                  </View>
                  <View style={styles.switcherItemText}>
                    <View style={styles.switcherItemNameRow}>
                      <Text style={styles.switcherItemName} numberOfLines={1}>{acct.name || acct.tag}</Text>
                      {isActive && (
                        <View style={styles.switcherActiveChip}>
                          <Text style={styles.switcherActiveChipText}>Active</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.switcherItemTag}>{acct.tag}</Text>
                  </View>
                  {acct.townHallLevel > 0 && (
                    <View style={[styles.switcherThBox, isActive && styles.switcherThBoxActive]}>
                      <Text style={[styles.switcherThBoxLevel, isActive && styles.switcherThBoxLevelActive]}>{acct.townHallLevel}</Text>
                      <Text style={[styles.switcherThBoxLabel, isActive && styles.switcherThBoxLabelActive]}>TH</Text>
                    </View>
                  )}
                </PressableRipple>
              );
            })}
            <PressableRipple style={styles.switcherClose} onPress={() => setSwitcherVisible(false)}>
              <Text style={styles.switcherCloseText}>Close</Text>
            </PressableRipple>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={progressDiff !== null} transparent animationType="fade" onRequestClose={() => setProgressDiff(null)} statusBarTranslucent>
        <Pressable style={styles.progressOverlay} onPress={() => setProgressDiff(null)}>
          <View style={styles.progressCard} onStartShouldSetResponder={() => true}>
            <View style={styles.progressHeader}>
              <View style={styles.progressHeaderIcon}>
                <Ionicons name="trending-up" size={20} color={Colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressTitle}>Progress Achieved</Text>
                <Text style={styles.progressSubtitle}>
                  {progressDiff && progressDiff.since > 0
                    ? `Since ${new Date(progressDiff.since).toLocaleDateString()}`
                    : 'Since your last refresh'}
                </Text>
              </View>
            </View>

            {progressDiff && progressDiff.categories.length > 0 && (
              <>
                <Text style={styles.progressSectionTitle}>Overall Progress</Text>
                <View style={{ gap: Spacing.sm }}>
                  {progressDiff.categories.map((c) => {
                    const meta = CATEGORY_META[c.key];
                    return (
                      <View key={c.key} style={styles.progressRow}>
                        {meta.icon.set === 'mc' ? (
                          <MaterialCommunityIcons name={meta.icon.name as any} size={15} color={Colors.textSecondary} />
                        ) : (
                          <Ionicons name={meta.icon.name as any} size={15} color={Colors.textSecondary} />
                        )}
                        <Text style={styles.progressRowLabel}>{meta.label}</Text>
                        <Text style={styles.progressRowValue}>
                          <Text style={styles.progressRowBefore}>{Math.round(c.before * 100)}%</Text>
                          {'  →  '}
                          <Text style={styles.progressRowAfter}>{Math.round(c.after * 100)}%</Text>
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {progressDiff && progressDiff.levelUps.length > 0 && (
              <>
                <Text style={styles.progressSectionTitle}>Level Ups ({progressDiff.levelUps.length})</Text>
                <View style={styles.progressLevelUps}>
                  {progressDiff.levelUps.map((u, i) => {
                    const meta = CATEGORY_META[u.key];
                    return (
                      <View key={`${u.key}-${u.name}`} style={[styles.progressLevelRow, i < progressDiff!.levelUps.length - 1 && styles.progressLevelRowBorder]}>
                        {meta.icon.set === 'mc' ? (
                          <MaterialCommunityIcons name={meta.icon.name as any} size={14} color={Colors.textTertiary} />
                        ) : (
                          <Ionicons name={meta.icon.name as any} size={14} color={Colors.textTertiary} />
                        )}
                        <Text style={styles.progressLevelName} numberOfLines={1}>{u.name}</Text>
                        <Text style={styles.progressLevelValue}>
                          <Text style={styles.progressRowBefore}>Lv{u.before}</Text>
                          {'  →  '}
                          <Text style={styles.progressRowAfter}>Lv{u.after}</Text>
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            <PressableRipple style={styles.progressClose} onPress={() => setProgressDiff(null)}>
              <Text style={styles.progressCloseText}>Nice!</Text>
            </PressableRipple>
          </View>
        </Pressable>
      </Modal>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  switchBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timestamp: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  switchingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  switcherOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  switcherCard: {
    width: '86%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  switcherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  switcherHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherHeaderText: {
    flex: 1,
  },
  switcherTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  switcherSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  switcherEmpty: {
    ...Typography.subhead,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  switcherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  switcherItemActive: {
    backgroundColor: Colors.accentGhost,
  },
  switcherAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  switcherAvatarImg: {
    width: 34,
    height: 34,
  },
  switcherItemText: {
    flex: 1,
  },
  switcherItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  switcherItemName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
  },
  switcherItemTag: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 1,
  },
  switcherActiveChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.textPrimary,
  },
  switcherActiveChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.bg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  switcherThBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherThBoxActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  switcherThBoxLevel: {
    ...Typography.headline,
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 16,
    fontWeight: '700',
  },
  switcherThBoxLevelActive: {
    color: Colors.bg,
  },
  switcherThBoxLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '600',
  },
  switcherThBoxLabelActive: {
    color: Colors.bg,
    opacity: 0.7,
  },
  switcherClose: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  switcherCloseText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  playerCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm
  },
  playerCardInner: {
    position: 'relative',
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
  metaBadge: {
    width: 13,
    height: 13,
    borderRadius: 2,
  },
  metaText: {
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
  swapBtnFloating: {
    position: 'absolute',
    top: -24,
    right: -20,
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  statCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '48%',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  statCellLeagueImage: {
    width: 32,
    height: 32,
  },
  statCellIcon: {
    width: 28,
    height: 28,
  },
  statCellLabelImage: {
    width: 32,
    height: 32,
  },
  statCellText: {
    flex: 1,
  },
  statCellValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  statCellLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  collapseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingBottom: Spacing.xs,
  },
  collapseRowIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  collapseRowText: {
    flex: 1,
  },
  collapseRowTitle: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  collapseRowSub: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 1,
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
    borderRadius: Radius.sm,
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
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
  upgradeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeThSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.bgSubtle,
  },
  upgradeGroupSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
  },
  upgradeThSectionIcon: {
    width: 18,
    height: 18,
  },
  upgradeThSectionTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
  addTimerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentGhost,
  },
  addTimerBtnText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  timersCard: {
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  timerInfo: {
    flex: 1,
  },
  timerLabel: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  timerCountdown: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  timerExpired: {
    color: Colors.success,
    fontWeight: '700',
  },
  timerDismiss: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalCard: {
    width: '84%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  modalInput: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  durationPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  durationPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  durationPillActive: {
    backgroundColor: Colors.accentGhost,
    borderColor: Colors.textPrimary,
  },
  durationPillText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  durationPillTextActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  modalCancelText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modalConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
  },
  modalConfirmText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '700',
  },
  progressOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  progressCard: {
    width: '88%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  progressHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  progressSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  progressSectionTitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  progressRowLabel: {
    flex: 1,
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  progressRowValue: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressRowBefore: {
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  progressRowAfter: {
    color: Colors.success,
    fontWeight: '700',
  },
  progressLevelUps: {
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  progressLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  progressLevelRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  progressLevelName: {
    flex: 1,
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  progressLevelValue: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressClose: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
  },
  progressCloseText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '700',
  },
});
