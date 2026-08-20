import type { ClashPlayer } from '../types/clash';
import type { TroopDetail } from '../api/troopDetail';
import { getMaxLevelAtTH, getSuperTroopNames, getArmyItem, getBuildingMaxLevelAtTH, getAllItemsAtTH } from './armyData';
import { getBuildingEffectiveMax } from './buildingImages';
import { getBuildingCopies, getCountAtTH } from './buildingCopies';
import { getBuildingCategories } from './buildingData';
import {
  remainingArmyCosts,
  remainingBuildingCosts,
  sumCosts,
  buildingUpgradeChainTimes,
  scheduleChains,
  type CostTime,
} from './upgradeCosts';

export type PipelineKey = 'lab' | 'builders' | 'pets' | 'equipment';

export interface PipelineItemRow {
  name: string;
  currentLevel: number;
  maxLevel: number;
  timeSec: number;
  cost: number;
  byResource: Record<string, number>;
  /** Representative level for a level-based building sprite (max copy level). */
  iconLevel?: number;
}

/** Buildings vs heroes split stats for the builders pipeline. */
export interface BuilderSplit {
  buildingChains: number;
  heroChains: number;
  /** Makespan if every builder is dedicated to buildings only. */
  buildingsOnlySec: number;
  /** Makespan if every builder is dedicated to heroes only. */
  heroesOnlySec: number;
  /** Sum of building chain times on a single builder (serial). */
  buildingsSerialSec: number;
  /** Sum of hero chain times on a single builder (serial). */
  heroesSerialSec: number;
  /** Best hero-builder count in the minimal makespan split (or -1 when no split applies). */
  optimalHeroBuilders: number;
  optimalBuildingBuilders: number;
  optimalSec: number;
}

export interface PipelineResult {
  key: PipelineKey;
  /** Wall-clock seconds for this pipeline (builders uses chain scheduling). */
  timeSec: number;
  cost: number;
  byResource: Record<string, number>;
  items: PipelineItemRow[];
  /** Only present on the builders pipeline. */
  split?: BuilderSplit;
}

export interface MaxTimeInput {
  player: ClashPlayer;
  th: number;
  builderCount: number;
  /** Pre-fetched package details keyed by display name (armyData.getArmyTroopDetail). */
  armyDetails: Record<string, TroopDetail | null>;
}

export interface MaxTimeResult {
  lab: PipelineResult;
  builders: PipelineResult;
  pets: PipelineResult;
  equipment: PipelineResult;
  /** Pipelines run in parallel, so the headline number is the longest one. */
  totalTimeSec: number;
  totalCost: number;
  totalByResource: Record<string, number>;
  builderCount: number;
}

function toRow(name: string, currentLevel: number, maxLevel: number, ct: CostTime): PipelineItemRow {
  return {
    name,
    currentLevel,
    maxLevel,
    timeSec: ct.time,
    cost: ct.cost,
    byResource: ct.byResource ?? {},
  };
}

function aggregate(key: PipelineKey, rows: PipelineItemRow[]): PipelineResult {
  const ct = sumCosts(
    rows.map((r) => ({ cost: r.cost, time: r.timeSec, hasData: true, byResource: r.byResource })),
  );
  return { key, timeSec: ct.time, cost: ct.cost, byResource: ct.byResource ?? {}, items: rows };
}

interface LeveledItem {
  name: string;
  level: number;
  village?: string;
}

/** Items the player has not unlocked yet at this Town Hall, starting from level 0. */
function lockedItemsAtTH(th: number, types: string[]): LeveledItem[] {
  return getAllItemsAtTH(th)
    .filter((i) => types.includes(i.type))
    .map((i) => ({ name: i.name, level: 0 }));
}

/** Merge player-owned items (real level) over the locked set (level 0), deduped by name. */
function mergeLeveled(playerItems: LeveledItem[], locked: LeveledItem[]): LeveledItem[] {
  const byName = new Map<string, LeveledItem>();
  for (const it of locked) byName.set(it.name, it);
  for (const it of playerItems) {
    if (it.village === 'builderBase') continue;
    byName.set(it.name, { name: it.name, level: it.level });
  }
  return [...byName.values()];
}

/** Best partition of `builderCount` builders between heroes and buildings. */
function optimalBuilderSplit(
  buildingChains: number[],
  heroChains: number[],
  builderCount: number,
): { optimalHeroBuilders: number; optimalBuildingBuilders: number; optimalSec: number } {
  let optimalHeroBuilders = -1;
  let optimalSec = Infinity;
  if (builderCount >= 2) {
    for (let h = 1; h < builderCount; h++) {
      const b = builderCount - h;
      const sec = Math.max(scheduleChains(heroChains, h), scheduleChains(buildingChains, b));
      if (sec < optimalSec) {
        optimalSec = sec;
        optimalHeroBuilders = h;
      }
    }
  }
  return {
    optimalHeroBuilders,
    optimalBuildingBuilders: optimalHeroBuilders >= 0 ? builderCount - optimalHeroBuilders : -1,
    optimalSec: optimalHeroBuilders >= 0 ? optimalSec : 0,
  };
}

/** Lab-style items (troops/dark troops/sieges, spells/dark spells, pets) share one serial research building each. */
function buildSerialPipeline(
  key: PipelineKey,
  items: LeveledItem[],
  th: number,
  armyDetails: Record<string, TroopDetail | null>,
): PipelineResult {
  const superTroops = new Set(getSuperTroopNames());
  const rows: PipelineItemRow[] = [];
  for (const item of items) {
    if (item.village === 'builderBase') continue;
    if (key === 'lab' && superTroops.has(item.name)) continue;
    const maxLevel = getMaxLevelAtTH(item.name, th) ?? 0;
    if (maxLevel <= 0) continue;
    const ct = remainingArmyCosts(armyDetails[item.name], item.level, maxLevel);
    if (ct.time <= 0 && ct.cost <= 0) continue;
    rows.push(toRow(item.name, item.level, maxLevel, ct));
  }
  return aggregate(key, rows);
}

/** Buildings + heroes compete for the same builder pool. Each hero and each
 * building copy is a serial chain of upgrades, so chains are bin-packed onto
 * the available builders (LPT) and the makespan is the real "time to max".
 * A naive total/builderCount would undercount when a single long chain (e.g. a
 * 21-day hero) can't be split across builders. */
function buildBuildersPipeline(
  player: ClashPlayer,
  heroItems: LeveledItem[],
  th: number,
  builderCount: number,
  armyDetails: Record<string, TroopDetail | null>,
): PipelineResult {
  const rows: PipelineItemRow[] = [];
  const buildingChains: number[] = [];
  const heroChains: number[] = [];

  const cats = getBuildingCategories(th);
  for (const items of Object.values(cats)) {
    for (const [name, thData] of Object.entries(items)) {
      const entry = thData[String(th)];
      if (!entry || (entry.level ?? 0) <= 0) continue;
      const effectiveMax = getBuildingEffectiveMax(name, th);
      if (effectiveMax <= 0) continue;
      const count = getCountAtTH(name, th);
      const copies = getBuildingCopies(
        name,
        player.buildingLevels,
        player.buildings,
        effectiveMax,
        count,
        player.lastMaxedTH,
        th,
      );
      const ct = remainingBuildingCosts(name, copies.levels, effectiveMax);
      if (ct.time <= 0 && ct.cost <= 0) continue;
      const totalLevel = copies.levels.reduce((s, l) => s + l, 0);
      const copyLevel = copies.levels.length > 0 ? Math.max(...copies.levels) : 1;
      rows.push({ ...toRow(name, totalLevel, count * effectiveMax, ct), iconLevel: copyLevel });
      buildingChains.push(...buildingUpgradeChainTimes(name, copies.levels, effectiveMax));
    }
  }

  for (const hero of heroItems) {
    if (hero.village === 'builderBase') continue;
    const maxLevel = getMaxLevelAtTH(hero.name, th) ?? 0;
    if (maxLevel <= 0) continue;
    const ct = remainingArmyCosts(armyDetails[hero.name], hero.level, maxLevel);
    if (ct.time <= 0 && ct.cost <= 0) continue;
    rows.push(toRow(hero.name, hero.level, maxLevel, ct));
    if (ct.time > 0) heroChains.push(ct.time);
  }

  const chains = [...buildingChains, ...heroChains];
  const total = aggregate('builders', rows);
  const optimal = optimalBuilderSplit(buildingChains, heroChains, builderCount);
  const split: BuilderSplit = {
    buildingChains: buildingChains.length,
    heroChains: heroChains.length,
    buildingsOnlySec: scheduleChains(buildingChains, builderCount),
    heroesOnlySec: scheduleChains(heroChains, builderCount),
    buildingsSerialSec: buildingChains.reduce((a, b) => a + b, 0),
    heroesSerialSec: heroChains.reduce((a, b) => a + b, 0),
    ...optimal,
  };
  return { ...total, timeSec: scheduleChains(chains, builderCount), split };
}

/** Equipment upgrades are instant — they only consume Shiny/Glowing/Starry ore at the Blacksmith. */
function buildEquipmentPipeline(player: ClashPlayer, th: number): PipelineResult {
  const blacksmithMax = getBuildingMaxLevelAtTH('blacksmith', th) ?? 0;
  const rows: PipelineItemRow[] = [];
  for (const eq of player.heroEquipment ?? []) {
    if (eq.village === 'builderBase') continue;
    const item = getArmyItem(eq.name);
    if (!item || item.base === 'builder' || !item.levels?.length) continue;
    let maxLevel = 0;
    for (const lvl of item.levels) {
      const req = lvl.blacksmithLevelRequired ?? 0;
      if ((req === 0 || req <= blacksmithMax) && lvl.level > maxLevel) maxLevel = lvl.level;
    }
    if (maxLevel <= 0 || eq.level >= maxLevel) continue;
    const byResource: Record<string, number> = {};
    let cost = 0;
    for (const lvl of item.levels) {
      if (lvl.level <= eq.level || lvl.level > maxLevel) continue;
      const shiny = lvl.upgradeShinyOre ?? 0;
      const glowing = lvl.upgradeGlowingOre ?? 0;
      const starry = lvl.upgradeStarryOre ?? 0;
      if (shiny > 0) byResource['Shiny Ore'] = (byResource['Shiny Ore'] ?? 0) + shiny;
      if (glowing > 0) byResource['Glowing Ore'] = (byResource['Glowing Ore'] ?? 0) + glowing;
      if (starry > 0) byResource['Starry Ore'] = (byResource['Starry Ore'] ?? 0) + starry;
      cost += shiny + glowing + starry;
    }
    if (cost <= 0) continue;
    rows.push({ name: eq.name, currentLevel: eq.level, maxLevel, timeSec: 0, cost, byResource });
  }
  return aggregate('equipment', rows);
}

export function computeMaxTime(input: MaxTimeInput): MaxTimeResult {
  const { player, th, builderCount, armyDetails } = input;
  // Locked (not yet unlocked) troops/spells/heroes still count toward max: the
  // player must research and upgrade them too, so they start from level 0.
  const labItems = mergeLeveled(
    [...(player.troops ?? []), ...(player.spells ?? [])],
    lockedItemsAtTH(th, ['troop', 'spell']),
  );
  const heroItems = mergeLeveled(player.heroes ?? [], lockedItemsAtTH(th, ['hero']));
  const lab = buildSerialPipeline('lab', labItems, th, armyDetails);
  const pets = buildSerialPipeline('pets', player.pets ?? [], th, armyDetails);
  const builders = buildBuildersPipeline(player, heroItems, th, builderCount, armyDetails);
  const equipment = buildEquipmentPipeline(player, th);

  const totalTimeSec = Math.max(lab.timeSec, builders.timeSec, pets.timeSec, equipment.timeSec);
  const totalCost = lab.cost + builders.cost + pets.cost + equipment.cost;
  const totalByResource: Record<string, number> = {};
  for (const p of [lab, builders, pets, equipment]) {
    for (const [res, v] of Object.entries(p.byResource)) {
      totalByResource[res] = (totalByResource[res] ?? 0) + v;
    }
  }

  return {
    lab,
    builders,
    pets,
    equipment,
    totalTimeSec,
    totalCost,
    totalByResource,
    builderCount,
  };
}
