import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Image,
  type ImageSourcePropType,
} from 'react-native';
import PressableRipple from '../../src/components/PressableRipple';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import {
  getMaxLevelAtTH,
  getAllItemsAtTH,
  getBuildingMaxLevelAtTH,
  getBuilderTroopMaxLevel,
  getArmyItemImage,
  getArmyTroopDetail,
  RESOURCE_META,
  sumLevelCostsByResource,
  type CostResource,
} from '../../src/utils/armyData';
import { getTroopImageUrl, getHeroImageUrl, getPetImageUrl, getEquipmentImageUrl, getHeroSlug } from '../../src/utils/troopImages';
import { entityRef } from '../../src/data/entityReference';
import type { TroopDetail } from '../../src/api/troopDetail';
import { ItemCard } from '../../src/components/ItemCard';
import { useGameData } from '../../src/hooks/useGameData';
import { useDiscounts } from '../../src/hooks/useDiscounts';
import { applyCostDiscount, applyTimeDiscount } from '../../src/utils/discountUtils';

import { EmptyState } from '../../src/components/EmptyState';
import { ProfileScreenSkeleton } from '../../src/components/SkeletonScreens';
import { Skeleton } from '../../src/components/Skeleton';


type Tab = 'heroes' | 'bhHeroes' | 'troops' | 'bhTroops' | 'spells' | 'pets' | 'siege' | 'equipment';

const TAB_ICONS: Record<Tab, { set: 'ion' | 'mc'; name: string }> = {
  heroes: { set: 'ion', name: 'shield-half-outline' },
  bhHeroes: { set: 'ion', name: 'shield-outline' },
  troops: { set: 'mc', name: 'sword-cross' },
  bhTroops: { set: 'ion', name: 'build-outline' },
  spells: { set: 'ion', name: 'flask-outline' },
  pets: { set: 'mc', name: 'paw' },
  siege: { set: 'ion', name: 'rocket-outline' },
  equipment: { set: 'ion', name: 'trophy-outline' },
};

// Decodes an "Unlock Requirement" value (e.g. "Buy in X event for 3,100 ... or
// purchasable from the Trader for 1,500") into discrete unlock methods.
function parseUnlockRequirements(raw: string): { source: string; cost?: string; kind: 'event' | 'shop' | 'other' }[] {
  const text = (raw || '').trim();
  if (!text) return [];
  const items: { source: string; cost?: string; kind: 'event' | 'shop' | 'other' }[] = [];
  const eventRe = /Buy in\s+([\s\S]+?)\s+event for\s+([\d,]+)/gi;
  let m: RegExpExecArray | null;
  let foundEvent = false;
  while ((m = eventRe.exec(text)) !== null) {
    items.push({ source: m[1].trim(), cost: m[2].trim(), kind: 'event' });
    foundEvent = true;
  }
  if (foundEvent) {
    const shop = text.match(/purchasable from the\s+([\s\S]+?)\s+for\s+([\d,]+)/i);
    if (shop) items.push({ source: shop[1].trim(), cost: shop[2].trim(), kind: 'shop' });
    return items;
  }
  return [{ source: text, kind: 'other' }];
}

export default function PlayerProfileScreen() {
  const { player, loading, refresh } = usePlayer();
  const { siegeMachineNames, superTroopNames, petNames } = useGameData();
  // Name sets come straight from the package (see useGameData); no fallbacks.
  const siegeNames = siegeMachineNames;
  const petNameList = petNames;
  const superNameList = superTroopNames;
  const { isDark, colors } = useTheme();
  const { discounts } = useDiscounts();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (['troops', 'spells', 'equipment', 'heroes', 'pets', 'siege'].includes(initialTab ?? '')) return initialTab as Tab;
    return 'heroes';
  });

  React.useEffect(() => {
    if (['troops', 'spells', 'equipment', 'heroes', 'pets', 'siege'].includes(initialTab ?? '')) {
      setActiveTab(initialTab as Tab);
    }
  }, [initialTab]);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedName, setExpandedName] = useState<string | null>(null);

  const [details, setDetails] = useState<Record<string, TroopDetail | null>>({});
  const [showFullLevels, setShowFullLevels] = useState<Record<string, boolean>>({});
  const [tableViewportW, setTableViewportW] = useState(0);

  type StatPill = { icon: keyof typeof Ionicons.glyphMap; value: string };

  function formatStatPills(info: TroopDetail['info']): StatPill[] {
    const pills: StatPill[] = [];

    if (info.damageType) {
      const dt = info.damageType.toLowerCase();
      let icon: keyof typeof Ionicons.glyphMap = 'flash-outline';
      let label = '';

      if (dt.includes('melee')) { icon = 'cut-outline'; label = 'Melee'; }
      else if (dt.includes('ranged')) { icon = 'arrow-up-outline'; label = 'Ranged'; }
      else if (dt.includes('splash')) {
        icon = 'flame-outline';
        const r = dt.match(/[\d.]+/);
        label = r ? `Splash ${r[0]}` : 'Splash';
      }
      else if (dt.includes('single')) { icon = 'locate-outline'; label = 'Single'; }
      else { label = dt.replace(/tile radius/i, '').trim(); }

      if (info.targetType) {
        const tt = info.targetType.toLowerCase();
        if (tt.includes('ground') && tt.includes('air')) label += ' · All';
        else if (tt.includes('ground')) label += ' · Ground';
        else if (tt.includes('air')) label += ' · Air';
      }
      pills.push({ icon, value: label });
    }

    if (info.attackSpeed) {
      const speedVal = info.attackSpeed.toLowerCase();
      const damageKeywords = /melee|ranged|splash|tile|radius|ground|air|single/i;
      if (!damageKeywords.test(speedVal)) {
        const s = speedVal.replace(/ seconds?/i, 's');
        pills.push({ icon: 'time-outline', value: s });
      }
    }

    if (info.range) {
      const r = info.range.replace(/ tiles?/i, '').trim();
      pills.push({ icon: 'radio-outline', value: r });
    }

    if (info.housingSpace > 0) {
      pills.push({ icon: 'cube-outline', value: `${info.housingSpace}` });
    }

    if (info.favoriteTarget) {
      pills.push({ icon: 'heart-half-outline', value: info.favoriteTarget });
    }

    return pills;
  }

  const toggleDetail = useCallback(async (name: string) => {
    // Collapse if already open.
    if (expandedName === name) {
      setExpandedName(null);
      return;
    }
    setExpandedName(name);
    // Fetch on first expansion (or if a previous fetch failed).
    if (details[name] === undefined) {
      const isBB = player
        ? player.troops.some((t) => t.name === name && t.village === 'builderBase') ||
          player.heroes.some((h) => h.name === name && h.village === 'builderBase')
        : false;
      let detail = await getArmyTroopDetail(name, { builderBase: isBB });
      if (detail) {
        const allItems = player
          ? [
            ...player.heroes,
            ...player.troops,
            ...player.spells,
            ...player.heroEquipment,
            ...(player.pets ?? []),
          ]
          : [];
        const match = allItems.find((i) => i.name === name);
        if (match) {
          detail.currentLevel = match.level;
          detail.maxLevel = match.maxLevel;
        }
      } else if (player) {
        const heroUrl = getHeroImageUrl(name);
        const petUrl = getPetImageUrl(name);
        const equipUrl = getEquipmentImageUrl(name);
        const imageUrl = heroUrl || petUrl || equipUrl;
        if (imageUrl) {
          const allItems = [
            ...player.heroes,
            ...player.troops,
            ...player.spells,
            ...player.heroEquipment,
            ...(player.pets ?? []),
          ];
          const match = allItems.find((i) => i.name === name);
          detail = {
            name, slug: '', description: '', imageUrl,
            currentLevel: match?.level,
            maxLevel: match?.maxLevel,
            levels: match ? [{ level: match.level, dps: 0, damagePerHit: 0, hitpoints: 0, upgradeCost: '', upgradeTime: '', xp: 0, labLevel: null, thRequired: null }] : [],
            info: { range: '', housingSpace: 0, attackSpeed: '', damageType: '', targetType: '', favoriteTarget: '' },
          };
        }
      }
      setDetails((prev) => ({ ...prev, [name]: detail ?? null }));

      // Prefetch images for caching
      const urls = [
        detail?.imageUrl,
        getHeroImageUrl(name),
        getTroopImageUrl(name),
        getPetImageUrl(name),
        getEquipmentImageUrl(name),
      ].filter((u): u is string => !!u);
      urls.forEach((url) => Image.prefetch(url).catch(() => { }));
    }
  }, [expandedName, details, player]);

  // When the equipment tab is opened, prefetch every hero-equipment detail so
  // the Blacksmith-capped max level is known immediately (without waiting for
  // each card to be expanded). Populating `details` powers getEquipmentMaxLevel.
  const prefetchEquipment = useCallback(async () => {
    if (!player || player.heroEquipment.length === 0) return;
    const names = player.heroEquipment.map((e) => e.name);
    if (names.every((n) => details[n] !== undefined)) return;
    const fetched = await Promise.all(
      names.map((name) => getArmyTroopDetail(name).catch(() => null))
    );
    const next: Record<string, TroopDetail | null> = {};
    fetched.forEach((detail, i) => {
      const name = names[i];
      if (!detail) return;
      const match = player.heroEquipment.find((e) => e.name === name);
      if (match) {
        detail.currentLevel = match.level;
        detail.maxLevel = match.maxLevel;
      }
      next[name] = detail;
      const urls = [
        detail.imageUrl,
        getEquipmentImageUrl(name),
        getTroopImageUrl(name),
      ].filter((u): u is string => !!u);
      urls.forEach((url) => Image.prefetch(url).catch(() => { }));
    });
    setDetails((prev) => ({ ...prev, ...next }));
  }, [player, details]);

  React.useEffect(() => {
    if (activeTab === 'equipment') {
      prefetchEquipment();
    }
  }, [activeTab, prefetchEquipment]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();

    // Re-fetch all troops/spells/heroes/pets/equipment, bypassing the cache so
    // that previously missing images or details get updated. Awaiting the full
    // batch keeps the spinner visible until every detail/image is refetched.
    if (player) {
      const allItems = [
        ...player.heroes,
        ...player.troops,
        ...player.spells,
        ...player.heroEquipment,
        ...(player.pets ?? []),
      ];
      const fetched = await Promise.all(
        allItems.map((item) => getArmyTroopDetail(item.name).catch(() => null))
      );
      const nextDetails: Record<string, TroopDetail | null> = {};
      fetched.forEach((detail) => {
        if (detail) {
          nextDetails[detail.name] = detail;
          // Prefetch images for caching
          const urls = [
            detail.imageUrl,
            getHeroImageUrl(detail.name),
            getTroopImageUrl(detail.name),
            getPetImageUrl(detail.name),
            getEquipmentImageUrl(detail.name),
          ].filter((u): u is string => !!u);
          urls.forEach((url) => Image.prefetch(url).catch(() => { }));
        }
      });
      setDetails((prev) => ({ ...prev, ...nextDetails }));
    }

    setRefreshing(false);
  }, [refresh, player]);

  if (loading && !player) {
    return <ProfileScreenSkeleton />;
  }

  if (!player) return null;

  const th = player.townHallLevel;
  const bhLevel = player.builderHallLevel ?? 1;
  const homeHeroes = player.heroes.filter((h) => h.village === 'home');
  const builderHeroes = th >= 6 ? player.heroes.filter((h) => h.village === 'builderBase') : [];

  const SIEGE_MACHINE_NAMES = new Set(siegeNames);
  const SUPER_TROOP_NAMES = new Set(superNameList);
  const isSiegeMachine = (name: string) => SIEGE_MACHINE_NAMES.has(name);
  const isSuperTroop = (name: string) =>
    SUPER_TROOP_NAMES.has(name) || name.startsWith('Super ') || name.startsWith('Sneaky ') || name.startsWith('Rocket ');

  const homeTroops = player.troops.filter((t) => t.village === 'home' && !isSuperTroop(t.name) && !isSiegeMachine(t.name) && !petNameList.includes(t.name));
  const builderTroops = th >= 6 ? player.troops.filter((t) => t.village === 'builderBase') : [];
  const siegeMachines = player.troops.filter((t) => t.village === 'home' && !isSuperTroop(t.name) && isSiegeMachine(t.name));
  const homePets = player.troops.filter((t) => (t.village === 'home' || !t.village) && petNameList.includes(t.name));
  const homeSpells = player.spells.filter((s) => s.village === 'home' || !s.village);

  const allTroopsAtTH = getAllItemsAtTH(player.townHallLevel).filter((i) => i.type === 'troop');
  const allSpellsAtTH = getAllItemsAtTH(player.townHallLevel).filter((i) => i.type === 'spell');
  const allHeroesAtTH = getAllItemsAtTH(player.townHallLevel).filter((i) => i.type === 'hero');

  const ownedTroopNames = new Set(homeTroops.map((t) => t.name.toLowerCase()));
  const ownedSpellNames = new Set(homeSpells.map((s) => s.name.toLowerCase()));
  const ownedHeroNames = new Set(homeHeroes.map((h) => h.name.toLowerCase()));

  const lockedTroops = allTroopsAtTH.filter((t) => !ownedTroopNames.has(t.name.toLowerCase()));
  const lockedSpells = allSpellsAtTH.filter((s) => !ownedSpellNames.has(s.name.toLowerCase()));
  const lockedHeroes = allHeroesAtTH.filter((h) => !ownedHeroNames.has(h.name.toLowerCase()));

  const splitProgress = <T extends { name: string; level: number; maxLevel: number }>(
    items: T[],
    effMax?: (item: T) => number | null
  ) => {
    const leveling: T[] = [];
    const maxed: T[] = [];
    for (const it of items) {
      const eff = effMax ? (effMax(it) ?? it.maxLevel) : (getMaxLevelAtTH(it.name, th) ?? it.maxLevel);
      if (it.level > 0 && eff > 0 && it.level >= eff) maxed.push(it);
      else leveling.push(it);
    }
    return { leveling, maxed };
  };
  const homeTroopsSplit = splitProgress(homeTroops);
  const homeSpellsSplit = splitProgress(homeSpells);
  const homeHeroesSplit = splitProgress(homeHeroes);
  const homePetsSplit = splitProgress(homePets);
  const builderTroopsSplit = splitProgress(builderTroops, (t) => getBuilderTroopMaxLevel(t.name, bhLevel));
  const builderHeroesSplit = splitProgress(builderHeroes);
  // The real, player-owned Blacksmith building level (from their profile buildings).
  // Falls back to the max the Town Hall allows if the player hasn't tracked it.
  const blacksmithLevel = player.buildingLevels?.['Blacksmith'] ?? getBuildingMaxLevelAtTH('blacksmith', player.townHallLevel) ?? 0;
  const isEquipmentName = (name: string) => player.heroEquipment.some((e) => e.name === name);

  // Prefer the bundled package icon for a card; fall back to the network
  // image helpers when the package ships no asset for the item. Level sprites
  // are reserved for the Level Appearance grid, not the cards.
  const cardIconProps = (name: string, level?: number | null): { icon?: string; iconSource?: ImageSourcePropType } => {
    const local = getArmyItemImage(name);
    if (local) return { iconSource: local };
    return {
      icon:
        getTroopImageUrl(name, level ?? undefined) ||
        getHeroImageUrl(name) ||
        getPetImageUrl(name) ||
        getEquipmentImageUrl(name) ||
        undefined,
    };
  };

  // Highest equipment level reachable at the player's Blacksmith level: each
  // equipment stat row lists a "Blacksmith Level Required" gate, so the cap is
  // the last level whose requirement is satisfied by the owned building.
  const getEquipmentMaxLevel = (name: string): number => {
    const detail = details[name];
    if (detail && detail.levels.length > 0) {
      let max = 0;
      for (const lvl of detail.levels) {
        if (lvl.labLevel == null || lvl.labLevel <= blacksmithLevel) {
          max = Math.max(max, lvl.level);
        }
      }
      return max;
    }
    return 0;
  };

  const isBuilderBaseName = (name: string) =>
    player.troops.some((t) => t.name === name && t.village === 'builderBase') ||
    player.heroes.some((h) => h.name === name && h.village === 'builderBase');

  const getLabBuilding = (name: string, tab: Tab): string => {
    switch (tab) {
      case 'heroes':
      case 'bhHeroes': return 'Hero Hall';
      case 'pets': return 'Pet House';
      case 'equipment': return 'Blacksmith';
      case 'spells': return 'Laboratory';
      case 'troops': return 'Laboratory';
      case 'bhTroops': return 'Star Laboratory';
      case 'siege': return 'Workshop';
    }
  };

  // Returns the level rows to show for an expanded item, applying the right
  // gating per village. Home troops/spells/pets/heroes are capped by the max
  // reachable at the player's Town Hall (via their gating building's max level
  // at that TH — never the player's own building level); equipment by the
  // player's Blacksmith; Builder Base units by their Star Lab at the BH.
  const getVisibleLevels = (detail: TroopDetail): TroopDetail['levels'] => {
    const isHero = !!getHeroSlug(detail.name);
    const isBB = isBuilderBaseName(detail.name);
    if (isBB) {
      if (isHero) return detail.levels;
      const bbCap = getBuilderTroopMaxLevel(detail.name, bhLevel) ?? bhLevel * 2;
      return detail.levels.filter((l) => l.level <= bbCap);
    }
    // Hero equipment is gated by the player's Blacksmith level, not the troop lab.
    if (isEquipmentName(detail.name)) {
      return detail.levels.filter((l) => l.labLevel == null || l.labLevel <= blacksmithLevel);
    }
    const maxAtTH = getMaxLevelAtTH(detail.name, player.townHallLevel);
    if (maxAtTH !== null) return detail.levels.filter((l) => l.level <= maxAtTH);
    return detail.levels;
  };

  // Inline expansion panel rendered directly under a tapped card (replaces the
  // old modal). Because it lives in the page's own ScrollView, the stats table
  // scrolls naturally with the page — no nested-scroll quirks.
  const renderDetailPanel = (name: string) => {
    if (expandedName !== name) return null;
    const detail = details[name];

    if (detail === undefined) {
      return (
        <View style={[styles.panel, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
          {/* Description skeleton */}
          <View style={{ marginBottom: Spacing.base, gap: 4 }}>
            <Skeleton width="100%" height={10} borderRadius={3} />
            <Skeleton width="75%" height={10} borderRadius={3} />
          </View>
          {/* Pills skeleton */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.base }}>
            {[60, 50, 70, 40].map((w, i) => (
              <Skeleton key={i} width={w} height={22} borderRadius={11} />
            ))}
          </View>
          {/* Stats table skeleton */}
          <View style={{ borderWidth: 0.75, borderColor: colors.border, borderRadius: Radius.sm, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
              {['Lvl', 'DPS', 'HP', 'Cost', 'Time', 'Lab'].map((_, i) => (
                <View key={i} style={{ flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, alignItems: 'center' }}>
                  <Skeleton width={i === 0 ? 20 : 30} height={10} borderRadius={3} />
                </View>
              ))}
            </View>
            {[0, 1, 2].map((r) => (
              <View key={r} style={{ flexDirection: 'row', borderBottomWidth: r < 2 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }}>
                {[0, 1, 2, 3, 4, 5].map((c) => (
                  <View key={c} style={{ flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, alignItems: 'center' }}>
                    <Skeleton width={c === 0 ? 16 : c === 3 ? 36 : 28} height={10} borderRadius={3} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    }
    if (detail === null) {
      return (
        <View style={[styles.panelEmpty, { borderColor: colors.border }]}>
          <Text style={[styles.panelEmptyText, { color: colors.textTertiary }]}>
            No detailed stats available for {name}.
          </Text>
        </View>
      );
    }

    const isHero = !!getHeroSlug(detail.name);
    const isBB = isBuilderBaseName(detail.name);
    const isEquip = isEquipmentName(detail.name);
    const maxReachable = isEquip ? getEquipmentMaxLevel(detail.name) || null : getMaxLevelAtTH(detail.name, player.townHallLevel);
    const visibleDetailLevels = getVisibleLevels(detail);

    const currentLevel = detail.currentLevel ?? 0;
    const showFull = showFullLevels[name] || false;

    let displayLevels: TroopDetail['levels'];
    if (showFull || visibleDetailLevels.length <= 3) {
      displayLevels = visibleDetailLevels;
    } else {
      const currentIdx = visibleDetailLevels.findIndex((l) => l.level === currentLevel);
      const start = Math.max(0, currentIdx - 1);
      const end = Math.min(visibleDetailLevels.length, currentIdx + 2);
      displayLevels = visibleDetailLevels.slice(start, end);
    }

    const pills = formatStatPills(detail.info);
    const infoItems = pills.length ? pills : (detail.infoPairs ?? []).map((p) => ({ icon: 'information-circle-outline' as const, value: `${p.label}: ${p.value}` }));
    const unlockReq = detail.infoPairs?.find((i) => i.label === 'Unlock Requirement');
    const unlockReqItems = unlockReq ? parseUnlockRequirements(unlockReq.value) : [];
    const unlockHasCost = unlockReqItems.some((r) => r.cost);

    const isTroopLike = (detail.levels[0]?.dps ?? 0) > 0 || (detail.levels[0]?.hitpoints ?? 0) > 0;
    const extraLabels = detail.levels[0]?.extra?.map((e) => e.label) ?? [];
    const showDiscounted = discounts.army.costPercent > 0 || discounts.army.timePercent > 0;
    const contentMinW = 28 + 56 + 48 + 72 + (isTroopLike ? 36 + 36 : Math.max(extraLabels.length, 1) * 54);

    // Acronyms for long column names
    const acronymMap = new Map<string, string>();
    const legendEntries: { acronym: string; full: string }[] = [];
    for (const lbl of extraLabels) {
      if (lbl.length > 6) {
        const acronym = lbl.split(/\s+/).map((w) => w[0]).join('').toUpperCase();
        if (acronym !== lbl) {
          acronymMap.set(lbl, acronym);
          legendEntries.push({ acronym, full: lbl });
        }
      }
    }
    const headerLabels = extraLabels.map((lbl) => acronymMap.get(lbl) ?? lbl);

    return (
      <View style={[styles.panel, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
        {detail.description ? (
          <View style={styles.panelHeader}>
            <Text style={[styles.panelDesc, { color: colors.textTertiary }]}>{detail.description}</Text>
          </View>
        ) : null}

        {pills.length > 0 && (
          <View style={styles.panelPillsRow}>
            {pills.map((pill, i) => (
              <View key={`${pill.icon}-${pill.value}-${i}`} style={[styles.panelPill, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Ionicons name={pill.icon} size={11} color={colors.textSecondary} />
                <Text style={[styles.panelPillText, { color: colors.textPrimary }]}>{pill.value}</Text>
              </View>
            ))}
          </View>
        )}

        {unlockReqItems.length > 0 ? (
          <View style={[styles.panelTable, { borderColor: colors.border }]}>
            <View style={[styles.panelTableRow, { borderBottomColor: colors.border }]}>
              <Text
                style={[
                  styles.panelTableCell,
                  styles.panelTableHeader,
                  { backgroundColor: colors.bgCard, color: colors.textMuted, textAlign: 'center', flex: unlockHasCost ? 2 : 1 },
                ]}
              >
                {unlockHasCost ? 'Unlock Method' : 'Unlock Requirement'}
              </Text>
              {unlockHasCost ? (
                <Text
                  style={[
                    styles.panelTableCell,
                    styles.panelTableHeader,
                    { backgroundColor: colors.bgCard, color: colors.textMuted },
                  ]}
                >
                  Cost
                </Text>
              ) : null}
            </View>
            {unlockReqItems.map((r, i) => (
              <View key={i} style={[styles.panelTableRow, { borderBottomColor: colors.border }]}>
                <Text
                  style={[
                    styles.panelTableCell,
                    { color: colors.textSecondary, textAlign: 'center', flex: unlockHasCost ? 2 : 1, paddingLeft: Spacing.base },
                  ]}
                >
                  {r.source}
                </Text>
                {unlockHasCost ? (
                  <Text style={[styles.panelTableCell, { color: colors.textPrimary, fontWeight: '600' }]}>{r.cost}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {visibleDetailLevels.length > 0 && (() => {
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

          const remainingLevels = visibleDetailLevels.filter((l) => l.level > currentLevel && (maxReachable != null ? l.level <= maxReachable : true));
          const resourceSums = sumLevelCostsByResource(visibleDetailLevels, currentLevel, maxReachable);
          const totalCost = resourceSums.reduce((s, r) => s + r.amount, 0);
          let totalTime = 0;
          for (const lvl of remainingLevels) {
            if (lvl.upgradeTime) totalTime += parseTime(lvl.upgradeTime);
          }
          const hasRemaining = remainingLevels.length > 0 && totalCost > 0;
          // Home-base units with per-level cosmetic sprites show their visual
          // progression (current + upcoming levels) until they're maxed.
          const showAppearance =
            !isBB && !isHero && !isEquip && isTroopLike &&
            entityRef(detail.name)?.levelSuffix === true &&
            remainingLevels.length > 0;
          const appearanceLevels = showAppearance ? [currentLevel, ...remainingLevels.map((l) => l.level)] : [];
          return (
          <>
            {showAppearance && (
              <>
                <Text style={[styles.panelSectionTitle, { color: colors.textPrimary }]}>Level Appearance</Text>
                <View style={[styles.troopLevelGridBorder, { borderColor: colors.border }]}>
                  <View style={styles.troopLevelGrid}>
                    {appearanceLevels.map((lvl) => {
                      const isCurrent = lvl === currentLevel;
                      const localImg = getArmyItemImage(detail.name, lvl);
                      const img = localImg ? null : getTroopImageUrl(detail.name, lvl);
                      return (
                        <View key={lvl} style={[styles.troopLevelCell, { borderColor: colors.border }, isCurrent && styles.troopLevelCellCurrent]}>
                          <View style={styles.troopLevelImgWrap}>
                            {localImg ? (
                              <Image source={localImg} style={styles.troopLevelImg} resizeMode="contain" />
                            ) : img ? (
                              <Image source={{ uri: img }} style={styles.troopLevelImg} resizeMode="contain" />
                            ) : (
                              <View style={[styles.troopLevelImg, styles.troopLevelImgFallback]}>
                                <Text style={styles.troopLevelFallbackText}>{detail.name.charAt(0)}</Text>
                              </View>
                            )}
                            <View style={[styles.troopLevelBadge, isCurrent && styles.troopLevelBadgeCurrent]}>
                              <Text style={[styles.troopLevelBadgeText, isCurrent && styles.troopLevelBadgeTextCurrent]}>
                                {lvl}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </>
            )}
            {hasRemaining && (
              <View style={[styles.panelTable, { borderColor: colors.border, marginBottom: Spacing.md }]}>
                <View style={[styles.panelTableRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, flex: 1 }]}>Remaining ({remainingLevels.length} lvls)</Text>
                  <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>Cost</Text>
                  <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>Time</Text>
                </View>
                <View style={styles.panelTableRow}>
                  <Text style={[styles.panelTableCell, { color: colors.textSecondary, flex: 1, paddingLeft: Spacing.base }]}>
                    Lv{currentLevel} → Lv{maxReachable != null ? maxReachable : visibleDetailLevels[visibleDetailLevels.length - 1]?.level ?? '?'}
                  </Text>
                  <View style={[styles.panelTableCell, { alignItems: 'center', gap: 2, justifyContent: 'center' }]}>
                    {resourceSums.length > 0 ? (
                      resourceSums.map((s) => (
                        <Text
                          key={s.resource}
                          style={{
                            color: showDiscounted ? colors.warning : RESOURCE_META[s.resource].color,
                            fontWeight: '600',
                            fontSize: 12,
                          }}
                        >
                          {showDiscounted ? applyCostDiscount(fmtCost(s.amount), discounts.army) : fmtCost(s.amount)} {RESOURCE_META[s.resource].short}
                        </Text>
                      ))
                    ) : (
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>—</Text>
                    )}
                  </View>
                  <Text style={[styles.panelTableCell, { color: showDiscounted ? colors.warning : colors.textPrimary, fontWeight: '600' }]}>
                    {showDiscounted ? applyTimeDiscount(fmtTime(totalTime), discounts.army) : fmtTime(totalTime)}
                  </Text>
                </View>
              </View>
            )}
            <Text style={[styles.panelSectionTitle, { color: colors.textPrimary }]}>Level Stats</Text>
            {legendEntries.length > 0 && (
              <View style={{ marginBottom: Spacing.sm }}>
                {legendEntries.map((e) => (
                  <Text key={e.acronym} style={[styles.panelLegend, { color: colors.textTertiary }]}>
                    <Text style={{ fontWeight: '700' }}>{e.acronym}</Text> = {e.full}
                  </Text>
                ))}
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.base }} onLayout={(e) => setTableViewportW(e.nativeEvent.layout.width)}>
              <View style={[styles.panelTable, { borderColor: colors.border, minWidth: Math.max(tableViewportW || contentMinW, contentMinW) }]}>
                <View style={[styles.panelTableRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 28 }]}>Lvl</Text>
                  {isTroopLike ? (
                    <>
                      <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 36 }]}>DPS</Text>
                      <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 36 }]}>HP</Text>
                    </>
                  ) : (
                    (headerLabels.length ? headerLabels : ['Val']).map((lbl, i) => (
                      <Text key={i} style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 54 }]}>{lbl}</Text>
                    ))
                  )}
                  <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 56 }]}>Cost</Text>
                  <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 48 }]}>Time</Text>
                  <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 72 }]}>
                    {getLabBuilding(detail.name, activeTab)}
                  </Text>
                </View>
                {displayLevels.map((l) => {
                  const isCurrentRow = l.level === currentLevel;
                  return (
                    <View key={l.level} style={[styles.panelTableRow, { borderBottomColor: colors.border }, isCurrentRow && { backgroundColor: colors.accentGhost }]}>
                      <Text style={[styles.panelTableCell, { color: colors.textSecondary, minWidth: 28 }]}>{l.level}</Text>
                      {isTroopLike ? (
                        <>
                          <Text style={[styles.panelTableCell, { color: colors.textSecondary, minWidth: 36 }]}>{l.dps}</Text>
                          <Text style={[styles.panelTableCell, { color: colors.textSecondary, minWidth: 36 }]}>{l.hitpoints}</Text>
                        </>
                      ) : (
                        (extraLabels.length ? extraLabels : ['Value']).map((lbl, i) => (
                          <Text key={i} style={[styles.panelTableCell, { color: colors.textSecondary, minWidth: 54 }]}>
                            {l.extra?.find((e) => e.label === lbl)?.value ?? '—'}
                          </Text>
                        ))
                      )}
                      <Text
                        style={[
                          styles.panelTableCell,
                          {
                            color: showDiscounted
                              ? colors.warning
                              : l.costResource
                                ? RESOURCE_META[l.costResource as CostResource].color
                                : colors.textSecondary,
                            minWidth: 56,
                          },
                        ]}
                      >
                        {showDiscounted ? applyCostDiscount(l.upgradeCost || '—', discounts.army) : (l.upgradeCost || '—')}
                      </Text>
                      <Text style={[styles.panelTableCell, { color: showDiscounted ? colors.warning : colors.textSecondary, minWidth: 48 }]}>{showDiscounted ? applyTimeDiscount(l.upgradeTime || '—', discounts.army) : (l.upgradeTime || '—')}</Text>
                      <Text style={[styles.panelTableCell, { color: colors.textSecondary, minWidth: 72 }]}>{l.labLevel ?? '—'}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            {visibleDetailLevels.length > 3 && (
              <PressableRipple
                style={styles.expandTableBtn}
                onPress={() => setShowFullLevels((prev) => ({ ...prev, [name]: !showFull }))}
              >
                <Ionicons name={showFull ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textSecondary} />
                <Text style={styles.expandTableText}>
                  {showFull ? 'Show fewer' : `Show all ${visibleDetailLevels.length} levels`}
                </Text>
              </PressableRipple>
            )}
            <Text style={[styles.panelNote, { color: colors.textMuted }]}>
              {isBB
                ? isHero
                  ? `Showing all Builder Base levels for ${detail.name}`
                  : `Showing all Builder Base levels reachable at BH ${bhLevel} (Max Lv${getBuilderTroopMaxLevel(detail.name, bhLevel) ?? bhLevel * 2})`
                : isEquip
                  ? `Showing all levels reachable with your Blacksmith at Lv${blacksmithLevel}`
                  : maxReachable != null
                    ? `Showing all levels reachable at TH ${player.townHallLevel} (Max Lv${maxReachable})`
                    : `Showing all levels for ${detail.name}`}
            </Text>
          </>
        );})()}
      </View>
    );
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'heroes', label: 'Heroes' },
    { key: 'bhHeroes', label: 'BH Heroes' },
    { key: 'troops', label: 'Troops' },
    { key: 'bhTroops', label: 'BH Troops' },
    { key: 'spells', label: 'Spells' },
    { key: 'pets', label: 'Pets' },
    { key: 'siege', label: 'Siege' },
    { key: 'equipment', label: 'Gear' },
  ];

  const hasHeroes = homeHeroes.length > 0;
  const hasBhHeroes = builderHeroes.length > 0;
  const hasTroops = homeTroops.length > 0;
  const hasBhTroops = builderTroops.length > 0;
  const hasSpells = player.spells.filter((s) => s.village === 'home' || !s.village).length > 0;
  const hasPets = homePets.length > 0;
  const hasSiege = siegeMachines.length > 0;
  const hasEquipment = player.heroEquipment.length > 0;

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'heroes') return hasHeroes;
    if (tab.key === 'bhHeroes') return hasBhHeroes;
    if (tab.key === 'troops') return hasTroops;
    if (tab.key === 'bhTroops') return hasBhTroops;
    if (tab.key === 'spells') return hasSpells;
    if (tab.key === 'pets') return hasPets;
    if (tab.key === 'siege') return hasSiege;
    if (tab.key === 'equipment') return hasEquipment;
    return true;
  });

  React.useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
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
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Army</Text>
            <Text style={styles.subtitle}>All your troops, heroes, spells & equipment</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
            <PressableRipple
              onPress={onRefresh}
              disabled={refreshing}
              hitSlop={12}
              style={styles.headerRefreshBtn}
              accessibilityLabel="Force refresh all images and details"
              accessibilityRole="button"
            >
              <Ionicons
                name={refreshing ? 'sync-circle' : 'refresh-circle-outline'}
                size={28}
                color={refreshing ? Colors.textTertiary : colors.textSecondary}
              />
            </PressableRipple>
          </View>
        </View>

        <View style={styles.tabsContainer}>
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const iconDef = TAB_ICONS[tab.key];
            const iconColor = isActive ? Colors.bg : Colors.textSecondary;
            return (
              <PressableRipple
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                {iconDef.set === 'mc' ? (
                  <MaterialCommunityIcons name={iconDef.name as any} size={14} color={iconColor} />
                ) : (
                  <Ionicons name={iconDef.name as any} size={14} color={iconColor} />
                )}
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </PressableRipple>
            );
          })}
        </View>

        <View style={styles.tabContent}>
              {activeTab === 'heroes' && (
            <>
              {homeHeroesSplit.leveling.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Upgrading</Text>
                  {homeHeroesSplit.leveling.map((h, i) => (
                    <React.Fragment key={h.name}>
                      <ItemCard
                        name={h.name}
                        level={h.level}
                        maxLevel={h.maxLevel}
                        thMaxLevel={getMaxLevelAtTH(h.name, th)}
                        subtitle={h.equipment?.map((e) => e.name).join(', ')}
                        {...cardIconProps(h.name)}
                        onPress={() => toggleDetail(h.name)}
                        isFirst={i == 0 || expandedName === h.name}
                        isLast={i == homeHeroesSplit?.leveling?.length - 1 && expandedName !== h.name}
                      />
                      {renderDetailPanel(h.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
              {lockedHeroes.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Locked</Text>
                  {lockedHeroes.map((h, i) => (
                    <ItemCard
                      key={h.name}
                      name={h.name}
                      level={0}
                      maxLevel={h.maxLevel}
                      thMaxLevel={h.maxLevel}
                        {...cardIconProps(h.name)}
                      locked
                      isFirst={i == 0}
                      isLast={i == lockedHeroes?.length - 1}
                    />
                  ))}
                </>
              )}
              {homeHeroesSplit.maxed.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Maxed</Text>
                  {homeHeroesSplit.maxed.map((h, i) => (
                    <React.Fragment key={h.name}>
                      <ItemCard
                        name={h.name}
                        level={h.level}
                        maxLevel={h.maxLevel}
                        thMaxLevel={getMaxLevelAtTH(h.name, th)}
                        subtitle={h.equipment?.map((e) => e.name).join(', ')}
                        {...cardIconProps(h.name)}
                        onPress={() => toggleDetail(h.name)}
                        isFirst={i == 0 || expandedName === h.name}
                        isLast={i == homeHeroesSplit?.maxed?.length - 1 && expandedName !== h.name}
                      />
                      {renderDetailPanel(h.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
              {homeHeroes.length === 0 && lockedHeroes.length === 0 && (
                <EmptyState
                  icon="👑"
                  title="No heroes yet"
                  description="Heroes unlock at higher Town Hall levels. Your first hero, the Barbarian King, is available at TH7."
                />
              )}
            </>
          )}

          {activeTab === 'bhHeroes' && (
            <>
              {builderHeroes.length === 0 ? (
                <EmptyState
                  icon="🛡️"
                  title="No Builder Base heroes"
                  description="Builder Base heroes unlock at BH6. The Battle Machine is your first Builder Base hero."
                />
              ) : (
                <>
                  {builderHeroesSplit.leveling.length > 0 && (
                    <>
                      <Text style={styles.sectionHeader}>Upgrading</Text>
                      {builderHeroesSplit.leveling.map((h, i) => (
                        <React.Fragment key={h.name}>
                          <ItemCard
                            name={h.name}
                            level={h.level}
                            maxLevel={h.maxLevel}
                            {...cardIconProps(h.name)}
                            onPress={() => toggleDetail(h.name)}
                            isFirst={i == 0 || expandedName === h.name}
                            isLast={i == builderHeroesSplit?.leveling?.length - 1 && expandedName !== h.name}
                          />
                          {renderDetailPanel(h.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                  {builderHeroesSplit.maxed.length > 0 && (
                    <>
                      <Text style={styles.sectionHeader}>Maxed</Text>
                      {builderHeroesSplit.maxed.map((h, i) => (
                        <React.Fragment key={h.name}>
                          <ItemCard
                            name={h.name}
                            level={h.level}
                            maxLevel={h.maxLevel}
                            {...cardIconProps(h.name)}
                            onPress={() => toggleDetail(h.name)}
                            isFirst={i == 0 || expandedName === h.name}
                            isLast={i == builderHeroesSplit?.maxed?.length - 1 && expandedName !== h.name}
                          />
                          {renderDetailPanel(h.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'troops' && (
            <>
              {homeTroopsSplit.leveling.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Upgrading</Text>
                  {homeTroopsSplit.leveling.map((t, i) => (
                    <React.Fragment key={t.name}>
                      <ItemCard
                        name={t.name}
                        level={t.level}
                        maxLevel={t.maxLevel}
                        thMaxLevel={getMaxLevelAtTH(t.name, th)}
                        {...cardIconProps(t.name, t.level)}
                        onPress={() => toggleDetail(t.name)}
                        isFirst={i == 0 || expandedName === t.name}
                        isLast={i == homeTroopsSplit?.leveling?.length - 1 && expandedName !== t.name}
                      />
                      {renderDetailPanel(t.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
              {lockedTroops.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Locked</Text>
                  {lockedTroops.map((t, i) => (
                    <ItemCard
                      key={t.name}
                      name={t.name}
                      level={0}
                      maxLevel={t.maxLevel}
                      thMaxLevel={t.maxLevel}
                            {...cardIconProps(t.name, 1)}
                      locked
                      isFirst={i == 0}
                      isLast={i == lockedTroops.length - 1}
                    />
                  ))}
                </>
              )}
              {homeTroopsSplit.maxed.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Maxed</Text>
                  {homeTroopsSplit.maxed.map((t, i) => (
                    <React.Fragment key={t.name}>
                      <ItemCard
                        name={t.name}
                        level={t.level}
                        maxLevel={t.maxLevel}
                        thMaxLevel={getMaxLevelAtTH(t.name, th)}
                        {...cardIconProps(t.name, t.level)}
                        onPress={() => toggleDetail(t.name)}
                        isFirst={i == 0 || expandedName === t.name}
                        isLast={i == homeTroopsSplit?.maxed?.length - 1 && expandedName !== t.name}
                      />
                      {renderDetailPanel(t.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
              {homeTroops.length === 0 && lockedTroops.length === 0 && (
                <EmptyState
                  icon="⚔️"
                  title="No troops yet"
                  description="Troops unlock as you progress. Your first troop, the Barbarian, is available from TH1."
                />
              )}
            </>
          )}

          {activeTab === 'bhTroops' && (
            <>
              {builderTroops.length === 0 ? (
                <EmptyState
                  icon="🔨"
                  title="No Builder Base troops"
                  description="Builder Base troops are unlocked as you progress through the Builder Base."
                />
              ) : (
                <>
                  {builderTroopsSplit.leveling.length > 0 && (
                    <>
                      <Text style={styles.sectionHeader}>Upgrading</Text>
                      {builderTroopsSplit.leveling.map((t, i) => (
                        <React.Fragment key={t.name}>
                          <ItemCard
                            name={t.name}
                            level={t.level}
                            maxLevel={getBuilderTroopMaxLevel(t.name, bhLevel) ?? t.maxLevel}
                            {...cardIconProps(t.name, t.level)}
                            onPress={() => toggleDetail(t.name)}
                            isFirst={i == 0 || expandedName === t.name}
                            isLast={i == builderTroopsSplit?.leveling?.length - 1 && expandedName !== t.name}
                          />
                          {renderDetailPanel(t.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                  {builderTroopsSplit.maxed.length > 0 && (
                    <>
                      <Text style={styles.sectionHeader}>Maxed</Text>
                      {builderTroopsSplit.maxed.map((t, i) => (
                        <React.Fragment key={t.name}>
                          <ItemCard
                            name={t.name}
                            level={t.level}
                            maxLevel={getBuilderTroopMaxLevel(t.name, bhLevel) ?? t.maxLevel}
                            {...cardIconProps(t.name, t.level)}
                            onPress={() => toggleDetail(t.name)}
                            isFirst={i == 0 || expandedName === t.name}
                            isLast={i == builderTroopsSplit?.maxed?.length - 1 && expandedName !== t.name}
                          />
                          {renderDetailPanel(t.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'siege' && (
            <>
              {siegeMachines.length === 0 ? (
                <EmptyState
                  icon="🚀"
                  title="No siege machines"
                  description="Siege Machines unlock at TH12 with the Workshop. You can request them from your clanmates."
                />
              ) : (
                <>
                  {siegeMachines.map((s, i) => (
                    <React.Fragment key={s.name}>
                      <ItemCard
                        name={s.name}
                        level={s.level}
                        maxLevel={s.maxLevel}
                        thMaxLevel={getMaxLevelAtTH(s.name, th)}
                            {...cardIconProps(s.name, s.level)}
                        onPress={() => toggleDetail(s.name)}
                        isFirst={i == 0 || expandedName === s.name}
                        isLast={i == siegeMachines.length - 1 && expandedName !== s.name}
                      />
                      {renderDetailPanel(s.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          )}

          {activeTab === 'spells' && (
            <>
              {homeSpellsSplit.leveling.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Upgrading</Text>
                  {homeSpellsSplit.leveling.map((s, i) => (
                    <React.Fragment key={s.name}>
                      <ItemCard
                        name={s.name}
                        level={s.level}
                        maxLevel={s.maxLevel}
                        thMaxLevel={getMaxLevelAtTH(s.name, th)}
                        {...cardIconProps(s.name)}
                        onPress={() => toggleDetail(s.name)}
                        isFirst={i == 0 || expandedName === s.name}
                        isLast={i == homeSpellsSplit?.leveling?.length - 1 && expandedName !== s.name}
                      />
                      {renderDetailPanel(s.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
              {lockedSpells.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Locked</Text>
                  {lockedSpells.map((s, i) => (
                    <ItemCard
                      key={s.name}
                      name={s.name}
                      level={0}
                      maxLevel={s.maxLevel}
                      thMaxLevel={s.maxLevel}
                      {...cardIconProps(s.name)}
                      locked
                      isFirst={i == 0}
                      isLast={i == lockedSpells.length - 1}
                    />
                  ))}
                </>
              )}
              {homeSpellsSplit.maxed.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Maxed</Text>
                  {homeSpellsSplit.maxed.map((s, i) => (
                    <React.Fragment key={s.name}>
                      <ItemCard
                        name={s.name}
                        level={s.level}
                        maxLevel={s.maxLevel}
                        thMaxLevel={getMaxLevelAtTH(s.name, th)}
                        {...cardIconProps(s.name)}
                        onPress={() => toggleDetail(s.name)}
                        isFirst={i == 0 || expandedName === s.name}
                        isLast={i == homeSpellsSplit?.maxed?.length - 1 && expandedName !== s.name}
                      />
                      {renderDetailPanel(s.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
              {homeSpells.length === 0 && lockedSpells.length === 0 && (
                <EmptyState
                  icon="✨"
                  title="No spells yet"
                  description="Spells unlock at TH5. Your first spell, the Lightning Spell, is available at TH5."
                />
              )}
            </>
          )}

          {activeTab === 'pets' && (
            <>
              {homePets.length === 0 ? (
                <EmptyState
                  icon="🐾"
                  title="No pets yet"
                  description="Pets unlock at TH14 with the Pet House. They follow and fight alongside your heroes in battle."
                />
              ) : (
                <>
                  {homePetsSplit.leveling.length > 0 && (
                    <>
                      <Text style={styles.sectionHeader}>Upgrading</Text>
                      {homePetsSplit.leveling.map((p, i) => (
                        <React.Fragment key={p.name}>
                          <ItemCard
                            name={p.name}
                            level={p.level}
                            maxLevel={p.maxLevel}
                            thMaxLevel={getMaxLevelAtTH(p.name, th)}
                            {...cardIconProps(p.name)}
                            onPress={() => toggleDetail(p.name)}
                            isFirst={i == 0 || expandedName === p.name}
                            isLast={i == homePetsSplit?.leveling?.length - 1 && expandedName !== p.name}
                          />
                          {renderDetailPanel(p.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                  {homePetsSplit.maxed.length > 0 && (
                    <>
                      <Text style={styles.sectionHeader}>Maxed</Text>
                      {homePetsSplit.maxed.map((p, i) => (
                        <React.Fragment key={p.name}>
                          <ItemCard
                            name={p.name}
                            level={p.level}
                            maxLevel={p.maxLevel}
                            thMaxLevel={getMaxLevelAtTH(p.name, th)}
                            {...cardIconProps(p.name)}
                            onPress={() => toggleDetail(p.name)}
                            isFirst={i == 0 || expandedName === p.name}
                            isLast={i == homePetsSplit?.maxed?.length - 1 && expandedName !== p.name}
                          />
                          {renderDetailPanel(p.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'equipment' && (
            <>
              {player.heroEquipment.length === 0 ? (
                <EmptyState
                  icon="🛡️"
                  title="No equipment yet"
                  description="Hero equipment unlocks at TH8 with the Blacksmith. Equip your heroes with special abilities."
                />
              ) : (
                <>
                  <View style={{ paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm }}>
                <Text style={{ fontSize: 12, color: Colors.textTertiary, fontStyle: 'italic' }}>
                  Levels shown reflect your Blacksmith (Lv {blacksmithLevel}).
                </Text>
              </View>
                  {player.heroEquipment.map((e, i) => (
                    <React.Fragment key={e.name}>
                      <ItemCard
                        name={e.name}
                        level={e.level}
                        maxLevel={e.maxLevel}
                        thMaxLevel={getEquipmentMaxLevel(e.name) || undefined}
                        {...cardIconProps(e.name)}
                        onPress={() => toggleDetail(e.name)}
                        isFirst={i == 0 || expandedName === e.name}
                        isLast={i == player.heroEquipment.length - 1 && expandedName !== e.name}
                      />
                      {renderDetailPanel(e.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          )}
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
  },
  loadingText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerRefreshBtn: {
    padding: Spacing.xs,
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
  tabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  tabText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.bg,
  },
  tabContent: {
    paddingHorizontal: Spacing.base,
  },

  // ── Inline detail panel (expands below a tapped card) ──
  panel: {
    marginTop: 2,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  panelEmpty: {
    paddingVertical: Spacing.base,
    borderWidth: 0.75,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  panelEmptyText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  panelImage: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
  },
  panelDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
    flex: 1,
  },
  // ── Stat pills (icon + concise tag) ──
  panelPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    rowGap: Spacing.sm,
    marginBottom: Spacing.base,
    width: '100%',
  },
  panelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 0.75,
  },
  panelPillText: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 10,
  },
  panelNote: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
    fontStyle: 'italic',
  },
  panelSectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
  panelLegend: {
    ...Typography.caption,
    fontSize: 10,
    marginBottom: Spacing.sm,
  },
  troopLevelGridBorder: {
    borderRadius: Radius.sm,
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.base,
  },
  troopLevelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  troopLevelCell: {
    width: '19.99%',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  troopLevelCellCurrent: {
    backgroundColor: Colors.accentGhost,
  },
  troopLevelImgWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  troopLevelImg: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
  },
  troopLevelImgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  troopLevelFallbackText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 9,
  },
  troopLevelBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 14,
    borderRadius: 3,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  troopLevelBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  troopLevelBadgeCurrent: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  troopLevelBadgeTextCurrent: {
    color: Colors.bg,
  },
  expandTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginTop: -Spacing.base,
  },
  expandTableText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  panelTable: {
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    marginBottom: Spacing.base,
    overflow: 'hidden',
  },
  panelTableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  panelTableCell: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textSecondary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    textAlign: 'center',
  },
  panelTableHeader: {
    color: Colors.textMuted,
    fontWeight: '600',
    backgroundColor: Colors.bgSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingVertical: Spacing.sm,
  },
});
