import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SettingRow } from '../../src/components/SettingRow';
import { ItemCard } from '../../src/components/ItemCard';
import PressableRipple from '../../src/components/PressableRipple';
import { MaxTimeScreenSkeleton } from '../../src/components/SkeletonScreens';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { useBuilderCount } from '../../src/hooks/useBuilderCount';
import { useBuilderBaseCount } from '../../src/hooks/useBuilderBaseCount';
import { useBuildingExclusions } from '../../src/hooks/useBuildingExclusions';
import { useDiscounts, type ScopeDiscount, type Discounts } from '../../src/hooks/useDiscounts';
import { getArmyTroopDetail, getArmyItemImage, getAllItemsAtTH, getAllBuilderItemsAtBH, getMaxLevelAtTH, getArmyItem, RESOURCE_META, type CostResource } from '../../src/utils/armyData';
import { getBuildingItemImage, getBuildingMaxLevelAtTH, getBuildingMaxLevelAtBH, getMaxTownHall, getTownHallUpgrade, BUILDING_RESOURCE_META, type BuildingCostResource } from '../../src/utils/buildingData';
import { getTownHallImageSource } from '../../src/utils/buildingImages';
import { PACKAGE_RESOURCE_IMAGES } from '../../src/data/packageImages';
import { computeMaxTime, computeBuilderBaseMaxTime, type PipelineResult, type PipelineItemRow, type PipelineKey } from '../../src/utils/maxTime';
import { armyKey, PIPELINE_GATES, type ArmyPipeline } from '../../src/utils/exclusions';
import { computeThReadiness } from '../../src/utils/thReadiness';
import SharePreviewModal, { useShareCardWidth } from '../../src/components/share/SharePreviewModal';
import MaxtimeShareCard, { type MaxtimeShareData, type MaxtimePipeline } from '../../src/components/MaxtimeShareCard';
import { formatCost, formatTime, formatTimeShort, formatCostBreakdown } from '../../src/utils/upgradeCosts';
import type { TroopDetail } from '../../src/api/troopDetail';

const PIPELINE_META: Record<PipelineKey, { title: string; icon: keyof typeof Ionicons.glyphMap; desc: string }> = {
  lab: { title: 'Laboratory', icon: 'flask-outline', desc: 'Troops, spells & sieges — one research at a time' },
  builders: { title: 'Builders', icon: 'hammer-outline', desc: 'Buildings & heroes — scheduled across your builders' },
  pets: { title: 'Pet House', icon: 'paw-outline', desc: 'Pets — one upgrade at a time' },
  equipment: { title: 'Equipment', icon: 'diamond-outline', desc: 'Blacksmith — instant, ores only' },
  'bb-builders': { title: 'BB Builders', icon: 'hammer-outline', desc: 'BB buildings & heroes — scheduled across BB builders' },
  'bb-lab': { title: 'Star Laboratory', icon: 'flask-outline', desc: 'BB troops — one research at a time' },
};

/** Pipelines that vanish entirely when their gating building is excluded. */
const PIPELINE_GATE: Partial<Record<PipelineKey, string>> = {
  lab: PIPELINE_GATES.lab,
  pets: PIPELINE_GATES.pets,
  equipment: PIPELINE_GATES.equipment,
  'bb-lab': PIPELINE_GATES['bb-lab'],
};

/** Stand-in exclusion set: the full, un-skipped pipelines that skipped rows are listed from. */
const NO_EXCLUSIONS = new Set<string>();

const READINESS_PIPELINE_DESC: Record<string, string> = {
  lab: 'troops · spells · sieges',
  builders: 'buildings · heroes · walls',
  pets: 'pets',
};

const RESOURCE_ORDER: (CostResource | BuildingCostResource)[] = [
  'Gold',
  'Elixir',
  'Dark Elixir',
  'Builder Gold',
  'Builder Elixir',
  'Gold or Elixir',
  'Builder Gold or Builder Elixir',
  'Shiny Ore',
  'Glowing Ore',
  'Starry Ore',
];

/** Resource costs in the app's canonical order, dropping zero and unknown entries. */
function resourceEntries(byResource: Record<string, number>): [string, number][] {
  return (Object.entries(byResource).filter(([, v]) => v > 0) as [string, number][])
    .filter(([r]) => r !== 'Unknown')
    .sort((a, b) => {
      const ia = RESOURCE_ORDER.indexOf(a[0] as (CostResource | BuildingCostResource));
      const ib = RESOURCE_ORDER.indexOf(b[0] as (CostResource | BuildingCostResource));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

/** The subset a resource block can actually draw: known order, and real package art. */
function resourceRows(byResource: Record<string, number>): [string, number][] {
  return resourceEntries(byResource).filter(([r]) => PACKAGE_RESOURCE_IMAGES[r]);
}

/** Tint per resource, so gold, elixir and the ores read apart without a label. */
function resourceColor(resource: string): string {
  return RESOURCE_META[resource as CostResource]?.color
    ?? BUILDING_RESOURCE_META[resource as BuildingCostResource]?.color
    ?? '#94A3B8';
}

function resourceLabel(resource: string): string {
  return RESOURCE_META[resource as CostResource]?.label
    ?? BUILDING_RESOURCE_META[resource as BuildingCostResource]?.label
    ?? resource;
}

/**
 * Outer corners of the Home / Builder Base switch, so the two segments read as
 * one segmented control. Only the two ends are outer, matching the Buildings tab.
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

/** Levels still to buy across rows, so exclusions are counted in levels rather than items. */
function remainingLevels(items: PipelineItemRow[]): number {
  return items.reduce((n, r) => n + Math.max(0, r.maxLevel - r.currentLevel), 0);
}

function levelsLabel(n: number): string {
  return `${n} upgrade${n === 1 ? '' : 's'} excluded`;
}

function applyScope(timeSec: number, cost: number, byResource: Record<string, number>, scope: ScopeDiscount) {
  const t = Math.max(0, Math.round(timeSec * (1 - scope.timePercent / 100)));
  const c = Math.max(0, Math.round(cost * (1 - scope.costPercent / 100)));
  const res: Record<string, number> = {};
  for (const [r, v] of Object.entries(byResource)) res[r] = Math.max(0, Math.round(v * (1 - scope.costPercent / 100)));
  return { timeSec: t, cost: c, byResource: res };
}

function rowScope(row: PipelineItemRow, heroNames: Set<string>, discounts: Discounts): ScopeDiscount {
  return heroNames.has(row.name) ? discounts.army : discounts.buildings;
}

function orderShareResources(byResource: Record<string, number>) {
  return (Object.entries(byResource).filter(([r, v]) => v > 0 && r !== 'Unknown') as [string, number][])
    .sort((a, b) => {
      const ia = RESOURCE_ORDER.indexOf(a[0] as (CostResource | BuildingCostResource));
      const ib = RESOURCE_ORDER.indexOf(b[0] as (CostResource | BuildingCostResource));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map(([key, amount]) => ({ key, amount }));
}

export default function MaxTimeScreen() {
  const { player, loading, lastSync } = usePlayer();
  const { colors } = useTheme();
  const { count: builderCount, setBuilderCount, loaded: builderLoaded, canDecrease: canDecreaseBuilders, canIncrease: canIncreaseBuilders } = useBuilderCount();
  const { excluded, toggleExcluded, setExcludedMany, loaded: exclusionsLoaded } = useBuildingExclusions();
  const { discounts } = useDiscounts();
  const [details, setDetails] = useState<Record<string, TroopDetail | null> | null>(null);
  const [bbDetails, setBbDetails] = useState<Record<string, TroopDetail | null> | null>(null);
  const [expanded, setExpanded] = useState<Record<PipelineKey, boolean>>({ lab: false, builders: false, pets: false, equipment: false, 'bb-builders': false, 'bb-lab': false });
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [buildersExpanded, setBuildersExpanded] = useState(false);
  const [labExpanded, setLabExpanded] = useState(false);
  const [rushExpanded, setRushExpanded] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareVillage, setShareVillage] = useState<'home' | 'builder'>('home');
  const [village, setVillage] = useState<'home' | 'builder'>('home');
  // Row exclusion badges only show while editing; skipped rows stay marked either way.
  const [editExclusions, setEditExclusions] = useState(false);

  const th = player?.townHallLevel ?? 1;
  const bh = player?.builderHallLevel ?? 1;
  const maxTh = getMaxTownHall();
  const isMaxTh = th >= maxTh;
  const hasPets = (player?.pets?.length ?? 0) > 0;
  // The Builder Base unlocks alongside the sixth Town Hall, same gate the
  // Buildings tab uses for its own village switch.
  const showBB = th >= 6;
  const isBB = village === 'builder' && showBB;
  const thHallImage = getTownHallImageSource(th);
  const bhHallImage = getBuildingItemImage('Builder Hall', bh, true);
  const { count: bbBuilderCount, setBuilderBaseCount, loaded: bbBuilderLoaded } = useBuilderBaseCount(bh);

  const armyNames = useMemo(() => {
    if (!player) return [] as string[];
    const names = new Set<string>();
    [...(player.troops ?? []), ...(player.spells ?? []), ...(player.heroes ?? []), ...(player.pets ?? [])]
      .filter((i) => i.village !== 'builderBase')
      .forEach((i) => names.add(i.name));
    // Include not-yet-unlocked items so their details are available too.
    for (const item of getAllItemsAtTH(th + 1)) names.add(item.name);
    return [...names];
  }, [player, th]);

  const heroNames = useMemo(() => new Set((player?.heroes ?? []).map((h) => h.name)), [player]);

  const bbArmyNames = useMemo(() => {
    if (!player) return [] as string[];
    const names = new Set<string>();
    for (const item of getAllBuilderItemsAtBH(bh)) names.add(item.name);
    return [...names];
  }, [player, bh]);

  useEffect(() => {
    let active = true;
    (async () => {
      // Reset, then re-fetch — cleared in the async continuation so we never
      // set state synchronously within the effect (react-hooks/set-state-in-effect).
      await Promise.resolve();
      if (!active) return;
      setDetails(null);
      if (!player || armyNames.length === 0) {
        setDetails({});
        return;
      }
      const fetched = await Promise.all(armyNames.map((n) => getArmyTroopDetail(n).catch(() => null)));
      if (!active) return;
      const next: Record<string, TroopDetail | null> = {};
      fetched.forEach((d, i) => { next[armyNames[i]] = d; });
      setDetails(next);
    })();
    return () => { active = false; };
  }, [player, armyNames]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      setBbDetails(null);
      if (!player || bbArmyNames.length === 0) {
        setBbDetails({});
        return;
      }
      const fetched = await Promise.all(bbArmyNames.map((n) => getArmyTroopDetail(n, { builderBase: true }).catch(() => null)));
      if (!active) return;
      const next: Record<string, TroopDetail | null> = {};
      fetched.forEach((d, i) => { next[bbArmyNames[i]] = d; });
      setBbDetails(next);
    })();
    return () => { active = false; };
  }, [player, bbArmyNames]);

  const result = useMemo(() => {
    if (!player || !details) return null;
    return computeMaxTime({ player, th, builderCount, armyDetails: details, excludedBuildings: excluded });
  }, [player, th, builderCount, details, excluded]);

  const bbResult = useMemo(() => {
    if (!player || !bbDetails) return null;
    return computeBuilderBaseMaxTime({ player, bh, builderCount: bbBuilderCount, armyDetails: bbDetails, excludedBuildings: excluded });
  }, [player, bh, bbBuilderCount, bbDetails, excluded]);

  // The same pipelines with nothing skipped. The screen renders from these so a
  // skipped upgrade stays in its row list (badged) and can be restored in place.
  const fullResult = useMemo(() => {
    if (!player || !details) return null;
    return computeMaxTime({ player, th, builderCount, armyDetails: details, excludedBuildings: NO_EXCLUSIONS });
  }, [player, th, builderCount, details]);

  const bbFullResult = useMemo(() => {
    if (!player || !bbDetails) return null;
    return computeBuilderBaseMaxTime({ player, bh, builderCount: bbBuilderCount, armyDetails: bbDetails, excludedBuildings: NO_EXCLUSIONS });
  }, [player, bh, bbBuilderCount, bbDetails]);

  const readiness = useMemo(() => {
    if (!player) return null;
    return computeThReadiness(player, th, excluded);
  }, [player, th, excluded]);

  const discounted = useMemo(() => {
    if (!result) return null;
    const lab = applyScope(result.lab.timeSec, result.lab.cost, result.lab.byResource, discounts.army);
    const pets = applyScope(result.pets.timeSec, result.pets.cost, result.pets.byResource, discounts.army);
    const equipment = applyScope(result.equipment.timeSec, result.equipment.cost, result.equipment.byResource, discounts.army);
    const builders = applyScope(result.builders.timeSec, result.builders.cost, result.builders.byResource, discounts.buildings);
    const totalByResource: Record<string, number> = {};
    for (const p of [lab, builders, pets, equipment]) {
      for (const [r, v] of Object.entries(p.byResource)) totalByResource[r] = (totalByResource[r] ?? 0) + v;
    }
    return {
      lab,
      builders,
      pets,
      equipment,
      headlineTime: Math.max(lab.timeSec, builders.timeSec, pets.timeSec, equipment.timeSec),
      totalByResource,
    };
  }, [result, discounts]);

  const bbDiscounted = useMemo(() => {
    if (!bbResult) return null;
    const bbBuilders = applyScope(bbResult.bbBuilders.timeSec, bbResult.bbBuilders.cost, bbResult.bbBuilders.byResource, discounts.buildings);
    const bbLab = applyScope(bbResult.bbLab.timeSec, bbResult.bbLab.cost, bbResult.bbLab.byResource, discounts.army);
    const totalByResource: Record<string, number> = {};
    for (const p of [bbBuilders, bbLab]) {
      for (const [r, v] of Object.entries(p.byResource)) totalByResource[r] = (totalByResource[r] ?? 0) + v;
    }
    return {
      bbBuilders,
      bbLab,
      headlineTime: Math.max(bbBuilders.timeSec, bbLab.timeSec),
      totalByResource,
    };
  }, [bbResult, discounts]);

  const pipelineDiscounted = useMemo(() => {
    if (!discounted || !bbDiscounted) return null;
    return {
      lab: discounted.lab,
      builders: discounted.builders,
      pets: discounted.pets,
      equipment: discounted.equipment,
      'bb-builders': bbDiscounted.bbBuilders,
      'bb-lab': bbDiscounted.bbLab,
    } as Record<PipelineKey, { timeSec: number; cost: number; byResource: Record<string, number> }>;
  }, [discounted, bbDiscounted]);

  const syncSubtitle = lastSync
    ? `Synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : undefined;

  const homeShare = useMemo<MaxtimeShareData | null>(() => {
    if (!discounted || !result) return null;
    const image = (name: string) =>
      getBuildingItemImage(name, getBuildingMaxLevelAtTH(name, th) ?? 1) ?? undefined;
    // Excluded pipelines drop out of the card too — a "0s" row reads like a bug.
    const gated = new Set<string>(
      [result.lab, result.builders, result.pets, result.equipment].filter((p) => p.gated).map((p) => p.key),
    );
    const pipelines: MaxtimePipeline[] = [
      { key: 'lab', label: 'Laboratory', timeSec: discounted.lab.timeSec, image: image('Lab') },
      { key: 'builders', label: 'Builders', timeSec: discounted.builders.timeSec, image: image('Builder Hut') },
      ...(hasPets ? [{ key: 'pets', label: 'Pet House', timeSec: discounted.pets.timeSec, image: image('Pet House') }] : []),
      { key: 'equipment', label: 'Equipment', timeSec: discounted.equipment.timeSec, instant: discounted.equipment.timeSec <= 0, image: image('Blacksmith') },
    ].filter((p) => !gated.has(p.key));
    // Levels dropped by exclusions, so a partial time isn't read as the full max.
    const skipped = fullResult
      ? (['lab', 'builders', 'pets', 'equipment'] as const).reduce((n, k) => n + Math.max(0, remainingLevels(fullResult[k].items) - remainingLevels(result[k].items)), 0)
      : 0;
    return {
      showBH: false,
      headlineLabel: 'Time to max',
      headlineTime: discounted.headlineTime,
      headlineNote: `TH${th} · ${builderCount} builders${skipped > 0 ? ` · ${levelsLabel(skipped)}` : ''}`,
      pipelines,
      resources: orderShareResources(discounted.totalByResource),
      subtitle: syncSubtitle,
    };
  }, [discounted, result, fullResult, th, builderCount, hasPets, syncSubtitle]);

  const bbShare = useMemo<MaxtimeShareData | null>(() => {
    if (!bbDiscounted || !bbResult) return null;
    const image = (name: string) =>
      getBuildingItemImage(name, getBuildingMaxLevelAtBH(name, bh) ?? 1, true) ?? undefined;
    const gated = new Set<string>(
      [bbResult.bbBuilders, bbResult.bbLab].filter((p) => p.gated).map((p) => p.key),
    );
    const pipelines: MaxtimePipeline[] = [
      { key: 'bb-builders', label: 'Builder Hall', timeSec: bbDiscounted.bbBuilders.timeSec, image: image('Builder Hall') },
      { key: 'bb-lab', label: 'Star Laboratory', timeSec: bbDiscounted.bbLab.timeSec, image: image('Star Laboratory') },
    ].filter((p) => !gated.has(p.key));
    const skipped = bbFullResult
      ? (['bbBuilders', 'bbLab'] as const).reduce((n, k) => n + Math.max(0, remainingLevels(bbFullResult[k].items) - remainingLevels(bbResult[k].items)), 0)
      : 0;
    return {
      showBH: true,
      headlineLabel: 'BB time to max',
      headlineTime: bbDiscounted.headlineTime,
      headlineNote: `BH${bh} · ${bbBuilderCount} builders${skipped > 0 ? ` · ${levelsLabel(skipped)}` : ''}`,
      pipelines,
      resources: orderShareResources(bbDiscounted.totalByResource),
      subtitle: syncSubtitle,
    };
  }, [bbDiscounted, bbResult, bbFullResult, bh, bbBuilderCount, syncSubtitle]);

  const activeShare = shareVillage === 'home' ? homeShare : bbShare;

  const shareCardWidth = useShareCardWidth();

  const shareVillageToggle = (
    <View style={styles.villageToggle}>
      <PressableRipple
        style={[styles.villageToggleItem, segCornerStyle(0, 2), shareVillage === 'home' && styles.villageToggleActive]}
        onPress={() => setShareVillage('home')}
      >
        <Ionicons name="home-outline" size={13} color={shareVillage === 'home' ? Colors.bg : Colors.textSecondary} />
        <Text style={[styles.villageToggleText, shareVillage === 'home' && styles.villageToggleTextActive]}>Home</Text>
      </PressableRipple>
      <PressableRipple
        style={[styles.villageToggleItem, segCornerStyle(1, 2), shareVillage === 'builder' && styles.villageToggleActive]}
        onPress={() => setShareVillage('builder')}
      >
        <Ionicons name="hammer-outline" size={13} color={shareVillage === 'builder' ? Colors.bg : Colors.textSecondary} />
        <Text style={[styles.villageToggleText, shareVillage === 'builder' && styles.villageToggleTextActive]}>Builder Base</Text>
      </PressableRipple>
    </View>
  );

  const nextResult = useMemo(() => {
    if (!player || !details) return null;
    return computeMaxTime({ player, th: th + 1, builderCount, armyDetails: details, excludedBuildings: excluded });
  }, [player, th, builderCount, details, excluded]);

  const nextDiscounted = useMemo(() => {
    if (!nextResult) return null;
    const lab = applyScope(nextResult.lab.timeSec, nextResult.lab.cost, nextResult.lab.byResource, discounts.army);
    const pets = applyScope(nextResult.pets.timeSec, nextResult.pets.cost, nextResult.pets.byResource, discounts.army);
    const equipment = applyScope(nextResult.equipment.timeSec, nextResult.equipment.cost, nextResult.equipment.byResource, discounts.army);
    const builders = applyScope(nextResult.builders.timeSec, nextResult.builders.cost, nextResult.builders.byResource, discounts.buildings);
    const totalByResource: Record<string, number> = {};
    for (const p of [lab, builders, pets, equipment]) {
      for (const [r, v] of Object.entries(p.byResource)) totalByResource[r] = (totalByResource[r] ?? 0) + v;
    }
    return {
      lab,
      builders,
      pets,
      equipment,
      headlineTime: Math.max(lab.timeSec, builders.timeSec, pets.timeSec, equipment.timeSec),
      totalByResource,
    };
  }, [nextResult, discounts]);

  const thUpgrade = useMemo(() => {
    if (!player || isMaxTh) return null;
    const data = getTownHallUpgrade(th + 1);
    if (!data) return null;
    const scope = discounts.buildings;
    const cost = Math.max(0, Math.round(data.cost * (1 - scope.costPercent / 100)));
    const timeSec = Math.max(0, Math.round(data.timeSec * (1 - scope.timePercent / 100)));
    const byResource: Record<string, number> = {};
    for (const [r, v] of Object.entries(data.byResource)) byResource[r] = Math.max(0, Math.round(v * (1 - scope.costPercent / 100)));
    return { cost, timeSec, byResource };
  }, [player, th, isMaxTh, discounts]);

  const fullPipelines = useMemo(() => {
    if (!fullResult || !bbFullResult) return null;
    return {
      lab: fullResult.lab,
      builders: fullResult.builders,
      pets: fullResult.pets,
      equipment: fullResult.equipment,
      'bb-builders': bbFullResult.bbBuilders,
      'bb-lab': bbFullResult.bbLab,
    } as Record<PipelineKey, PipelineResult>;
  }, [fullResult, bbFullResult]);

  if (loading || !player || !builderLoaded || !bbBuilderLoaded || !exclusionsLoaded || !result || !discounted || !bbResult || !bbDiscounted || !pipelineDiscounted || !fullPipelines) {
    return (
      <MaxTimeScreenSkeleton />
    );
  }

  const summaryTime = discounted ? formatTime(discounted.headlineTime) : '…';

  const isBuilderKey = (key: PipelineKey) => key === 'builders' || key === 'bb-builders';

  /** Discount scope for one row: heroes and buildings share a builders pipeline but not a discount. */
  const rowItemScope = (row: PipelineItemRow, key: PipelineKey, scope: ScopeDiscount) =>
    isBuilderKey(key) ? rowScope(row, heroNames, discounts) : scope;

  /**
   * Whether a row is skipped, and why. A row is skipped by its own key (buildings
   * by name, army items namespaced) or by the building gating it: Lab, Pet House,
   * Blacksmith, Hero Hall / Builder Barracks. Gate-skipped rows can't be toggled
   * on their own, the gating building has to be restored.
   */
  const rowExclusion = (row: PipelineItemRow, key: PipelineKey) => {
    const isArmy = !(isBuilderKey(key) && !heroNames.has(row.name));
    const ownKey = isArmy ? armyKey(row.name) : row.name;
    const armyPipeline: ArmyPipeline | null = !isArmy
      ? null
      : key === 'builders' ? 'heroes' : key === 'bb-builders' ? 'bb-heroes' : key;
    const gate = armyPipeline ? PIPELINE_GATES[armyPipeline] : undefined;
    const gated = gate !== undefined && excluded.has(gate);
    const own = excluded.has(ownKey);
    return { ownKey, own, gate: gated ? gate : undefined, skipped: own || gated };
  };

  const renderItems = (items: PipelineItemRow[], key: PipelineKey, scope: ScopeDiscount, roundLast = true) =>
    items
      .map((row) => ({ row, ex: rowExclusion(row, key), ...applyScope(row.timeSec, row.cost, row.byResource, rowItemScope(row, key, scope)) }))
      .sort((a, b) => a.timeSec - b.timeSec)
      .map(({ row, ex, timeSec, cost, byResource }, i) => {
        const isBuilding = isBuilderKey(key) && !heroNames.has(row.name);
        const isBB = key === 'bb-builders' || key === 'bb-lab';
        const iconSource = isBuilding
          ? getBuildingItemImage(row.name, row.iconLevel, isBB)
          : getArmyItemImage(row.name, null, isBB);
        return (
          <ItemCard
            key={row.name}
            name={row.name}
            level={row.currentLevel}
            maxLevel={row.maxLevel}
            thMaxLevel={row.maxLevel}
            iconSource={iconSource ?? undefined}
            costLabel={formatCostBreakdown(byResource) || formatCost(cost)}
            costResources={Object.keys(byResource).length > 0 ? byResource : undefined}
            timeLabel={timeSec > 0 ? formatTimeShort(timeSec) : ''}
            isLast={roundLast && i === items.length - 1}
            dimmed={ex.skipped}
            actionIcon={ex.gate ? 'lock-closed' : ex.skipped ? 'close-circle' : editExclusions ? 'checkmark-circle-outline' : undefined}
            actionColor={ex.skipped ? Colors.textTertiary : colors.textMuted}
            actionPosition="after"
            onActionPress={ex.gate || !editExclusions ? undefined : () => toggleExcluded(ex.ownKey)}
            actionAccessibilityLabel={editExclusions && !ex.gate ? (ex.skipped ? `Include ${row.name}` : `Exclude ${row.name}`) : undefined}
          />
        );
      });

  /**
   * Costs as the same two-column chip block the hero card uses, so the screen has
   * one pattern for resources. The label is kept here (the hero card omits it)
   * because these are the per-section amounts and the icon alone is ambiguous
   * between the three ores.
   */
  const renderResourceGrid = (entries: [string, number][]) => {
    if (entries.length === 0) return null;
    return (
      <View style={styles.resourceGrid}>
        {entries.map(([r, v]) => (
          <View key={r} style={styles.resourceCell}>
            <Image source={PACKAGE_RESOURCE_IMAGES[r]} style={styles.resourceCellIcon} resizeMode="contain" />
            <Text style={styles.resourceCellLabel} numberOfLines={1}>
              {resourceLabel(r)}
            </Text>
            <Text style={[styles.resourceCellValue, { color: resourceColor(r) }]}>
              {formatCost(v)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderPipelinesHeader = () => (
    <View style={[styles.sectionHeaderWrap, styles.pipelinesHeaderRow]}>
      <View style={styles.pipelinesHeaderTitle}>
        <SectionHeader title="Pipelines" />
      </View>
      <PressableRipple
        onPress={() => setEditExclusions((v) => !v)}
        hitSlop={8}
        style={[styles.editToggle, editExclusions && styles.editToggleActive]}
        accessibilityRole="button"
        accessibilityLabel={editExclusions ? 'Done excluding upgrades' : 'Exclude upgrades'}
      >
        <Ionicons
          name={editExclusions ? 'checkmark' : 'remove-circle-outline'}
          size={14}
          color={editExclusions ? Colors.bg : Colors.textSecondary}
        />
        <Text style={[styles.editToggleText, editExclusions && styles.editToggleTextActive]}>
          {editExclusions ? 'Done' : 'Exclude'}
        </Text>
      </PressableRipple>
    </View>
  );

  const renderPipeline = (p: PipelineResult, scope: ScopeDiscount, isLast: boolean) => {
    const meta = PIPELINE_META[p.key];
    const isOpen = expanded[p.key];
    const d = pipelineDiscounted ? pipelineDiscounted[p.key] : null;
    const isEquipment = p.key === 'equipment';
    // Excluded with the building that runs the pipeline (Lab, Pet House, …).
    const gate = p.gated ? PIPELINE_GATE[p.key] : undefined;
    const badge = gate ? 'Skipped' : isEquipment ? 'Instant' : d ? formatTimeShort(d.timeSec) : '…';
    // Only resources with real package art are shown, so the block is hidden
    // entirely rather than rendering an empty "Resources" heading.
    const pipelineResources = resourceRows(d ? d.byResource : p.byResource);
    // Rows come from the un-skipped pipeline so skipped upgrades stay listed (badged)
    // and can be restored in place; p itself only carries what still counts.
    const rows = fullPipelines[p.key].items;
    const skippedRows = rows.filter((r) => rowExclusion(r, p.key).skipped);
    const skippedTotals = { timeSec: 0, byResource: {} as Record<string, number> };
    for (const row of skippedRows) {
      const t = applyScope(row.timeSec, row.cost, row.byResource, rowItemScope(row, p.key, scope));
      skippedTotals.timeSec += t.timeSec;
      for (const [r, v] of Object.entries(t.byResource)) skippedTotals.byResource[r] = (skippedTotals.byResource[r] ?? 0) + v;
    }
    // Own-key skips only: rows skipped through their gating building come back with it.
    const restoreKeys = skippedRows.map((r) => rowExclusion(r, p.key)).filter((x) => x.own).map((x) => x.ownKey);
    const note = gate
      ? `Excluded with the ${gate}. Restore it in the ${p.key.startsWith('bb') ? 'BB ' : ''}Builders list to plan this pipeline again.`
      : p.items.length === 0 ? 'Every upgrade here is skipped' : null;
    const buildingSplitSec = (sec: number, isHero = false) => {
      const pct = isHero ? discounts.army.timePercent : discounts.buildings.timePercent;
      return Math.max(0, Math.round(sec * (1 - pct / 100)));
    };
    // Highest-level sprite available at this TH; falls back to base icon when the building is locked here.
    const pipelineHeaderImage = (name: string) =>
      getBuildingItemImage(name, getBuildingMaxLevelAtTH(name, th) ?? 1) ?? undefined;
    const pipelineBBHeaderImage = (name: string) =>
      getBuildingItemImage(name, getBuildingMaxLevelAtBH(name, bh) ?? 1, true) ?? undefined;
    const headerIconSource = p.key === 'lab'
      ? pipelineHeaderImage('Lab')
      : p.key === 'builders'
        ? pipelineHeaderImage('Builder Hut')
        : p.key === 'bb-builders'
          ? pipelineBBHeaderImage('Builder Hall')
          : p.key === 'bb-lab'
            ? pipelineBBHeaderImage('Star Laboratory')
            : isEquipment
              ? pipelineHeaderImage('Blacksmith')
              : pipelineHeaderImage('Pet House');
    return (
      <React.Fragment key={p.key}>
        <SettingRow
          icon={meta.icon}
          iconSource={headerIconSource ?? undefined}
          title={meta.title}
          desc={gate ? `${gate} excluded — left out of the maxing timeline` : meta.desc}
          compact
          isFirst={isOpen}
          isLast={isLast && !isOpen}
          onPress={() => setExpanded((prev) => ({ ...prev, [p.key]: !prev[p.key] }))}
        >
          <View style={styles.readinessChildren}>
            {!isOpen && !gate && skippedRows.length > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeMarker}>{`−${skippedRows.length}`}</Text>
              </View>
            )}
            <View style={styles.headerBadge}>
              <Text style={styles.pipelineTime}>{badge}</Text>
            </View>
          </View>
        </SettingRow>
        {isOpen && (
          <View style={styles.pipelineBody}>
            {rows.length === 0 ? (
              <Text style={styles.emptyText}>Nothing left to upgrade</Text>
            ) : (
              <>
                <View style={styles.summaryCard}>
                  {note ? (
                    <Text style={styles.emptyText}>{note}</Text>
                  ) : (
                    <>
                      <Text style={styles.summaryLabel}>Time</Text>
                      <Text style={styles.summaryTime}>
                        {isEquipment ? 'Instant' : formatTime(d ? d.timeSec : p.timeSec)}
                      </Text>
                      {p.split && (
                        <View style={styles.splitList}>
                          <View style={styles.splitRow}>
                            <Text style={styles.splitLabel}>Buildings</Text>
                            <Text style={styles.splitValue}>
                              {formatTime(buildingSplitSec(p.split.buildingsOnlySec))}
                            </Text>
                          </View>
                          <View style={styles.splitRow}>
                            <Text style={styles.splitLabel}>Heroes</Text>
                            <Text style={styles.splitValue}>
                              {formatTime(buildingSplitSec(p.split.heroesOnlySec, true))}
                            </Text>
                          </View>
                          {p.split.optimalHeroBuilders >= 0 && (
                            <View style={styles.splitRow}>
                              <View style={styles.splitLabelRow}>
                                <Text style={styles.splitLabel}>Optimal split</Text>
                                <View style={styles.splitAllocation}>
                                  <Text style={styles.splitAllocationText}>
                                    {`${p.split.optimalHeroBuilders}H / ${p.split.optimalBuildingBuilders}B`}
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.splitValue}>
                                {formatTime(buildingSplitSec(p.split.optimalSec))}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                      {pipelineResources.length > 0 && (
                        <>
                          <View style={styles.summaryDivider} />
                          <Text style={styles.summaryLabel}>Resources</Text>
                          {renderResourceGrid(pipelineResources)}
                        </>
                      )}
                    </>
                  )}
                  {skippedRows.length > 0 && (
                    <>
                      <View style={styles.summaryDivider} />
                      <View style={styles.splitRow}>
                        <View style={styles.splitLabelRow}>
                          <View style={styles.splitAllocation}>
                            <Text style={styles.splitAllocationText}>{skippedRows.length}</Text>
                          </View>
                          <Text style={styles.splitLabel}>Excluded time</Text>
                        </View>
                        <Text style={styles.splitValue}>
                          {isEquipment ? 'Instant' : formatTime(skippedTotals.timeSec)}
                        </Text>
                      </View>
                      {resourceRows(skippedTotals.byResource).length > 0 && (
                        <>
                          <Text style={styles.summaryLabel}>Excluded resources</Text>
                          {renderResourceGrid(resourceRows(skippedTotals.byResource))}
                        </>
                      )}
                    </>
                  )}
                </View>
                {/* With a Restore button below, the last row stays square so the two read as one block. */}
                {renderItems(rows, p.key, scope, restoreKeys.length === 0)}
                {restoreKeys.length > 0 && (
                  <PressableRipple
                    onPress={() => setExcludedMany(restoreKeys, false)}
                    hitSlop={8}
                    style={styles.exclusionResetBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.exclusionResetText}>{`Restore ${restoreKeys.length} excluded`}</Text>
                  </PressableRipple>
                )}
              </>
            )}
            {!isLast && <View style={styles.sectionSeparator} />}
          </View>
        )}
      </React.Fragment>
    );
  };

  interface NewItemRow {
    key: string;
    name: string;
    icon: number | undefined;
    meta: string | undefined | React.ReactNode;
    type: string | undefined;
  }

  const newGroups = (readiness?.nextUnlocks ?? [])
    .filter(u => u.label !== 'levels')
    .map((u, gi) => {
      const isArmy = u.label === 'lab' || u.label === 'heroes';
      const title =
        u.label === 'lab'
          ? 'Laboratory'
          : u.label === 'heroes'
            ? 'Heroes'
            : u.label === 'buildings'
              ? 'New Buildings'
              : u.value.includes('army')
                ? 'Army Levels'
                : 'Building Levels';
      const rows: NewItemRow[] = (u.names ?? []).map((name) => {
        const maxLvl = isArmy ? getMaxLevelAtTH(name, readiness!.nextTh) : null;
        const troopDetail = details?.[name];
        const costResource = isArmy
          ? troopDetail?.levels?.find((l) => l.costResource)?.costResource
          : undefined;
        const category = isArmy ? getArmyItem(name)?.category : undefined;
        const kind =
          category === 'spell' ? 'Spell'
            : category === 'siege-machine' ? 'Siege Machine'
              : category === 'hero' ? 'Hero'
                : category === 'pet' ? 'Pet'
                  : category === 'hero-equipment' ? 'Equipment'
                    : category ? 'Troop'
                      : undefined;
        const typeLabel = kind === 'Spell'
          ? `${costResource ?? 'Elixir'} Spell`
          : kind === 'Troop' && costResource
            ? costResource.includes('Dark')
              ? 'Dark Elixir Troop'
              : costResource.includes('Shiny')
                ? 'Ore Troop'
                : costResource.includes('Glowing')
                  ? 'Glowing Ore Troop'
                  : costResource.includes('Starry')
                    ? 'Starry Ore Troop'
                    : `${costResource} Troop`
            : kind;
        const levelLabel = (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[Typography.caption, { color: Colors.textTertiary }]}>1</Text>
            <Ionicons name="chevron-forward" size={10} color={Colors.textTertiary} style={{ marginHorizontal: 2 }} />
            <Text style={[Typography.caption, { color: Colors.textTertiary }]}>{maxLvl}</Text>
          </View>
        );
        return {
          key: name,
          name,
          icon: (isArmy ? getArmyItemImage(name) : getBuildingItemImage(name)) ?? undefined,
          meta: levelLabel,
          type: typeLabel,
        };
      });
      for (const d of u.details ?? []) {
        rows.push({
          key: `${d.name}-${d.nextMax}-${gi}`,
          name: d.name,
          icon: (getBuildingItemImage(d.name, d.nextMax) ?? getBuildingItemImage(d.name)) ?? undefined,
          meta: `${d.count > 1 ? `×${d.count} ` : ''}+${d.levels} \u2192 ${d.nextMax}`,
          type: undefined,
        });
      }
      return { key: `${u.label}-${gi}`, title, rows };
    })
    .filter((g) => g.rows.length > 0);

  const renderHeroResourceGrid = (byResource: Record<string, number>) => {
    const entries = resourceEntries(byResource);
    if (entries.length === 0) return null;
    return (
      <View style={styles.heroResourcesGrid}>
        {entries.map(([r, v], index, arr) => (
          <View
            key={r}
            style={[
              styles.heroResourceCell,
              index === 0 && { borderTopLeftRadius: Radius.xl * 1.25 },
              index === 1 && { borderTopRightRadius: Radius.xl * 1.25 },
              ((index === arr.length - 2 && index % 2 === 0) || (index === arr.length - 1 && index % 2 === 0)) && { borderBottomLeftRadius: Radius.xl * 1.25 },
              index === arr.length - 1 && { borderBottomRightRadius: Radius.xl * 1.25 },
            ]}
          >
            {PACKAGE_RESOURCE_IMAGES[r] ? (
              <Image source={PACKAGE_RESOURCE_IMAGES[r]} style={styles.heroResourceIcon} resizeMode="contain" />
            ) : null}
            <Text style={[styles.heroResourceValue, { color: resourceColor(r) }]}>{formatCost(v)}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Time to Max</Text>
            <View style={styles.headerActions}>
              <PressableRipple
                onPress={() => {
                  // Share whichever village is on screen, so the preview matches
                  // what the user just tapped share on.
                  setShareVillage(village);
                  setShareVisible(true);
                }}
                hitSlop={8}
                style={styles.headerBtn}
              >
                <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
              </PressableRipple>
            </View>
          </View>
          <Text style={styles.subtitle}>
            {isBB ? `Remaining upgrades for Builder Hall ${bh}` : `Remaining upgrades for Town Hall ${th}`}
          </Text>
        </View>

        {showBB && (
          <View style={styles.villageToggleWrap}>
            <View style={styles.villageToggle}>
              <PressableRipple
                style={[
                  styles.villageToggleItem,
                  segCornerStyle(0, 2),
                  !isBB && styles.villageToggleActive,
                ]}
                onPress={() => setVillage('home')}
              >
                {thHallImage ? (
                  <Image source={thHallImage} style={styles.villageToggleImg} resizeMode="contain" />
                ) : (
                  <Ionicons
                    name="home-outline"
                    size={13}
                    color={!isBB ? Colors.bg : Colors.textSecondary}
                  />
                )}
                <Text style={[styles.villageToggleText, !isBB && styles.villageToggleTextActive]}>
                  {`TH${th}`}
                </Text>
              </PressableRipple>
              <PressableRipple
                style={[
                  styles.villageToggleItem,
                  segCornerStyle(1, 2),
                  isBB && styles.villageToggleActive,
                ]}
                onPress={() => setVillage('builder')}
              >
                {bhHallImage ? (
                  <Image source={bhHallImage} style={styles.villageToggleImg} resizeMode="contain" />
                ) : (
                  <Ionicons
                    name="hammer-outline"
                    size={13}
                    color={isBB ? Colors.bg : Colors.textSecondary}
                  />
                )}
                <Text style={[styles.villageToggleText, isBB && styles.villageToggleTextActive]}>
                  {`BH${bh}`}
                </Text>
              </PressableRipple>
            </View>
          </View>
        )}

        {!isBB && (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Estimated time to max</Text>
              <Text style={styles.heroTime}>{summaryTime}</Text>
              <Text style={styles.heroNote}>
                Laboratory, builders & pets run in parallel — this is the longest pipeline
              </Text>
              {renderHeroResourceGrid(discounted.totalByResource)}
            </View>

            <View style={styles.sectionHeaderWrap}>
              <SectionHeader title="Builders" />
            </View>
            <View style={styles.builderCard}>
              <View style={styles.builderTextBlock}>
                <Text style={styles.builderTitle}>Builders</Text>
                <Text style={styles.builderDesc}>Building & hero time is divided across these</Text>
              </View>
              <View style={styles.builderStepper}>
                <Pressable
                  onPress={() => setBuilderCount(builderCount - 1)}
                  disabled={!canDecreaseBuilders}
                  style={[
                    styles.stepperBtn,
                    !canDecreaseBuilders && styles.stepperBtnDisabled,
                  ]}
                >
                  <Ionicons name="remove" size={18} color={canDecreaseBuilders ? Colors.textPrimary : Colors.textMuted} />
                </Pressable>
                <View style={styles.builderCountPill}>
                  <Text style={styles.builderCountText}>{builderCount}</Text>
                </View>
                <Pressable
                  onPress={() => setBuilderCount(builderCount + 1)}
                  disabled={!canIncreaseBuilders}
                  style={[
                    styles.stepperBtn,
                    !canIncreaseBuilders && styles.stepperBtnDisabled,
                  ]}
                >
                  <Ionicons name="add" size={18} color={canIncreaseBuilders ? Colors.textPrimary : Colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {renderPipelinesHeader()}
            <View style={styles.pipelineSections}>
              {renderPipeline(result.lab, discounts.army, false)}
              {renderPipeline(result.builders, discounts.buildings, false)}
              {hasPets ? renderPipeline(result.pets, discounts.army, false) : null}
              {renderPipeline(result.equipment, discounts.army, true)}
            </View>

            <View style={styles.sectionHeaderWrap}>
              <SectionHeader title="TH Upgrade Readiness" />
            </View>
            <View style={styles.readinessSection}>
              <SettingRow
                icon="trending-up-outline"
                title={readiness ? `Ready for TH${readiness.nextTh}?` : 'TH Upgrade Readiness'}
                desc={readiness ? readiness.verdictLabel : ''}
                compact
                isFirst
                isLast={!readinessOpen}
                onPress={() => setReadinessOpen((o) => !o)}
              >
                {readiness && (
                  <View style={styles.pipelineBadge}>
                    <Text style={styles.pipelineTime}>{Math.round(readiness.score)}%</Text>
                  </View>
                )}
              </SettingRow>
              {readinessOpen && readiness && (
                <View style={styles.readinessBody}>
                  <View style={styles.readinessTop}>
                    <Text
                      style={[
                        styles.readinessVerdict,
                        { color: readiness.verdict === 'ready' ? Colors.success : readiness.verdict === 'almost' ? Colors.warning : Colors.destructive },
                      ]}
                    >
                      {readiness.verdictLabel}
                    </Text>
                    <Text style={styles.readinessScore}>{Math.round(readiness.score)}%</Text>
                  </View>
                  <View style={styles.readinessTrack}>
                    <View style={[styles.readinessFill, { width: `${Math.max(2, readiness.score)}%` }]} />
                  </View>
                  <Text style={styles.readinessNote}>{readiness.note}</Text>
                  {readiness.nextUnlocks.length > 0 && (
                    <Text style={styles.readinessNext}>
                      Unlocks at TH{readiness.nextTh}: {readiness.nextUnlocks.map((u) => u.value).join(' · ')}
                    </Text>
                  )}
                </View>
              )}
              {readinessOpen && readiness && (
                <React.Fragment>
                  {readiness.pipelines.map((p, i) => {
                    const isBuilders = p.key === 'builders';
                    const isLab = p.key === 'lab';
                    const isOpen = isBuilders ? buildersExpanded : isLab ? labExpanded : false;
                    const isExpandable = isBuilders || isLab;
                    return (
                      <React.Fragment key={p.key}>
                        <SettingRow
                          icon={PIPELINE_META[p.key].icon}
                          title={PIPELINE_META[p.key].title}
                          desc={READINESS_PIPELINE_DESC[p.key]}
                          compact
                          isFirst={i === 0}
                          isLast={isOpen ? false : i === readiness.pipelines.length - 1}
                          onPress={isExpandable ? (isBuilders ? () => setBuildersExpanded((o) => !o) : () => setLabExpanded((o) => !o)) : undefined}
                        >
                          <View style={styles.readinessChildren}>
                            <View style={styles.pipelineBadge}>
                              <Text style={styles.pipelineTime}>{Math.round(p.pct)}%</Text>
                            </View>
                          </View>
                        </SettingRow>
                        {isExpandable && isOpen && (
                          <View style={styles.pipelineExpandBody}>
                            {p.children.map((c) => (
                              <View key={c.key} style={styles.readinessCatRow}>
                                <Text style={styles.readinessCatLabel}>{c.label}</Text>
                                <View style={styles.readinessCatTrack}>
                                  <View style={[styles.readinessCatFill, { width: `${Math.max(2, c.pct)}%` }]} />
                                </View>
                                <Text style={styles.readinessCatPct}>{Math.round(c.pct)}%</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              )}
              {readinessOpen && readiness && discounted && nextDiscounted && !isMaxTh && (
                <React.Fragment>
                  <SettingRow
                    icon="trending-up-outline"
                    title={`Rush to TH${readiness.nextTh}`}
                    desc={`with current levels · ${formatTimeShort(nextDiscounted.headlineTime)} total`}
                    compact
                    isFirst
                    isLast={!rushExpanded}
                    onPress={() => setRushExpanded((o) => !o)}
                  >
                    <View style={styles.readinessChildren}>
                      <View style={styles.pipelineBadge}>
                        <Text style={styles.pipelineTime}>{formatTimeShort(nextDiscounted.headlineTime)}</Text>
                      </View>
                    </View>
                  </SettingRow>
                  {rushExpanded && (
                    <View style={styles.rushExpandBody}>
                      {thUpgrade && (
                        <ItemCard
                          name="Town Hall"
                          level={th}
                          maxLevel={readiness.nextTh}
                          thMaxLevel={readiness.nextTh}
                          icon={getTownHallImageSource(readiness.nextTh) ?? undefined}
                          costResources={thUpgrade.byResource}
                          timeLabel={thUpgrade.timeSec > 0 ? formatTimeShort(thUpgrade.timeSec) : ''}
                          isFirst
                        />
                      )}
                      <Text style={styles.rushSectionLabel}>Time to finish</Text>
                      <View style={styles.rushCompareHeader}>
                        <Text style={styles.rushCompareCol}>Pipeline</Text>
                        <Text style={styles.rushCompareCol}>TH{th} remaining</Text>
                        <Text style={styles.rushCompareCol}>TH{readiness.nextTh} adds</Text>
                        <Text style={styles.rushCompareCol}>Total at TH{readiness.nextTh}</Text>
                      </View>
                      {[
                        { key: 'lab', label: 'Laboratory', cur: discounted.lab.timeSec, next: nextDiscounted.lab.timeSec },
                        { key: 'builders', label: 'Builders', cur: discounted.builders.timeSec, next: nextDiscounted.builders.timeSec },
                        { key: 'pets', label: 'Pet House', cur: discounted.pets.timeSec, next: nextDiscounted.pets.timeSec },
                        { key: 'equipment', label: 'Equipment', cur: discounted.equipment.timeSec, next: nextDiscounted.equipment.timeSec, instant: true },
                      ].map((p) => (
                        <View key={p.key} style={styles.rushCompareRow}>
                          <Text style={styles.rushCompareLabel}>{p.label}</Text>
                          <Text style={styles.rushCompareVal}>{p.instant ? 'Instant' : formatTimeShort(p.cur)}</Text>
                          <Text style={styles.rushCompareVal}>{p.instant ? 'Instant' : p.next > p.cur ? `+${formatTimeShort(p.next - p.cur)}` : '—'}</Text>
                          <Text style={styles.rushCompareVal}>{p.instant ? 'Instant' : formatTimeShort(p.next)}</Text>
                        </View>
                      ))}
                      <View style={styles.rushDivider} />
                      <Text style={styles.rushSectionLabel}>Cost to finish</Text>
                      <View style={styles.rushCompareHeader}>
                        <Text style={styles.rushCompareCol}>Pipeline</Text>
                        <Text style={styles.rushCompareCol}>TH{th} remaining</Text>
                        <Text style={styles.rushCompareCol}>TH{readiness.nextTh} adds</Text>
                        <Text style={styles.rushCompareCol}>Total at TH{readiness.nextTh}</Text>
                      </View>
                      {[
                        { key: 'lab', label: 'Laboratory', cur: discounted.lab.cost, next: nextDiscounted.lab.cost },
                        { key: 'builders', label: 'Builders', cur: discounted.builders.cost, next: nextDiscounted.builders.cost },
                        { key: 'pets', label: 'Pet House', cur: discounted.pets.cost, next: nextDiscounted.pets.cost },
                        { key: 'equipment', label: 'Equipment', cur: discounted.equipment.cost, next: nextDiscounted.equipment.cost },
                      ].map((p) => (
                        <View key={p.key} style={styles.rushCompareRow}>
                          <Text style={styles.rushCompareLabel}>{p.label}</Text>
                          <Text style={styles.rushCompareVal}>{formatCost(p.cur)}</Text>
                          <Text style={styles.rushCompareVal}>{p.next > p.cur ? `+${formatCost(p.next - p.cur)}` : '—'}</Text>
                          <Text style={styles.rushCompareVal}>{formatCost(p.next)}</Text>
                        </View>
                      ))}
                      {resourceRows(nextDiscounted.totalByResource).length > 0 && (
                        <View style={styles.rushCostResources}>
                          <Text style={styles.rushNewItemsTitle}>Resources needed by TH{readiness.nextTh}</Text>
                          {renderResourceGrid(resourceRows(nextDiscounted.totalByResource))}
                        </View>
                      )}
                      <View style={styles.rushDivider} />
                      <Text style={styles.rushNewItemsTitle}>New at TH{readiness.nextTh}</Text>
                      {newGroups.length > 0 ? (
                        newGroups.map((g) => (
                          <View key={g.key} style={styles.newGroup}>
                            <View style={styles.newGroupHeader}>
                              <Text style={styles.newGroupTitle}>{g.title}</Text>
                              <Text style={styles.newGroupCount}>{g.rows.length}</Text>
                            </View>
                            <View style={styles.newGroupCard}>
                              {g.rows.map((r, i) => (
                                <View
                                  key={`${r.key}-${i}`}
                                  style={[
                                    styles.newRow,
                                    i === 0 && styles.newRowFirst,
                                    i === g.rows.length - 1 && styles.newRowLast,
                                    i > 0 && styles.newRowBorder,
                                  ]}
                                >
                                  {r.icon ? (
                                    <Image source={r.icon} style={styles.newRowIcon} resizeMode="contain" />
                                  ) : null}
                                  <View style={styles.newRowTextBlock}>
                                    <Text style={styles.newRowName} numberOfLines={1}>
                                      {r.name}
                                    </Text>
                                    {r.type ? <Text style={styles.newRowType}>{r.type}</Text> : null}
                                  </View>
                                  <Text style={styles.newRowMeta}>{r.meta}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.rushNewItemLabel}>No new items</Text>
                      )}
                    </View>
                  )}
                </React.Fragment>
              )}
              {readinessOpen && readiness && isMaxTh && (
                <View style={styles.maxThCelebration}>
                  <Ionicons name="trophy" size={48} color={Colors.warning} />
                  <Text style={styles.maxThTitle}>Maximum Town Hall Reached!</Text>
                  <Text style={styles.maxThSubtitle}>Congratulations, Chief! 🎉</Text>
                  <Text style={styles.maxThBody}>
                    {"You've maxed out every building, troop, spell, hero, and pet."}
                    Your village stands complete — a testament to your dedication.
                  </Text>
                  <Text style={styles.maxThBody}>
                    Thank you for choosing ClashPrime for your journey.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {isBB && (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Builder Base time to max</Text>
              <Text style={styles.heroTime}>{formatTime(bbDiscounted.headlineTime)}</Text>
              <Text style={styles.heroNote}>
                BB builders & Star Laboratory run in parallel — this is the longest pipeline
              </Text>
              {renderHeroResourceGrid(bbDiscounted.totalByResource)}
            </View>

            <View style={styles.sectionHeaderWrap}>
              <SectionHeader title="Builders" />
            </View>
            <View style={styles.builderCard}>
              <View style={styles.builderTextBlock}>
                <Text style={styles.builderTitle}>BB Builders</Text>
                <Text style={styles.builderDesc}>BB building & hero time is divided across these</Text>
              </View>
              <View style={styles.builderStepper}>
                <Pressable
                  onPress={() => setBuilderBaseCount(Math.max(1, bbBuilderCount - 1))}
                  disabled={bbBuilderCount <= 1}
                  style={[
                    styles.stepperBtn,
                    bbBuilderCount <= 1 && styles.stepperBtnDisabled,
                  ]}
                >
                  <Ionicons name="remove" size={18} color={bbBuilderCount <= 1 ? Colors.textMuted : Colors.textPrimary} />
                </Pressable>
                <View style={styles.builderCountPill}>
                  <Text style={styles.builderCountText}>{bbBuilderCount}</Text>
                </View>
                <Pressable
                  onPress={() => setBuilderBaseCount(Math.min(3, bbBuilderCount + 1))}
                  disabled={bbBuilderCount >= 3}
                  style={[
                    styles.stepperBtn,
                    bbBuilderCount >= 3 && styles.stepperBtnDisabled,
                  ]}
                >
                  <Ionicons name="add" size={18} color={bbBuilderCount >= 3 ? Colors.textMuted : Colors.textPrimary} />
                </Pressable>
              </View>
            </View>

            {renderPipelinesHeader()}
            <View style={styles.pipelineSections}>
              {renderPipeline(bbResult.bbBuilders, discounts.buildings, false)}
              {renderPipeline(bbResult.bbLab, discounts.army, true)}
            </View>
          </>
        )}
      </ScrollView>

      {player && (
        <SharePreviewModal
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          cardWidth={shareCardWidth}
          header={shareVillageToggle}
          ready={activeShare !== null}
          shareTitle="Time to max"
          onError={(message) => Alert.alert('Share Failed', message)}
        >
          {({ measure }) =>
            activeShare ? (
              <MaxtimeShareCard
                player={player}
                data={{ ...activeShare, width: shareCardWidth, measure }}
              />
            ) : null
          }
        </SharePreviewModal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingBottom: 150,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sharePreviewCard: {
    alignSelf: 'stretch',
    maxWidth: 520,
    alignItems: 'center',
    gap: Spacing.base,
  },
  villageToggleWrap: {
    alignSelf: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
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
  shareActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignSelf: 'center',
  },
  shareActionGhost: {
    flex: 1,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareActionGhostText: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  shareActionPrimary: {
    flex: 1,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareActionPrimaryText: {
    ...Typography.headline,
    color: Colors.bg,
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
  heroCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: Radius.xxl,
    backgroundColor: Colors.bgCard,
  },
  heroLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  heroTime: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '800',
  },
  heroNote: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  heroResourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    justifyContent: 'space-between',
  },
  heroResourceCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    minWidth: '48%',
    flex: 1,
  },
  heroResourceIcon: {
    width: 24,
    height: 24,
    marginRight: Spacing.lg,
  },
  heroResourceDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: Spacing.lg,
  },
  heroResourceValue: {
    ...Typography.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  readinessSection: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
    borderRadius: Radius.xl * 1.25,
    overflow: 'hidden',
  },
  readinessBody: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  readinessTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  readinessText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  readinessLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  readinessVerdict: {
    ...Typography.headline,
    fontWeight: '700',
  },
  readinessScore: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  readinessTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: Colors.progressTrack,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  readinessFill: {
    height: '100%',
    backgroundColor: Colors.textPrimary,
    borderRadius: 6,
  },
  readinessNote: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  readinessNext: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 16,
  },
  readinessFooter: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  readinessChildren: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pipelineExpandBody: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  readinessCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  readinessCatLabel: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    width: 86,
    fontWeight: '600',
  },
  readinessCatTrack: {
    flex: 1,
    height: 6,
    borderRadius: 5,
    backgroundColor: Colors.progressTrack,
    overflow: 'hidden',
  },
  readinessCatFill: {
    height: '100%',
    backgroundColor: Colors.textSecondary,
    borderRadius: 6,
  },
  readinessCatPct: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    width: 34,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  builderCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  builderTextBlock: {
    flex: 1,
  },
  builderTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  builderDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  builderChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  builderCountPill: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builderCountText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '700',
  },
  builderStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  exclusionResetBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    width: '100%',
    alignItems: 'center',
  },
  exclusionResetText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperBtnText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sectionHeaderWrap: {
    paddingHorizontal: Spacing.base,
  },
  pipelineSections: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
    borderRadius: Radius.xl * 1.25,
    overflow: 'hidden',
  },
  pipelineBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeMarker: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pipelinesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  pipelinesHeaderTitle: {
    flex: 1,
  },
  editToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    height: 28,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
  },
  editToggleActive: {
    backgroundColor: Colors.accent,
  },
  editToggleText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editToggleTextActive: {
    color: Colors.bg,
  },
  pipelineTime: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pipelineBody: {
    paddingTop: 0,
  },
  sectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    margin: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  summaryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryTime: {
    ...Typography.title3,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  splitList: {
    marginTop: Spacing.xs,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  splitLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  splitLabel: {
    ...Typography.footnote,
    color: Colors.textSecondary,
  },
  splitAllocation: {
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  splitAllocationText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  splitValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  resourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 2,
  },
  resourceCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    minWidth: '47%',
    flexGrow: 1,
  },
  resourceCellIcon: {
    width: 18,
    height: 18,
  },
  resourceCellLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    flex: 1,
  },
  resourceCellValue: {
    ...Typography.subhead,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  rushExpandBody: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  rushCompareHeader: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  rushSectionLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  rushCostResources: {
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  rushCompareCol: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
  },
  rushCompareRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  rushCompareLabel: {
    flex: 1,
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  rushCompareVal: {
    flex: 1,
    ...Typography.footnote,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  rushCompareDelta: {
    flex: 1,
    ...Typography.footnote,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  rushDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  rushNewItemsTitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  rushNewItemLabel: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  newGroup: {
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
  },
  newGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: Spacing.xs,
  },
  newGroupTitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newGroupCount: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  newGroupCard: {
    overflow: 'hidden',
  },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  newRowFirst: {
    borderTopLeftRadius: Radius.xl * 1.25,
    borderTopRightRadius: Radius.xl * 1.25,
  },
  newRowLast: {
    borderBottomLeftRadius: Radius.xl * 1.25,
    borderBottomRightRadius: Radius.xl * 1.25,
  },
  newRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  newRowIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  newRowTextBlock: {
    flex: 1,
    marginRight: Spacing.md,
  },
  newRowName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  newRowType: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  newRowMeta: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  maxThCelebration: {
    marginTop: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.xl * 1.25,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.warning,
    shadowColor: Colors.warning,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  maxThTitle: {
    ...Typography.title2,
    color: Colors.warning,
    fontWeight: '800',
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  maxThSubtitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  maxThBody: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});