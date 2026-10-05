import React, { useState, useCallback, useMemo } from 'react';
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
import { SPELL_STAT_ICONS } from '../../src/utils/statImages';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme, clashFontFamily } from '../../src/theme';
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
import { entityRef } from '../../src/data/entityReference';
import { getBuildingItemImage } from '../../src/utils/buildingData';
import { getTownHallImageSource } from '../../src/utils/buildingImages';
import { PACKAGE_RESOURCE_IMAGES } from '../../src/data/packageImages';
import type { TroopDetail } from '../../src/api/troopDetail';
import { ItemCard } from '../../src/components/ItemCard';
import { useGameData } from '../../src/hooks/useGameData';
import { useDiscounts } from '../../src/hooks/useDiscounts';
import { applyCostDiscount, applyTimeDiscount } from '../../src/utils/discountUtils';
import { canPivot, isPivotable, pivotSpanCount, resolvePivotBound } from '../../src/utils/upgradePivot';

import { EmptyState } from '../../src/components/EmptyState';
import { ProfileScreenSkeleton } from '../../src/components/SkeletonScreens';
import { Skeleton } from '../../src/components/Skeleton';
import BottomSheet from '../../src/components/BottomSheet';

const lockedImage = require('../../assets/images/chiefs-journey/locked.png');


type Tab = 'heroes' | 'bhHeroes' | 'troops' | 'bhTroops' | 'spells' | 'pets' | 'siege' | 'equipment';
type TabDef = { key: Tab; label: string };

/** The only two Builder Base tabs; everything else belongs to the Home Village. */
const isBBTab = (key: Tab) => key === 'bhTroops' || key === 'bhHeroes';

// Cached troop details are keyed by name, but Home and Builder Base share names
// (e.g. "Baby Dragon"). Disambiguate the cache key with the village.
const detailCacheKey = (name: string, isBB: boolean) => (isBB ? `${name}__builder` : name);

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

// Chips sit two to a row. Wider than the previous three-up, which left the
// longer labels ("BH Heroes") and their "3/10 maxed" subtitles truncated.
const CHIP_COLUMNS = 2;

// The Clash API returns the Battle Machine and Battle Copter inside the `heroes`
// array (see entityReference), so they can lead the Builder Base hero list and
// would otherwise put a troop's art on the BH Heroes chip.
const BH_HERO_MACHINES = new Set(['Battle Machine', 'Battle Copter']);

/**
 * Seamless-grid corner rounding, matching the resource grid on the Time to Max
 * hero card: the chips read as one rounded block, so only the four outermost
 * corners take the large radius and the interior seams stay at Radius.sm.
 *
 * Derived from the cell index rather than hardcoded, because the chip count
 * varies with whatever the player owns and the last row is often partial. A cell
 * can be simultaneously the first and last of its row, and both the top and
 * bottom of the block (single row, or a lone trailing chip), so each corner is
 * tested independently instead of by a single "is this a corner cell" branch.
 */
function chipCornerStyle(index: number, total: number) {
  const outer = Radius.xl * 1.25;
  const firstRowCount = Math.min(CHIP_COLUMNS, total);
  const lastRowStart = Math.floor((total - 1) / CHIP_COLUMNS) * CHIP_COLUMNS;
  return {
    ...(index === 0 && { borderTopLeftRadius: outer }),
    ...(index === firstRowCount - 1 && { borderTopRightRadius: outer }),
    ...(index === lastRowStart && { borderBottomLeftRadius: outer }),
    ...(index === total - 1 && { borderBottomRightRadius: outer }),
  };
}

/**
 * "Lv4 › Lv12" for the remaining-levels rows. Uses a real chevron glyph rather
 * than a hardcoded "→" character, which renders inconsistently depending on the
 * device font and misaligns against the tabular numerals.
 */
function LevelRange({ from, to, color }: { from: number; to: number | string; color: string }) {
  return (
    <View style={styles.levelRange}>
      <Text style={[styles.levelRangeText, { color }]}>Lv{from}</Text>
      <Ionicons name="chevron-forward" size={10} color={color} />
      <Text style={[styles.levelRangeText, { color }]}>Lv{to}</Text>
    </View>
  );
}

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

/**
 * Outer corners of the Home / Builder Base switch, so the two segments read as
 * one segmented control. Only the two ends are outer, matching the Buildings and
 * Time to Max tabs. Distinct from `chipCornerStyle` above, which lays out a
 * three-column grid where the middle chips have no outer corners at all.
 */
function segCornerStyle(index: number, total: number) {
  const outer = Radius.xl * 1.25;
  return {
    ...(index === 0 && {
      borderTopLeftRadius: outer,
      borderBottomLeftRadius: outer,
    }),
    ...(index === total - 1 && {
      borderTopRightRadius: outer,
      borderBottomRightRadius: outer,
    }),
  };
}

export default function PlayerProfileScreen() {
  const { player, loading, refresh } = usePlayer();
  const { siegeMachineNames, superTroopNames, petNames } = useGameData();
  // Name sets come straight from the package (see useGameData); no fallbacks.
  const siegeNames = siegeMachineNames;
  const petNameList = petNames;
  const superNameList = superTroopNames;
  const { colors } = useTheme();
  const { discounts } = useDiscounts();
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (['troops', 'spells', 'equipment', 'heroes', 'pets', 'siege'].includes(initialTab ?? '')) return initialTab as Tab;
    return 'heroes';
  });

  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    if (['troops', 'spells', 'equipment', 'heroes', 'pets', 'siege'].includes(initialTab ?? '')) {
      setActiveTab(initialTab as Tab);
    }
  }
  const [refreshing, setRefreshing] = useState(false);
  const [sheetName, setSheetName] = useState<string | null>(null);

  const [details, setDetails] = useState<Record<string, TroopDetail | null>>({});
  const [showFullLevels, setShowFullLevels] = useState<Record<string, boolean>>({});
  /**
   * Level the Remaining totals stop at, per entity. Long-pressing a row in a
   * fully expanded stats table sets it; it is cleared with the sheet so the
   * totals always come back at the max.
   */
  const [pivotLevels, setPivotLevels] = useState<Record<string, number>>({});
  const [tableViewportW, setTableViewportW] = useState(0);

  type StatPill = { icon?: keyof typeof Ionicons.glyphMap; image?: number; value: string };

  function formatStatPills(info: TroopDetail['info']): StatPill[] {
    const pills: StatPill[] = [];

    if (info.damageType) {
      const dt = info.damageType.toLowerCase();
      let label = '';

      if (dt.includes('melee')) { label = 'Melee'; }
      else if (dt.includes('ranged')) { label = 'Ranged'; }
      else if (dt.includes('splash')) {
        const r = dt.match(/[\d.]+/);
        label = r ? `Splash ${r[0]}` : 'Splash';
      }
      else if (dt.includes('single')) { label = 'Single'; }
      else { label = dt.replace(/tile radius/i, '').trim(); }

      if (info.targetType) {
        const tt = info.targetType.toLowerCase();
        if (tt.includes('ground') && tt.includes('air')) label += ' · All';
        else if (tt.includes('ground')) label += ' · Ground';
        else if (tt.includes('air')) label += ' · Air';
      }
      pills.push({ image: SPELL_STAT_ICONS.damageType, value: label });
    }

    if (info.attackSpeed) {
      const speedVal = info.attackSpeed.toLowerCase();
      const damageKeywords = /melee|ranged|splash|tile|radius|ground|air|single/i;
      if (!damageKeywords.test(speedVal)) {
        const s = speedVal.replace(/ seconds?/i, 's');
        pills.push({ image: SPELL_STAT_ICONS.duration, value: s });
      }
    }

    if (info.range) {
      const r = info.range.replace(/ tiles?/i, '').trim();
      pills.push({ image: SPELL_STAT_ICONS.damageRadius, value: r });
    }

    if (info.housingSpace > 0) {
      pills.push({ image: SPELL_STAT_ICONS.housingSpace, value: `${info.housingSpace}` });
    }

    if (info.favoriteTarget) {
      pills.push({ image: SPELL_STAT_ICONS.target, value: info.favoriteTarget });
    }

    return pills;
  }

  // Icons for the label/value pairs the package carries but that have no column in
  // the level table. Reusing the pill row keeps one visual language instead of a
  // second block of near-identical chips just below it. Stats with a real game
  // glyph use that; spell type and donation cost have no asset, so they fall back
  // to an icon.
  const FACT_ICONS: Record<string, { icon?: keyof typeof Ionicons.glyphMap; image?: number }> = {
    'Spell Type': { icon: 'sparkles-outline' },
    Radius: { image: SPELL_STAT_ICONS.damageRadius },
    'Housing Space': { image: SPELL_STAT_ICONS.housingSpace },
    Target: { image: SPELL_STAT_ICONS.target },
    'Donation Cost': { icon: 'gift-outline' },
  };

  // Labels the stat pills already cover. The pill row renders both sources, so a
  // fact repeating one of these would show the same value twice.
  const FACT_LABELS_ALREADY_PILLED = new Set(['Housing Space']);

  function formatFactPills(pairs: { label: string; value: string }[] | undefined): StatPill[] {
    return (pairs ?? [])
      .filter((f) => f.label !== 'Unlock Requirement' && !FACT_LABELS_ALREADY_PILLED.has(f.label))
      .map((f) => {
        const icon = FACT_ICONS[f.label];
        return icon
          ? { icon: icon.icon, image: icon.image, value: f.value }
          : { icon: 'information-circle-outline' as const, value: f.value };
      });
  }

  const toggleDetail = useCallback(async (name: string) => {
    // Open the bottom sheet for this item and fetch its details if needed.
    setSheetName(name);
    const isBB = activeTab === 'bhTroops' || activeTab === 'bhHeroes';
    const key = detailCacheKey(name, isBB);
    if (details[key] === undefined) {
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
        const match = allItems.find((i) => i.name === name && (isBB ? i.village === 'builderBase' : i.village !== 'builderBase'));
        if (match) {
          detail.currentLevel = match.level;
          detail.maxLevel = match.maxLevel;
        }
      } else if (player) {
        const image = getArmyItemImage(name);
        if (image) {
          const allItems = [
            ...player.heroes,
            ...player.troops,
            ...player.spells,
            ...player.heroEquipment,
            ...(player.pets ?? []),
          ];
          const match = allItems.find((i) => i.name === name && (isBB ? i.village === 'builderBase' : i.village !== 'builderBase'));
          detail = {
            name, slug: '', description: '', image,
            currentLevel: match?.level,
            maxLevel: match?.maxLevel,
            levels: match ? [{ level: match.level, dps: 0, damagePerHit: 0, hitpoints: 0, upgradeCost: '', upgradeTime: '', xp: 0, labLevel: null, thRequired: null }] : [],
            info: { range: '', housingSpace: 0, attackSpeed: '', damageType: '', targetType: '', favoriteTarget: '' },
          };
        }
      }
      setDetails((prev) => ({ ...prev, [key]: detail ?? null }));

    }
  }, [details, player, activeTab]);

  React.useEffect(() => {
    if (activeTab !== 'equipment') return;
    if (!player || player.heroEquipment.length === 0) return;
    const names = player.heroEquipment.map((e) => e.name);
    if (names.every((n) => details[n] !== undefined)) return;
    let cancelled = false;
    (async () => {
      const fetched = await Promise.all(
        names.map((name) => getArmyTroopDetail(name).catch(() => null))
      );
      if (cancelled) return;
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
      });
      if (!cancelled) setDetails((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [activeTab, player, details]);

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
        allItems.map((item) => getArmyTroopDetail(item.name, { builderBase: item.village === 'builderBase' }).catch(() => null))
      );
      const nextDetails: Record<string, TroopDetail | null> = {};
      fetched.forEach((detail, i) => {
        if (detail) {
          const item = allItems[i];
          detail.currentLevel = item.level;
          detail.maxLevel = item.maxLevel;
          nextDetails[detailCacheKey(item.name, item.village === 'builderBase')] = detail;
        }
      });
      setDetails((prev) => ({ ...prev, ...nextDetails }));
    }

    setRefreshing(false);
  }, [refresh, player]);

  const th = player?.townHallLevel ?? 0;
  const bhLevel = player?.builderHallLevel ?? 1;
  const homeHeroes = player ? player.heroes.filter((h) => h.village === 'home') : [];
  const builderHeroes = th >= 6 ? (player ? player.heroes.filter((h) => h.village === 'builderBase') : []) : [];

  const SIEGE_MACHINE_NAMES = new Set(siegeNames);
  const SUPER_TROOP_NAMES = new Set(superNameList);
  const isSiegeMachine = (name: string) => SIEGE_MACHINE_NAMES.has(name);
  const isSuperTroop = (name: string) =>
    SUPER_TROOP_NAMES.has(name) || name.startsWith('Super ') || name.startsWith('Sneaky ') || name.startsWith('Rocket ');

  const playerTroops = player?.troops ?? [];
  const homeTroops = playerTroops.filter((t) => t.village === 'home' && !isSuperTroop(t.name) && !isSiegeMachine(t.name) && !petNameList.includes(t.name));
  const builderTroops = th >= 6 ? playerTroops.filter((t) => t.village === 'builderBase') : [];
  const siegeMachines = playerTroops.filter((t) => t.village === 'home' && !isSuperTroop(t.name) && isSiegeMachine(t.name));
  const homePets = playerTroops.filter((t) => (t.village === 'home' || !t.village) && petNameList.includes(t.name));
  const homeSpells = (player?.spells ?? []).filter((s) => s.village === 'home' || !s.village);

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
  const hasHeroes = homeTroops.length >= 0 && homeHeroes.length > 0;
  const hasBhHeroes = builderHeroes.length > 0;
  const hasTroops = homeTroops.length > 0;
  const hasBhTroops = builderTroops.length > 0;
  const hasSpells = homeSpells.length > 0;
  const hasPets = homePets.length > 0;
  const hasSiege = siegeMachines.length > 0;
  const hasEquipment = (player?.heroEquipment.length ?? 0) > 0;

  // The village switch is not its own state: the two BH tabs already identify the
  // Builder Base, and `activeTab` drives data scoping, preview art and detail
  // fetches. A separate village flag could disagree with the tab it is meant to
  // describe, so the switch just moves the selection to that village's first tab.
  const village = isBBTab(activeTab) ? 'builder' : 'home';
  const showBB = th >= 6 && (hasBhTroops || hasBhHeroes);
  const thHallImage = getTownHallImageSource(th);
  const bhHallImage = getBuildingItemImage('Builder Hall', bhLevel, true);

  // Each top chip leads with a real item image instead of a glyph, using the
  // first owned unit of that kind and the same bundled asset the ItemCard uses.
  // BH chips resolve against the Builder Base sprite set.
  const tabPreviewItem: Record<Tab, string | null> = {
    heroes: homeHeroes[0]?.name ?? null,
    // Prefer a real BH hero over the Battle Machine / Battle Copter.
    bhHeroes: (builderHeroes.find((h) => !BH_HERO_MACHINES.has(h.name)) ?? builderHeroes[0])?.name ?? null,
    troops: homeTroops[0]?.name ?? null,
    bhTroops: builderTroops[0]?.name ?? null,
    spells: homeSpells[0]?.name ?? null,
    pets: homePets[0]?.name ?? null,
    siege: siegeMachines[0]?.name ?? null,
    equipment: player?.heroEquipment[0]?.name ?? null,
  };

  // Maxed-out equipment goes last in the Gear tab so upgrades are easy to spot.
  const sortedHeroEquipment = useMemo(() => {
    return [...(player?.heroEquipment ?? [])].sort((a, b) => {
      const aMaxed = a.level >= a.maxLevel;
      const bMaxed = b.level >= b.maxLevel;
      return (aMaxed ? 1 : 0) - (bMaxed ? 1 : 0);
    });
  }, [player?.heroEquipment]);

  // Chip rows are split by village: the Builder Base only has BH Heroes and
  // BH Troops, so the two villages get separate rows rather than one long wrap.
  const populatedTabs = TABS.filter((tab) => {
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
  const homeTabs = populatedTabs.filter((tab) => !isBBTab(tab.key));
  const bbTabs = populatedTabs.filter((tab) => isBBTab(tab.key));
  const visibleTabs = village === 'builder' ? bbTabs : homeTabs;

  // Chips are chunked into explicit rows rather than left to flex-wrap on a fixed
  // percentage width, so each chip can be flex: 1 and fill its row exactly. The gap
  // is the only spacing, and a partial trailing row spans it whole.
  const tabRows = useMemo(() => {
    const rows: TabDef[][] = [];
    for (let i = 0; i < visibleTabs.length; i += CHIP_COLUMNS) {
      rows.push(visibleTabs.slice(i, i + CHIP_COLUMNS));
    }
    return rows;
  }, [visibleTabs]);

  const [prevVisibleTabKeys, setPrevVisibleTabKeys] = useState('');
  const visibleTabKeys = visibleTabs.map((t) => t.key).join(',');
  if (prevVisibleTabKeys !== visibleTabKeys) {
    setPrevVisibleTabKeys(visibleTabKeys);
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }

  if (loading && !player) {
    return <ProfileScreenSkeleton />;
  }

  if (!player) return null;

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

  // Cards use the bundled package icon; level sprites are reserved for the
  // Level Appearance grid, not the cards.
  const cardIconProps = (name: string): { iconSource?: ImageSourcePropType } => {
    const local = getArmyItemImage(name, null, isBuilderBaseName());
    return { iconSource: local ?? undefined };
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

  const isBuilderBaseName = () =>
    activeTab === 'bhTroops' || activeTab === 'bhHeroes';

  // Chip subtitle: how much of each category is already maxed. This screen is an
  // upgrade tracker, so "3/10 maxed" is the signal that matters per category.
  // Reuses the same max-level rules the card grids use, so the subtitle always
  // agrees with the counts shown inside the tab.
  const maxedLine = (maxed: number, total: number) => `${maxed}/${total} maxed`;
  const tabDescription: Record<Tab, string> = {
    heroes: maxedLine(homeHeroesSplit.maxed.length, homeHeroes.length),
    bhHeroes: maxedLine(builderHeroesSplit.maxed.length, builderHeroes.length),
    troops: maxedLine(homeTroopsSplit.maxed.length, homeTroops.length),
    bhTroops: maxedLine(builderTroopsSplit.maxed.length, builderTroops.length),
    spells: maxedLine(homeSpellsSplit.maxed.length, homeSpells.length),
    pets: maxedLine(homePetsSplit.maxed.length, homePets.length),
    siege: maxedLine(
      siegeMachines.filter((t) => t.level >= (getMaxLevelAtTH(t.name, th) ?? t.maxLevel)).length,
      siegeMachines.length
    ),
    equipment: maxedLine(
      player.heroEquipment.filter((e) => e.level >= (getEquipmentMaxLevel(e.name) || e.maxLevel)).length,
      player.heroEquipment.length
    ),
  };

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
    const isHero = entityRef(detail.name)?.category === 'heroes';
    const isBB = isBuilderBaseName();
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
    const detail = details[detailCacheKey(name, isBuilderBaseName())];

    if (detail === undefined) {
      return (
        <View style={styles.panel}>
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

    const isHero = entityRef(detail.name)?.category === 'heroes';
    const isBB = isBuilderBaseName();
    const isEquip = isEquipmentName(detail.name);
    // Builder Base units are already capped by their Star Lab (getVisibleLevels);
    // never apply the Home Village Town Hall cap — getMaxLevelAtTH resolves the
    // name's home copy, so a shared name like "Baby Dragon" would apply the wrong
    // ceiling to a Builder Base troop.
    const maxReachable = isEquip ? getEquipmentMaxLevel(detail.name) || null : isBB ? null : getMaxLevelAtTH(detail.name, player.townHallLevel);
    const visibleDetailLevels = getVisibleLevels(detail);

    const currentLevel = detail.currentLevel ?? 0;
    const showFull = showFullLevels[name] || false;
    /**
     * The level Remaining stops at. The cap is null for Builder Base units and
     * equipment with no Town Hall ceiling, so the last visible level stands in.
     */
    const lastVisibleLevel = visibleDetailLevels[visibleDetailLevels.length - 1]?.level ?? currentLevel;
    const remainingMax = maxReachable != null ? maxReachable : lastVisibleLevel;
    const pivot = resolvePivotBound(pivotLevels[name], currentLevel, remainingMax);
    const isPivoted = pivot !== remainingMax;
    const pivotEnabled = canPivot(currentLevel, remainingMax);

    const setPivot = (level: number) => {
      setPivotLevels((prev) => {
        const next = { ...prev };
        // Long-pressing the pivot row again clears it, so the totals snap back to
        // the max without hunting for the ✕.
        if (next[name] === level) delete next[name];
        else next[name] = level;
        return next;
      });
    };

    const currentIdx = visibleDetailLevels.findIndex((l) => l.level === currentLevel);
    /**
     * Heroes run to ~110 levels, so at a mid-game level most of the expanded table
     * is history the player will not look at again - and a pivot target is always
     * above the current level, so those rows cannot be picked either. Fold the
     * expanded table to the current level upward.
     *
     * Troops top out around 15 and equipment around 27, where the same cut would
     * hide most of a short table for no gain, so they keep the full range. This is
     * a size judgement, not a category rule - heroes are simply where it applies.
     *
     * Purely presentational: Remaining reads from visibleDetailLevels, and the
     * Level Appearance grid already excludes heroes.
     */
    const trimHeroHistory = isHero && showFull;
    // Rows below the current level that the expanded table hides. Zero when the
    // table is condensed, the entity is not a hero, or the level is not in the
    // table at all.
    const hiddenLevelCount = trimHeroHistory && currentIdx > 0 ? currentIdx : 0;
    /** The rows an expanded hero table shows. Also drives the toggle's count. */
    const expandedLevels = (): TroopDetail['levels'] => {
      if (currentIdx < 0) {
        // Level not in the table (unowned or off the TH cap): nothing to trim
        // against, so show the start rather than hiding rows on a guess.
        return visibleDetailLevels;
      }
      if (currentIdx >= visibleDetailLevels.length - 1) {
        // Maxed, or one level from it. Trimming upward would leave nothing, so
        // keep the last few levels instead of an empty table.
        return visibleDetailLevels.slice(Math.max(0, currentIdx - 2));
      }
      // Keep the current level as the anchor - it is the row the range band and
      // the pivot hint both read against.
      return visibleDetailLevels.slice(currentIdx);
    };

    let displayLevels: TroopDetail['levels'];
    if (trimHeroHistory) {
      displayLevels = expandedLevels();
    } else if (showFull || visibleDetailLevels.length <= 3) {
      displayLevels = visibleDetailLevels;
    } else if (currentIdx < 0) {
      displayLevels = visibleDetailLevels.slice(0, 2);
    } else {
      const start = Math.max(0, currentIdx - 1);
      const end = Math.min(visibleDetailLevels.length, currentIdx + 2);
      displayLevels = visibleDetailLevels.slice(start, end);
    }

    const pills = formatStatPills(detail.info);
    // Stat pills first, then the facts that have no stat of their own. The unlock
    // requirement is excluded inside formatFactPills because it has its own block.
    const pillsAll = [...pills, ...formatFactPills(detail.infoPairs)];
    const unlockReq = detail.infoPairs?.find((i) => i.label === 'Unlock Requirement');
    const unlockReqItems = unlockReq ? parseUnlockRequirements(unlockReq.value) : [];
    const unlockHasCost = unlockReqItems.some((r) => r.cost);

    const isTroopLike = (detail.levels[0]?.dps ?? 0) > 0 || (detail.levels[0]?.hitpoints ?? 0) > 0;
    const extraLabels = detail.levels[0]?.extra?.map((e) => e.label) ?? [];
    const showDiscounted = discounts.army.costPercent > 0 || discounts.army.timePercent > 0;
    // Builder Base hero level caps come from the Builder Hall, not the Hero Hall,
    // so a "lab level required" column would be wrong there. Home heroes and
    // everything else are still gated by the Hero Hall / Laboratory.
    const showLabColumn = activeTab !== 'bhHeroes';
    const LAB_COL_W = showLabColumn ? 72 : 0;
    const contentMinW = 28 + 56 + 48 + LAB_COL_W + (isTroopLike ? 36 + 36 : extraLabels.length * 54);

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
      <View style={styles.panel}>
        {detail.description ? (
          <View style={styles.panelHeader}>
            <Text style={[styles.panelDesc, { color: colors.textTertiary }]}>{detail.description}</Text>
          </View>
        ) : null}

        {pillsAll.length > 0 && (
          <View style={styles.panelPillsRow}>
            {pillsAll.map((pill, i) => (
              <View key={`${pill.icon ?? pill.image}-${pill.value}-${i}`} style={[styles.panelPill, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                {pill.image != null ? (
                  <Image source={pill.image} style={styles.panelPillIcon} resizeMode="contain" />
                ) : (
                  <Ionicons name={pill.icon} size={11} color={colors.textSecondary} />
                )}
                <Text style={[styles.panelPillText, { color: colors.textPrimary }]}>{pill.value}</Text>
              </View>
            ))}
          </View>
        )}

        {!isEquip && unlockReqItems.length > 0 ? (
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
              <View key={i} style={[styles.panelTableRow, { backgroundColor: colors.bgSubtle, borderBottomColor: colors.border }]}>
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

          // The pivot replaces the cap on every remaining total below.
          const remainingLevels = visibleDetailLevels.filter((l) => l.level > currentLevel && l.level <= pivot);
          const resourceSums = sumLevelCostsByResource(visibleDetailLevels, currentLevel, pivot);
          const totalCost = resourceSums.reduce((s, r) => s + r.amount, 0);
          let totalTime = 0;
          for (const lvl of remainingLevels) {
            if (lvl.upgradeTime) totalTime += parseTime(lvl.upgradeTime);
          }
          const hasRemaining = remainingLevels.length > 0 && totalCost > 0;
          // Units with per-level cosmetic sprites show their visual progression
          // (current + upcoming levels) until they're maxed — including Builder
          // Base troops, which use their own village sprites.
          const showAppearance =
            !isHero && !isEquip && isTroopLike &&
            entityRef(detail.name)?.levelSuffix === true &&
            remainingLevels.length > 0;
          const appearanceLevels = showAppearance ? displayLevels.map((l) => l.level) : [];
          return (
            <>
              {showAppearance && (
                <>
                  <Text style={[styles.panelSectionTitle, { color: colors.textPrimary }]}>Level Appearance</Text>
                  <View style={[styles.troopLevelGridBorder, { borderColor: colors.border }]}>
                    <View style={styles.troopLevelGrid}>
                      {appearanceLevels.map((lvl) => {
                        const isCurrent = lvl === currentLevel;
                        const localImg = getArmyItemImage(detail.name, lvl, isBB);
                        return (
                          <View key={lvl} style={[styles.troopLevelCell, { borderColor: colors.border }, isCurrent && styles.troopLevelCellCurrent]}>
                            <View style={styles.troopLevelImgWrap}>
                              {localImg ? (
                                <Image source={localImg} style={styles.troopLevelImg} resizeMode="contain" />
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
                    <View style={[styles.panelTableCell, styles.remainingHeaderCell, { backgroundColor: colors.bgCard }]}>
                      <Text numberOfLines={1} style={[styles.remainingHeaderText, { color: isPivoted ? colors.warning : colors.textMuted }]}>
                        Remaining · {pivotSpanCount(currentLevel, pivot)}
                      </Text>
                      {isPivoted && (
                        <PressableRipple
                          onPress={() => setPivot(pivot)}
                          hitSlop={8}
                          style={styles.pivotClear}
                          accessibilityLabel="Clear pivot"
                          accessibilityRole="button"
                        >
                          <Ionicons name="close" size={11} color={colors.warning} />
                        </PressableRipple>
                      )}
                    </View>
                    <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>Cost</Text>
                    <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>Time</Text>
                  </View>
                  {resourceSums.length > 0 ? (
                    resourceSums.map((s, ri) => {
                      const icon = PACKAGE_RESOURCE_IMAGES[s.resource as string];
                      return (
                        <View key={s.resource} style={[styles.panelTableRow, { backgroundColor: colors.bgSubtle }]}>
                          <View style={[styles.panelTableCell, { flex: 1, paddingLeft: Spacing.base }]}>
                            {ri === 0 && (
                              <LevelRange
                                from={currentLevel}
to={pivot}
                                color={colors.textSecondary}
                              />
                            )}
                          </View>
                          <View style={[styles.panelTableCell, { alignItems: 'center', justifyContent: 'center' }]}>
                            <View style={styles.resourceSumRow}>
                              {icon ? (
                                <Image source={icon} style={styles.resourceSumIcon} resizeMode="contain" />
                              ) : (
                                <View style={[styles.resourceSumDot, { backgroundColor: RESOURCE_META[s.resource].color }]} />
                              )}
                              <Text
                                style={{
                                  color: showDiscounted ? colors.warning : RESOURCE_META[s.resource].color,
                                  fontWeight: '600',
                                  fontSize: 10,
                                  fontFamily: clashFontFamily(600, 10),
                                }}
                              >
                                {showDiscounted ? applyCostDiscount(fmtCost(s.amount), discounts.army) : fmtCost(s.amount)}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.panelTableCell, { color: showDiscounted ? colors.warning : colors.textPrimary, fontWeight: '600' }]}>
                            {ri === 0
                              ? (showDiscounted ? applyTimeDiscount(fmtTime(totalTime), discounts.army) : fmtTime(totalTime))
                              : ''}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <View style={[styles.panelTableRow, { backgroundColor: colors.bgSubtle }]}>
                      <View style={[styles.panelTableCell, { flex: 1, paddingLeft: Spacing.base }]}>
                        <LevelRange
                          from={currentLevel}
                          to={maxReachable != null ? maxReachable : visibleDetailLevels[visibleDetailLevels.length - 1]?.level ?? '?'}
                          color={colors.textSecondary}
                        />
                      </View>
                      <Text style={[styles.panelTableCell, { color: colors.textSecondary, fontWeight: '600', fontFamily: clashFontFamily(600) }]}>—</Text>
                      <Text style={[styles.panelTableCell, { color: showDiscounted ? colors.warning : colors.textPrimary, fontWeight: '600' }]}>
                        {showDiscounted ? applyTimeDiscount(fmtTime(totalTime), discounts.army) : fmtTime(totalTime)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <Text style={[styles.panelSectionTitle, { color: colors.textPrimary }]}>Level Stats</Text>
              {hiddenLevelCount > 0 && (
                <Text style={[styles.foldedLevelsNote, { color: colors.textTertiary }]}>
                  {hiddenLevelCount} earlier {hiddenLevelCount === 1 ? 'level' : 'levels'} hidden
                </Text>
              )}
              {legendEntries.length > 0 && (
                <View style={{ marginBottom: Spacing.sm }}>
                  {legendEntries.map((e, li) => (
                    <Text key={`${e.acronym}-${li}`} style={[styles.panelLegend, { color: colors.textTertiary }]}>
                      <Text style={{ fontWeight: '700', fontFamily: clashFontFamily(700) }}>{e.acronym}</Text> = {e.full}
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
                    ) : headerLabels.map((lbl, i) => (
                      <Text key={i} style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 54 }]}>{lbl}</Text>
                    ))}
                    <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 56 }]}>Cost</Text>
                    <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 48 }]}>Time</Text>
                    {showLabColumn && (
                      <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted, minWidth: 72 }]}>
                        {getLabBuilding(detail.name, activeTab)}
                      </Text>
                    )}
                  </View>
                  {displayLevels.map((l) => {
                    const isCurrentRow = l.level === currentLevel;
                    const isPivotRow = pivotLevels[name] === l.level;
                    // The levels the pivot covers, so the gold pivot row reads as the end of a
                    // range rather than an unrelated highlight. Gated on isPivoted:
                    // with no pivot the bound is the max, which would match every
                    // remaining row and tint the whole table.
                    const inPivotRange = isPivoted && l.level > currentLevel && l.level < pivot;
                    // Only a fully expanded table offers pivots: the condensed view
                    // already elides rows behind an ellipsis, and the table scrolls
                    // horizontally, so a long-press there would be easy to miss.
                    const canPivotRow = isPivotable(l.level, currentLevel, remainingMax, showFull);
                    return (
                      <PressableRipple
                        key={l.level}
                        onLongPress={canPivotRow ? () => setPivot(l.level) : undefined}
                        style={[
                          styles.panelTableRow,
                          { borderBottomColor: colors.border },
                          isCurrentRow ? { backgroundColor: colors.accentGhost } : isPivotRow && styles.pivotRow, inPivotRange && styles.pivotRangeRow,
                        ]}
                      >
                        <Text style={[styles.panelTableCell, { minWidth: 28 }, isPivotRow ? styles.pivotLvl : { color: colors.textSecondary }]}>{l.level}</Text>
                        {isTroopLike ? (
                          <>
                            <Text style={[styles.panelTableCell, { color: colors.textSecondary, minWidth: 36 }]}>{l.dps}</Text>
                            <Text style={[styles.panelTableCell, { color: colors.textSecondary, minWidth: 36 }]}>{l.hitpoints}</Text>
                          </>
                        ) : extraLabels.map((lbl, i) => (
                            <Text key={i} style={[styles.panelTableCell, { color: colors.textSecondary, minWidth: 54 }]}>
                              {l.extra?.find((e) => e.label === lbl)?.value ?? '—'}
                            </Text>
                          ))}
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
                        {showLabColumn && (
                          <Text style={[styles.panelTableCell, { color: colors.textSecondary, minWidth: 72 }]}>{l.labLevel ?? '—'}</Text>
                        )}
                      </PressableRipple>
                    );
                  })}
                  {pivotEnabled && showFull && (
                    <Text style={[styles.pivotHint, { color: colors.textTertiary }]}>
                      {isPivoted ? 'Long-press Lv' + pivot + ' again, or tap ✕, to return to the max.' : 'Long-press a level to cap the Remaining totals there.'}
                    </Text>
                  )}
                </View>
              </ScrollView>
              {visibleDetailLevels.length > 3 && (
                <PressableRipple
                  style={styles.expandTableBtn}
                  onPress={() => setShowFullLevels((prev) => ({ ...prev, [name]: !showFull }))}
                >
                  <Ionicons name={showFull ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textSecondary} />
                  <Text style={styles.expandTableText}>
                    {showFull ? 'Show fewer' : `Show all ${isHero ? expandedLevels().length : visibleDetailLevels.length} levels`}
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
          );
        })()}
      </View>
    );
  };

  const renderSheetHeader = (name: string) => {
    const allItems = player
      ? [
        ...player.heroes,
        ...player.troops,
        ...player.spells,
        ...player.heroEquipment,
        ...(player.pets ?? []),
      ]
      : [];
    const item = allItems.find((i) => i.name === name);
    const isLocked = item === undefined;
    const level = item?.level ?? 0;
    const maxLevel = item?.maxLevel ?? level;
    const progress = maxLevel > 0 ? level / maxLevel : 0;
    const isMaxed = maxLevel > 0 && level >= maxLevel;
    const iconSource = cardIconProps(name).iconSource;
    const lockedDesc = details[detailCacheKey(name, isBuilderBaseName())]?.description;
    return (
      <View style={styles.sheetHeaderRow}>
        <View style={styles.sheetHeaderIcon}>
          {iconSource ? (
            <Image source={iconSource} style={styles.sheetHeaderIconImg} resizeMode="contain" />
          ) : (
            <Text style={styles.sheetHeaderIconText}>
              {name.split(/[\s.]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.sheetHeaderText}>
          <Text style={styles.sheetHeaderTitle} numberOfLines={1}>{name}</Text>
          {isLocked ? (
            <Text style={styles.sheetHeaderLockedDesc} numberOfLines={1}>
              {lockedDesc || 'Not yet unlocked'}
            </Text>
          ) : (
            <View style={styles.sheetHeaderBar}>
              <View
                style={[
                  styles.sheetHeaderFill,
                  {
                    width: `${Math.min(progress, 1) * 100}%`,
                    backgroundColor: isMaxed ? Colors.warning : Colors.textPrimary,
                  },
                ]}
              />
            </View>
          )}
        </View>
        <View style={styles.sheetHeaderBadges}>
          {isLocked ? (
            <View style={styles.buildingSectionBadge}>
              <Image source={lockedImage} style={styles.sheetHeaderLockedImg} resizeMode="contain" />
            </View>
          ) : (
            <View style={[styles.buildingSectionBadge, isMaxed && styles.buildingSectionBadgeMaxed]}>
              <Text style={[styles.buildingSectionBadgeText, isMaxed && styles.buildingSectionBadgeTextMaxed]}>{level}</Text>
              <Text style={[styles.buildingSectionBadgeLabel, isMaxed && styles.buildingSectionBadgeTextMaxed]}>/ {maxLevel}</Text>
            </View>
          )}
          <PressableRipple onPress={() => setSheetName(null)} hitSlop={8} style={styles.sheetHeaderClose} accessibilityLabel="Close" accessibilityRole="button">
            <Ionicons name="close" size={18} color={Colors.textPrimary} />
          </PressableRipple>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} >
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

        {showBB && (
          <View style={styles.villageToggleWrap}>
            <View style={styles.villageToggle}>
              <PressableRipple
                style={[
                  styles.villageToggleItem,
                  segCornerStyle(0, 2),
                  village === 'home' && styles.villageToggleActive,
                ]}
                onPress={() => setActiveTab(homeTabs[0]?.key ?? 'troops')}
              >
                {thHallImage ? (
                  <Image source={thHallImage} style={styles.villageToggleImg} resizeMode="contain" />
                ) : (
                  <Ionicons
                    name="home-outline"
                    size={13}
                    color={village === 'home' ? Colors.bg : Colors.textSecondary}
                  />
                )}
                <Text style={[styles.villageToggleText, village === 'home' && styles.villageToggleTextActive]}>
                  {`TH${th}`}
                </Text>
              </PressableRipple>
              <PressableRipple
                style={[
                  styles.villageToggleItem,
                  segCornerStyle(1, 2),
                  village === 'builder' && styles.villageToggleActive,
                ]}
                onPress={() => setActiveTab(bbTabs[0]?.key ?? 'bhTroops')}
              >
                {bhHallImage ? (
                  <Image source={bhHallImage} style={styles.villageToggleImg} resizeMode="contain" />
                ) : (
                  <Ionicons
                    name="hammer-outline"
                    size={13}
                    color={village === 'builder' ? Colors.bg : Colors.textSecondary}
                  />
                )}
                <Text style={[styles.villageToggleText, village === 'builder' && styles.villageToggleTextActive]}>
                  {`BH${bhLevel}`}
                </Text>
              </PressableRipple>
            </View>
          </View>
        )}

        <View style={styles.tabsContainer}>
          {tabRows.map((row) => (
            <View key={row[0].key} style={styles.tabLine}>
              {row.map((tab) => {
                const isActive = activeTab === tab.key;
                const iconDef = TAB_ICONS[tab.key];
                const iconColor = isActive ? Colors.bg : Colors.textSecondary;
                const previewName = tabPreviewItem[tab.key];
                const previewSrc = previewName
                  ? getArmyItemImage(previewName, null, tab.key === 'bhTroops' || tab.key === 'bhHeroes')
                  : null;
                return (
                  <PressableRipple
                    key={tab.key}
                    onPress={() => setActiveTab(tab.key)}
                    style={[
                      styles.tab,
                      chipCornerStyle(visibleTabs.indexOf(tab), visibleTabs.length),
                      isActive && styles.tabActive,
                    ]}
                  >
                    {previewSrc != null ? (
                      <Image source={previewSrc} style={styles.tabIcon} resizeMode="contain" />
                    ) : iconDef.set === 'mc' ? (
                      <MaterialCommunityIcons name={iconDef.name as any} size={14} color={iconColor} />
                    ) : (
                      <Ionicons name={iconDef.name as any} size={14} color={iconColor} />
                    )}
                    <View style={styles.tabTextCol}>
                      <Text
                        style={[styles.tabText, isActive && styles.tabTextActive]}
                        numberOfLines={1}
                      >
                        {tab.label}
                      </Text>
                      <Text
                        style={[styles.tabSubText, isActive && styles.tabSubTextActive]}
                        numberOfLines={1}
                      >
                        {tabDescription[tab.key]}
                      </Text>
                    </View>
                  </PressableRipple>
                );
              })}
            </View>
          ))}
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
                        isFirst={i === 0}
                        isLast={i === homeHeroesSplit?.leveling?.length - 1}
                      />
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
                      onPress={() => toggleDetail(h.name)}
                      isFirst={i === 0}
                      isLast={i === lockedHeroes?.length - 1}
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
                        isFirst={i === 0}
                        isLast={i === homeHeroesSplit?.maxed?.length - 1}
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
              {homeHeroes.length === 0 && lockedHeroes.length === 0 && (
                <EmptyState
                  icon="ðŸ‘‘"
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
                  icon="ðŸ›¡ï¸"
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
                            isFirst={i === 0}
                            isLast={i === builderHeroesSplit?.leveling?.length - 1}
                          />
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
                            isFirst={i === 0}
                            isLast={i === builderHeroesSplit?.maxed?.length - 1}
                          />
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
                        {...cardIconProps(t.name)}
                        onPress={() => toggleDetail(t.name)}
                        isFirst={i === 0}
                        isLast={i === homeTroopsSplit?.leveling?.length - 1}
                      />
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
                      {...cardIconProps(t.name)}
                      locked
                      onPress={() => toggleDetail(t.name)}
                      isFirst={i === 0}
                      isLast={i === lockedTroops.length - 1}
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
                        {...cardIconProps(t.name)}
                        onPress={() => toggleDetail(t.name)}
                        isFirst={i === 0}
                        isLast={i === homeTroopsSplit?.maxed?.length - 1}
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
              {homeTroops.length === 0 && lockedTroops.length === 0 && (
                <EmptyState
                  icon="âš”ï¸"
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
                  icon="ðŸ”¨"
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
                            {...cardIconProps(t.name)}
                            onPress={() => toggleDetail(t.name)}
                            isFirst={i === 0}
                            isLast={i === builderTroopsSplit?.leveling?.length - 1}
                          />
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
                            {...cardIconProps(t.name)}
                            onPress={() => toggleDetail(t.name)}
                            isFirst={i === 0}
                            isLast={i === builderTroopsSplit?.maxed?.length - 1}
                          />
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
                  icon="ðŸš€"
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
                        {...cardIconProps(s.name)}
                        onPress={() => toggleDetail(s.name)}
                        isFirst={i === 0}
                        isLast={i === siegeMachines.length - 1}
                      />
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
                        isFirst={i === 0}
                        isLast={i === homeSpellsSplit?.leveling?.length - 1}
                      />
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
                      onPress={() => toggleDetail(s.name)}
                      isFirst={i === 0}
                      isLast={i === lockedSpells.length - 1}
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
                        isFirst={i === 0}
                        isLast={i === homeSpellsSplit?.maxed?.length - 1}
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
              {homeSpells.length === 0 && lockedSpells.length === 0 && (
                <EmptyState
                  icon="âœ¨"
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
                  icon="ðŸ¾"
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
                            isFirst={i === 0}
                            isLast={i === homePetsSplit?.leveling?.length - 1}
                          />
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
                            isFirst={i === 0}
                            isLast={i === homePetsSplit?.maxed?.length - 1}
                          />
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
                  icon="ðŸ›¡ï¸"
                  title="No equipment yet"
                  description="Hero equipment unlocks at TH8 with the Blacksmith. Equip your heroes with special abilities."
                />
              ) : (
                <>
                  <View style={{ paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm }}>
                    <Text style={{ fontSize: 12, color: Colors.textTertiary, fontStyle: 'italic', fontFamily: clashFontFamily(400, 12) }}>
                      Levels shown reflect your Blacksmith (Lv {blacksmithLevel}).
                    </Text>
                  </View>
                  {sortedHeroEquipment.map((e, i) => (
                    <React.Fragment key={e.name}>
                      <ItemCard
                        name={e.name}
                        level={e.level}
                        maxLevel={e.maxLevel}
                        thMaxLevel={getEquipmentMaxLevel(e.name) || undefined}
                        {...cardIconProps(e.name)}
                        onPress={() => toggleDetail(e.name)}
                        isFirst={i === 0}
                        isLast={i === sortedHeroEquipment.length - 1}
                      />
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomSheet
        visible={sheetName !== null}
        onClose={() => {
          setSheetName(null);
          if (sheetName) {
            setShowFullLevels((prev) => {
              const next = { ...prev };
              delete next[sheetName];
              return next;
            });
            // A pivot is a reading of this visit, not a saved setting: it goes when
            // the sheet does, so the totals always reopen at the max.
            setPivotLevels((prev) => {
              const next = { ...prev };
              delete next[sheetName];
              return next;
            });
          }
        }}
        header={sheetName ? renderSheetHeader(sheetName) : undefined}
      >
        {sheetName ? renderDetailPanel(sheetName) : null}
      </BottomSheet>
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
  villageToggleWrap: {
    alignSelf: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  villageToggle: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: Radius.xl * 1.25,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  villageToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  villageToggleImg: {
    width: 16,
    height: 16,
  },
  villageToggleActive: {
    backgroundColor: Colors.textPrimary,
  },
  villageToggleText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  villageToggleTextActive: {
    color: Colors.bg,
  },
  tabsContainer: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  tabLine: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  tab: {
    // flex: 1 rather than a hardcoded percentage width, so a pair of chips shares
    // the row exactly (gap-only spacing) and a lone trailing chip fills the row.
    flex: 1,
    minWidth: 0,
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
  tabActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  tabIcon: {
    width: 16,
    height: 16,
  },
  tabTextCol: {
    flex: 1,
    minWidth: 0,
  },
  tabText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.bg,
  },
  tabSubText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  tabSubTextActive: {
    color: Colors.bg,
    opacity: 0.7,
  },
  tabContent: {
    paddingHorizontal: Spacing.base,
  },

  // â”€â”€ Inline detail panel (expands below a tapped card) â”€â”€
  panel: {
    marginTop: 2,
    marginBottom: Spacing.sm,
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
  // â”€â”€ Stat pills (icon + concise tag) â”€â”€
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
  panelPillIcon: {
    width: 12,
    height: 12,
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
  pivotHint: {
    ...Typography.caption,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  /**
   * Sits under the Level Stats heading. A hero can hide dozens of rows, and
   * without this the trimmed table reads as missing data rather than a fold.
   */
  foldedLevelsNote: {
    ...Typography.caption,
    marginTop: 2,
  },
  pivotClear: {
    marginLeft: Spacing.xs,
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
  resourceSumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 1,
  },
  resourceSumIcon: {
    width: 14,
    height: 14,
  },
  resourceSumDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  panelTableCell: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textSecondary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    textAlign: 'center',
  },
  levelRange: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  levelRangeText: {
    ...Typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  panelTableHeader: {
    color: Colors.textMuted,
    fontWeight: '600',
    backgroundColor: Colors.bgSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  /**
   * The Remaining header carries a ✕ once a pivot is set, so it is a row rather
   * than a cell. Layout lives on the View and the header typography on the Text -
   * React Native does not inherit font or textTransform from a View to a Text.
   */
  remainingHeaderCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  remainingHeaderText: {
    ...Typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  /**
   * The pivot row sits next to the current-level row, so it gets its own tint and
   * a bolder level number rather than borrowing the current-row accent.
   */
  pivotRow: {
    backgroundColor: Colors.warningGhost,
  },
  /** Levels between the current one and the pivot - the ones it now totals.
   * Monochrome and lighter than the current-level row, so that row stays the most
   * prominent thing in the table. */
  pivotRangeRow: {
    backgroundColor: Colors.accentFaint,
  },
  pivotLvl: {
    color: Colors.warning,
    fontWeight: '700',
  },
  sheetHeaderRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
  },
  sheetHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sheetHeaderIconImg: {
    width: 40,
    height: 40,
  },
  sheetHeaderIconText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  sheetHeaderText: {
    flex: 1,
    justifyContent: 'space-between',
  },
  sheetHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sheetHeaderBar: {
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 3,
  },
  sheetHeaderFill: {
    height: '100%',
    borderRadius: 2,
  },
  sheetHeaderBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sheetHeaderClose: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderLockedImg: {
    width: 20,
    height: 20,
  },
  sheetHeaderLockedDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 11,
    lineHeight: 13,
  },
  buildingSectionBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  buildingSectionBadgeMaxed: {
    backgroundColor: Colors.warning,
  },
  buildingSectionBadgeText: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  buildingSectionBadgeTextMaxed: {
    color: Colors.bg,
  },
  buildingSectionBadgeLabel: {
    fontSize: 8,
    lineHeight: 9,
    color: Colors.textPrimary,
    opacity: 0.7,
    fontVariant: ['tabular-nums'],
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