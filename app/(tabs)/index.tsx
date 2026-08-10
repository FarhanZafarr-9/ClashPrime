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
  Linking,
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
import { SettingRow } from '../../src/components/SettingRow';
import { ItemCard } from '../../src/components/ItemCard';
import { getTroopDetail, type TroopDetail } from '../../src/api/troopDetail';
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

const RUSHED_ACCENT = '#F6C453';

type HomeStatRow = { label: string; desc?: string; value: number | string; icon: keyof typeof Ionicons.glyphMap; accentColor?: string };
type HomeStatGroup = { title: string; icon: keyof typeof Ionicons.glyphMap; desc: string; rows: HomeStatRow[] };

function CollapsibleSection({
  title,
  icon,
  iconUrl,
  description,
  count,
  totalLevel,
  totalMax,
  badge,
  isFirst,
  isLast,
  onOpen,
  onPressOverride,
  defaultOpen,
  destructive,
  accentColor,
  compact,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconUrl?: string;
  description: React.ReactNode;
  count: number;
  totalLevel: number;
  totalMax: number;
  badge?: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
  onOpen?: () => void;
  onPressOverride?: () => void;
  defaultOpen?: boolean;
  destructive?: boolean;
  accentColor?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  if (count === 0) return null;
  const isSectionMaxed = totalMax > 0 && totalLevel >= totalMax;
  const toggle = () => {
    if (onPressOverride) {
      onPressOverride();
      return;
    }
    if (!open) onOpen?.();
    setOpen(!open);
  };
  return (
    <>
      <SettingRow
        icon={icon}
        iconUrl={iconUrl}
        title={title}
        desc={description}
        isFirst={isFirst || open}
        isLast={isLast && !open}
        onPress={toggle}
        destructive={destructive}
        accentColor={accentColor}
        compact={compact}
      >
        {badge != null ? badge : (
          <View style={styles.sectionBadges}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{count}</Text>
            </View>
            <View style={[styles.sectionBadge, isSectionMaxed && styles.sectionBadgeMaxed, isFirst && styles.sectionBadgeFirst, isLast && !open && styles.sectionBadgeLast]}>
              <Text style={[styles.sectionBadgeText, isSectionMaxed && styles.sectionBadgeTextMaxed]}>{totalLevel}</Text>
              <Text style={[styles.sectionBadgeLabel, isSectionMaxed && styles.sectionBadgeTextMaxed]}>/ {totalMax}</Text>
            </View>
          </View>
        )}
      </SettingRow>
      {open && (
        <View style={styles.sectionBody}>
          {children}
          {!isLast && <View style={styles.sectionSeparator} />}
        </View>
      )}
    </>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { player, loading, error, lastSync, refresh, switchAccount, activeAccount, accounts } = usePlayer();
  const { superTroopNames } = useGameData();
  const { reminders, addTimer, dismissTimer, hasPermission } = useTimers();
  const { show: showDialog, Dialog } = useDialog();
  const [refreshing, setRefreshing] = useState(false);
  const [progressDiff, setProgressDiff] = useState<ProgressDiff | null>(null);
  const [addTimerVisible, setAddTimerVisible] = useState(false);
  const [timerLabel, setTimerLabel] = useState('');
  const [timerMinutes, setTimerMinutes] = useState(30);
  const [addingTimer, setAddingTimer] = useState(false);
  const [timerInputFocused, setTimerInputFocused] = useState(false);
  const timerCardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (addTimerVisible) {
      timerCardAnim.setValue(0);
      Animated.spring(timerCardAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }).start();
    }
  }, [addTimerVisible, timerCardAnim]);
  const [showBH, setShowBH] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [equipDetails, setEquipDetails] = useState<Record<string, TroopDetail | null>>({});
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

  // Prefetch hero-equipment details (full level list) so equipment rows show the
  // item's full max level instead of the API's Blacksmith-capped maxLevel.
  const prefetchEquipDetails = useCallback(async () => {
    const names = heroEquipment.map((e) => e.name);
    if (names.length === 0) return;
    const pending = names.filter((n) => equipDetails[n] === undefined);
    if (pending.length === 0) return;
    const fetched = await Promise.all(pending.map((name) => getTroopDetail(name).catch(() => null)));
    setEquipDetails((prev) => {
      const next = { ...prev };
      fetched.forEach((detail, i) => { next[pending[i]] = detail; });
      return next;
    });
  }, [heroEquipment, equipDetails]);

  useEffect(() => {
    prefetchEquipDetails();
  }, [prefetchEquipDetails]);

  const getEquipFullMax = (name: string, fallback: number): number => {
    const detail = equipDetails[name];
    if (detail && detail.levels.length > 0) {
      let max = 0;
      for (const lvl of detail.levels) {
        if (lvl.level > max) max = lvl.level;
      }
      return max;
    }
    return fallback;
  };

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
    ? heroEquipment.reduce((s, e) => s + (getEquipFullMax(e.name, e.maxLevel) > 0 ? e.level / getEquipFullMax(e.name, e.maxLevel) : 0), 0) / heroEquipment.length
    : 0;

  const progressGroups: {
    key: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconUrl?: string;
    progress: number;
    pushTo: string;
    rows: { name: string; level: number; maxLevel: number; icon?: string }[];
  }[] = [
    {
      key: 'heroes',
      title: 'Heroes',
      icon: 'shield-half-outline',
      iconUrl: getHeroImageUrl('Barbarian King') || undefined,
      progress: heroesProgress,
      pushTo: '/(tabs)/army?tab=heroes',
      rows: allHeroesAtTH.map((h) => {
        const owned = homeHeroes.find((o: { name: string }) => o.name === h.name);
        return { name: h.name, level: owned?.level ?? 0, maxLevel: h.maxLevel, icon: getHeroImageUrl(h.name) || undefined };
      }),
    },
    {
      key: 'troops',
      title: 'Troops',
      icon: 'bonfire-outline',
      iconUrl: getTroopImageUrl('Barbarian', 1) || undefined,
      progress: troopsProgress,
      pushTo: '/(tabs)/army?tab=troops',
      rows: allTroopsAtTH.map((t) => {
        const owned = homeTroops.find((o: { name: string }) => o.name === t.name);
        const level = owned?.level ?? 0;
        return { name: t.name, level, maxLevel: t.maxLevel, icon: getTroopImageUrl(t.name, level) || undefined };
      }),
    },
    {
      key: 'spells',
      title: 'Spells',
      icon: 'flash-outline',
      iconUrl: getTroopImageUrl('Lightning Spell', 1) || undefined,
      progress: spellsProgress,
      pushTo: '/(tabs)/army?tab=spells',
      rows: allSpellsAtTH.map((s) => {
        const owned = homeSpells.find((o: { name: string }) => o.name === s.name);
        const level = owned?.level ?? 0;
        return { name: s.name, level, maxLevel: s.maxLevel, icon: getTroopImageUrl(s.name, level) || undefined };
      }),
    },
    {
      key: 'equipment',
      title: 'Equipment',
      icon: 'hammer-outline',
      iconUrl: getEquipmentImageUrl('Barbarian Puppet') || undefined,
      progress: equipProgress,
      pushTo: '/(tabs)/army?tab=equipment',
      rows: player.heroEquipment.map((e: { name: string; level: number; maxLevel: number }) => ({
        name: e.name,
        level: e.level,
        maxLevel: getEquipFullMax(e.name, e.maxLevel),
        icon: getEquipmentImageUrl(e.name) || undefined,
      })),
    },
  ];

  const homeStatGroups: HomeStatGroup[] = [
    {
      title: 'PvP',
      icon: 'trophy-outline',
      desc: 'Attack & defense record',
      rows: [
        { label: 'Trophies', desc: 'Current trophy count', value: player.trophies, icon: 'trophy-outline' },
        { label: 'Best Trophies', desc: 'All-time best', value: player.bestTrophies, icon: 'trophy', accentColor: Colors.warning },
        { label: 'War Stars', desc: 'Clan war stars', value: player.warStars, icon: 'star-outline' },
        { label: 'Attack Wins', desc: 'Attacks won', value: player.attackWins, icon: 'flame-outline' },
        { label: 'Defense Wins', desc: 'Defenses won', value: player.defenseWins, icon: 'shield-outline' },
      ],
    },
    {
      title: 'Clan',
      icon: 'people-outline',
      desc: 'Clan participation',
      rows: [
        { label: 'Donations', desc: 'Troops donated', value: player.donations, icon: 'gift-outline' },
        { label: 'Received', desc: 'Troops received', value: player.donationsReceived, icon: 'arrow-down-outline', accentColor: player.donationsReceived > player.donations ? Colors.success : undefined },
        { label: 'Capital Gold', desc: 'Capital gold donated', value: player.clanCapitalContributions, icon: 'cash-outline' },
      ],
    },
    {
      title: 'Builder Base',
      icon: 'hammer-outline',
      desc: 'Builder village record',
      rows: [
        ...(player.builderBaseTrophies !== undefined ? [{ label: 'Builder Trophies', desc: 'Current trophy count', value: player.builderBaseTrophies, icon: 'hammer-outline' as const }] : []),
        ...(player.bestBuilderBaseTrophies !== undefined ? [{ label: 'Best Builder', desc: 'All-time best', value: player.bestBuilderBaseTrophies, icon: 'hammer' as const, accentColor: Colors.warning }] : []),
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
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
              <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
                <PressableRipple style={styles.searchBtn} onPress={() => router.push('/player')} hitSlop={8} accessibilityLabel="Inspect a player by tag" accessibilityRole="button">
                  <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
                </PressableRipple>
                <PressableRipple style={styles.switchBtn} onPress={() => setSwitcherVisible(true)}>
                  <Ionicons name="people-outline" size={18} color={Colors.textSecondary} />
                </PressableRipple>
                <PressableRipple style={styles.appBtn} onPress={() => Linking.openURL('https://link.clashofclans.com/en?action=OpenApp')} hitSlop={8} accessibilityLabel="Open Clash of Clans" accessibilityRole="button">
                  <Image source={require('../../assets/icon.png')} style={styles.appIcon} resizeMode="contain" />
                </PressableRipple>
              </View>
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

              <PressableRipple onPress={() => setShowBH(!showBH)} style={styles.swapBtnFloating} hitSlop={6}>
                <Ionicons name="swap-horizontal" size={14} color={Colors.bgCard} />
              </PressableRipple>
            </View>
          </Card>

          <View style={styles.sectionLabel}>
            <Text style={styles.sectionTitle}>Progress Overview</Text>
          </View>

          <View style={styles.progressSections}>
            {progressGroups.filter((g) => g.rows.some((r) => r.level < r.maxLevel)).map((group, gi, groups) => {
              const displayRows = group.rows.filter((r) => r.level < r.maxLevel);
              const totalLevel = group.rows.reduce((s, r) => s + r.level, 0);
              const totalMax = group.rows.reduce((s, r) => s + r.maxLevel, 0);
              const navigateInstead = group.rows.length >= 10;
              return (
                <CollapsibleSection
                  key={group.key}
                  isFirst={gi === 0}
                  isLast={gi === groups.length - 1}
                  icon={group.icon}
                  iconUrl={group.iconUrl}
                  title={group.title}
                  compact
                  onPressOverride={navigateInstead ? () => router.push(group.pushTo) : undefined}
                  description={(
                    <View style={styles.progressHeaderDesc}>
                      <View style={styles.progressHeaderBar}>
                        <View style={[styles.progressHeaderFill, { width: `${Math.min(group.progress, 1) * 100}%` }]} />
                      </View>
                    </View>
                  )}
                  count={group.rows.length}
                  totalLevel={totalLevel}
                  totalMax={totalMax}
                >
                  {displayRows.map((row, ri) => (
                    <ItemCard
                      key={`${group.key}-${ri}`}
                      name={row.name}
                      level={row.level}
                      maxLevel={row.maxLevel}
                      icon={row.icon}
                      locked={row.level === 0}
                      isLast={ri === displayRows.length - 1}
                      onPress={() => router.push(group.pushTo)}
                    />
                  ))}
                </CollapsibleSection>
              );
            })}
          </View>

          {(unlockableItems.length > 0 || rushedItems.length > 0) && (
            <>
              <View style={styles.sectionLabel}>
                <Text style={styles.sectionTitle}>Backlog</Text>
              </View>
              <View style={styles.progressSections}>
              {unlockableItems.length > 0 && (
              <CollapsibleSection
                isFirst
                isLast={rushedItems.length === 0}
                icon="ban-outline"
                title={`${unlockableItems.length} locked`}
                destructive
                compact
                onOpen={() => setUpgradesOpen(true)}
                description={loadingCosts ? 'Calculating costs & time…' : (upgradeCosts && aggregateCost > 0 ? `${fmtCost(aggregateCost)}${aggregateTime > 0 ? ` · ${fmtTime(aggregateTime)}` : ''}` : 'Items locked at your Town Hall')}
                count={unlockableItems.length}
                totalLevel={0}
                totalMax={0}
                badge={(
                  <View style={[styles.sectionBadge, styles.sectionBadgeDanger, styles.sectionBadgeFirst]}>
                    <Text style={[styles.sectionBadgeText, styles.sectionBadgeDangerText]}>{unlockableItems.length}</Text>
                  </View>
                )}
              >
                {(() => {
                  let lastTh = -1;
                  return unlockableItems.flatMap((item, i) => {
                    const isNewTh = item.unlockTh !== lastTh;
                    lastTh = item.unlockTh;
                    const thUrl = getTownHallImageUrl(item.unlockTh);
                    const imageUrl = item.type === 'hero' ? getHeroImageUrl(item.name) : getTroopImageUrl(item.name, 1);
                    const levelsAtTH = getMaxLevelAtTH(item.name, th);
                    const itemCost = upgradeCosts?.[item.name];
                    return (
                      <View key={item.name} style={[styles.statRow, i === unlockableItems.length - 1 && styles.statRowLast]}>
                        <View style={styles.statRowIcon}>
                          {imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={styles.statRowIconImage} resizeMode="contain" />
                          ) : (
                            <Ionicons name={item.type === 'spell' ? 'flask-outline' : 'person-outline'} size={16} color={Colors.textTertiary} />
                          )}
                        </View>
                        <View style={styles.statRowText}>
                          <Text style={styles.statRowLabel} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.statRowSub}>
                            {levelsAtTH} {levelsAtTH === 1 ? 'level' : 'levels'}
                            {itemCost && itemCost.timeSeconds > 0 ? ` · ${fmtTime(itemCost.timeSeconds)}` : ''}
                          </Text>
                        </View>
                        <View style={styles.statRowRightRow}>
                          <View style={styles.statRowRightBadge}>
                            {itemCost ? (
                              <Text style={styles.statRowValue}>{fmtCost(itemCost.cost)}</Text>
                            ) : loadingCosts ? (
                              <Text style={styles.statRowValue}>…</Text>
                            ) : null}
                            {itemCost && itemCost.timeSeconds > 0 && <Text style={styles.statRowValueSub}>{fmtTime(itemCost.timeSeconds)}</Text>}
                          </View>
                          {isNewTh && thUrl ? (
                            <View style={styles.thImageBadge}>
                              <Image source={{ uri: thUrl }} style={styles.thImageBadgeImg} resizeMode="contain" />
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  });
                })()}
              </CollapsibleSection>
              )}

              {rushedItems.length > 0 && (
              <CollapsibleSection
                isFirst={unlockableItems.length === 0}
                isLast
                icon="warning-outline"
                title={`${rushedItems.length} rushed`}
                accentColor={RUSHED_ACCENT}
                compact
                onOpen={() => setRushedOpen(true)}
                description={loadingRushedCosts ? 'Calculating costs & time…' : (rushedCosts && aggregateRushedCost > 0 ? `${fmtCost(aggregateRushedCost)}${aggregateRushedTime > 0 ? ` · ${fmtTime(aggregateRushedTime)}` : ''}` : 'Items below the previous Town Hall max')}
                count={rushedItems.length}
                totalLevel={0}
                totalMax={0}
                badge={(
                  <View style={[styles.sectionBadge, styles.sectionBadgeWarning, styles.sectionBadgeLast]}>
                    <Text style={[styles.sectionBadgeText, styles.sectionBadgeWarningText]}>{rushedItems.length}</Text>
                  </View>
                )}
              >
                {(() => {
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
                  const allItems = visible.flatMap((g) => g.items);
                  return allItems.map((item, i) => {
                    const iconUrl = item.type === 'hero' ? getHeroImageUrl(item.name) : item.type === 'equipment' ? getEquipmentImageUrl(item.name) : getTroopImageUrl(item.name, item.currentLevel);
                    const costData = rushedCosts?.[item.name];
                    return (
                      <View key={item.name} style={[styles.statRow, i === allItems.length - 1 && styles.statRowLast]}>
                        <View style={styles.statRowIcon}>
                          {iconUrl ? (
                            <Image source={{ uri: iconUrl }} style={styles.statRowIconImage} resizeMode="contain" />
                          ) : (
                            <Ionicons name="person-outline" size={16} color={Colors.textTertiary} />
                          )}
                        </View>
                        <View style={styles.statRowText}>
                          <Text style={styles.statRowLabel} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.statRowSub}>Lv{item.currentLevel} → Lv{item.maxLevelAtPrevTH}</Text>
                        </View>
                        <View style={styles.statRowRight}>
                          {costData ? (
                            <>
                              <Text style={styles.statRowValue}>{fmtCost(costData.cost)}</Text>
                              {costData.timeSeconds > 0 && <Text style={styles.statRowValueSub}>{fmtTime(costData.timeSeconds)}</Text>}
                            </>
                          ) : loadingRushedCosts ? (
                            <Text style={styles.statRowValue}>…</Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  });
                })()}
              </CollapsibleSection>
              )}
            </View>
            </>
          )}

          <View style={styles.sectionLabel}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>

          <View style={styles.actionsRow}>
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

          <View style={styles.statsCard}>
            {homeStatGroups.filter((g) => g.rows.length > 0).map((group, gi, groups) => (
              <CollapsibleSection
                key={group.title}
                isFirst={gi === 0}
                isLast={gi === groups.length - 1}
                icon={group.icon}
                title={group.title}
                description={group.desc}
                compact
                count={group.rows.length}
                totalLevel={0}
                totalMax={0}
                badge={(
                  <View style={[styles.sectionBadge, gi === 0 && styles.sectionBadgeFirst, gi === groups.length - 1 && styles.sectionBadgeLast]}>
                    <Text style={styles.sectionBadgeText}>{group.rows.length}</Text>
                  </View>
                )}
              >
                {group.rows.map((row, ri) => (
                  <View key={`${group.title}-${ri}`} style={[styles.statRow, ri === group.rows.length - 1 && styles.statRowLast]}>
                    <View style={styles.statRowIcon}>
                      <Ionicons name={row.icon} size={16} color={Colors.textPrimary} />
                    </View>
                    <View style={styles.statRowText}>
                      <Text style={styles.statRowLabel}>{row.label}</Text>
                      {row.desc ? <Text style={styles.statRowSub}>{row.desc}</Text> : null}
                    </View>
                    <Text style={[styles.statRowValue, row.accentColor ? { color: row.accentColor } : null]}>
                      {typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
                    </Text>
                  </View>
                ))}
              </CollapsibleSection>
            ))}
          </View>

          {/* ── Active Timers ── */}
          <View style={styles.sectionLabel}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.sectionTitle}>Active Timers</Text>
              <PressableRipple style={styles.addTimerBtn} onPress={() => { setTimerLabel(''); setTimerMinutes(30); setAddTimerVisible(true); }}>
                <Ionicons name="alarm-outline" size={14} color={Colors.textPrimary} />
                <Text style={styles.addTimerBtnText}>Add</Text>
              </PressableRipple>
            </View>
          </View>
          {reminders.length > 0 ? (
            <View style={styles.progressSections}>
              <CollapsibleSection
                isFirst
                isLast
                defaultOpen
                icon="alarm-outline"
                title={`${reminders.length} active`}
                description="Countdown reminders"
                compact
                count={reminders.length}
                totalLevel={0}
                totalMax={0}
                badge={(
                  <View style={[styles.sectionBadge, styles.sectionBadgeFirst, styles.sectionBadgeLast]}>
                    <Text style={styles.sectionBadgeText}>{reminders.length}</Text>
                  </View>
                )}
              >
                {reminders.map((r, i) => {
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
                    <View key={r.id} style={[styles.statRow, i === reminders.length - 1 && styles.statRowLast]}>
                      <View style={styles.statRowIcon}>
                        <Ionicons name="time-outline" size={16} color={Colors.textPrimary} />
                      </View>
                      <View style={styles.statRowText}>
                        <Text style={styles.statRowLabel} numberOfLines={1}>{r.label}</Text>
                        <Text style={[styles.statRowSub, expired && styles.timerExpired]}>{expired ? 'Done!' : timeStr}</Text>
                      </View>
                      <PressableRipple style={styles.timerDismiss} onPress={() => dismissTimer(r.id)} hitSlop={8}>
                        <Ionicons name="close-circle-outline" size={20} color={Colors.textTertiary} />
                      </PressableRipple>
                    </View>
                  );
                })}
              </CollapsibleSection>
            </View>
          ) : (
            <PressableRipple style={styles.timersEmpty} onPress={() => { setTimerLabel(''); setTimerMinutes(30); setAddTimerVisible(true); }}>
              <View style={styles.timersEmptyIcon}>
                <Ionicons name="alarm-outline" size={20} color={Colors.textPrimary} />
              </View>
              <View style={styles.timersEmptyText}>
                <Text style={styles.timersEmptyTitle}>No active timers</Text>
                <Text style={styles.timersEmptySub}>Add a countdown to know exactly when a builder frees up.</Text>
              </View>
              <View style={styles.timersEmptyAdd}>
                <Ionicons name="add" size={16} color={Colors.bg} />
              </View>
            </PressableRipple>
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
        <View style={styles.modalRoot}>
          <KeyboardAvoidingView
            style={styles.modalRoot}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setAddTimerVisible(false)}>
              <Animated.View
                style={[
                  styles.modalCard,
                  {
                    opacity: timerCardAnim,
                    transform: [
                      { scale: timerCardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                    ],
                  },
                ]}
                onStartShouldSetResponder={() => true}
              >
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderIcon}>
                    <Ionicons name="alarm-outline" size={20} color={Colors.textPrimary} />
                  </View>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTitle}>New Timer</Text>
                    <Text style={styles.modalSubtitle}>Get a reminder when the time is up</Text>
                  </View>
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>LABEL</Text>
                  <TextInput
                    style={[styles.modalInput, timerInputFocused && styles.modalInputFocused]}
                    placeholder="e.g. Archer Queen"
                    placeholderTextColor={Colors.textMuted}
                    value={timerLabel}
                    onChangeText={setTimerLabel}
                    onFocus={() => setTimerInputFocused(true)}
                    onBlur={() => setTimerInputFocused(false)}
                    autoFocus
                    maxLength={40}
                    returnKeyType="done"
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>DURATION</Text>
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
                  <View style={styles.durationSummary}>
                    <Ionicons name="time-outline" size={13} color={Colors.textTertiary} />
                    <Text style={styles.durationSummaryText}>
                      Ends at{' '}
                      <Text style={styles.durationSummaryTime}>
                        {new Date(Date.now() + timerMinutes * 60000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </Text>
                  </View>
                </View>

                {!hasPermission && (
                  <View style={styles.notifHint}>
                    <Ionicons name="notifications-off-outline" size={13} color={Colors.warning} />
                    <Text style={styles.notifHintText}>Notifications are off — you won't get a reminder.</Text>
                  </View>
                )}

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
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
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
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  appBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
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
  progressSections: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
    borderRadius: Radius.xl * 1.25,
    overflow: 'hidden',
  },
  progressHeaderDesc: {
    marginTop: 6,
  },
  progressHeaderBar: {
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressHeaderFill: {
    height: '100%',
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },
  statsCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
    borderRadius: Radius.xl * 1.25,
    overflow: 'hidden',
  },
  sectionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionBadge: {
    minWidth: 36,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  sectionBadgeMaxed: {
    backgroundColor: Colors.warning,
  },
  sectionBadgeDanger: {
    backgroundColor: 'rgba(244,67,54,0.14)',
    borderWidth: 0.75,
    borderColor: 'rgba(244,67,54,0.45)',
  },
  sectionBadgeDangerText: {
    color: '#F44336',
  },
  sectionBadgeWarning: {
    backgroundColor: 'rgba(246,196,83,0.14)',
    borderWidth: 0.75,
    borderColor: 'rgba(246,196,83,0.45)',
  },
  sectionBadgeWarningText: {
    color: RUSHED_ACCENT,
  },
  sectionBadgeText: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sectionBadgeFirst: {
    borderTopRightRadius: Radius.lg,
  },
  sectionBadgeLast: {
    borderBottomRightRadius: Radius.lg,
  },
  sectionBadgeTextMaxed: {
    color: Colors.bg,
  },
  sectionBadgeLabel: {
    fontSize: 8,
    lineHeight: 9,
    color: Colors.textPrimary,
    opacity: 0.7,
    fontVariant: ['tabular-nums'],
  },
  sectionBody: {
    paddingTop: 0,
  },
  sectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    margin: Spacing.lg,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
  },
  statRowLast: {
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  statRowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRowText: {
    flex: 1,
  },
  statRowLabel: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  statRowSub: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: Spacing.xs / 2,
  },
  statRowValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statRowIconImage: {
    width: 26,
    height: 26,
  },
  statRowRight: {
    alignItems: 'flex-end',
  },
  statRowValueSub: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  statRowRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statRowRightBadge: {
    alignItems: 'flex-end',
  },
  thImageBadge: {
    width: 32,
    height: 32,
    marginLeft: Spacing.lg,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thImageBadgeImg: {
    width: 26,
    height: 26,
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
  timerExpired: {
    color: Colors.success,
    fontWeight: '700',
  },
  timerDismiss: {
    padding: 4,
  },
  timersEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgCard,
  },
  timersEmptyIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timersEmptyText: {
    flex: 1,
    gap: 2,
  },
  timersEmptyTitle: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  timersEmptySub: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  timersEmptyAdd: {
    width: 24,
    height: 24,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: Colors.overlay,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xxl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  modalSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  fieldBlock: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modalInput: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  modalInputFocused: {
    borderColor: Colors.textPrimary,
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
  durationSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  durationSummaryText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  durationSummaryTime: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  notifHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  notifHintText: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 16,
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
    backgroundColor: Colors.bgSubtle,
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
