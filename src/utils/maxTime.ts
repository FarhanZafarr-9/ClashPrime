import type { ClashPlayer } from '../types/clash';
import type { TroopDetail } from '../api/troopDetail';
import {
  getMaxLevelAtTH,
  getSuperTroopNames,
  getArmyItem,
  getBuildingMaxLevelAtTH,
  getAllItemsAtTH,
  getBuilderHeroMaxLevel,
  getBuilderTroopMaxLevel,
  getAllBuilderItemsAtBH,
} from './armyData';
import { getBuildingEffectiveMax } from './buildingImages';
import { getBuildingCopies, getCountAtTH, getCountAtBH } from './buildingCopies';
import { getBuildingCategories, getBBCategories, getBuildingMaxLevelAtBH } from './buildingData';
import {
  isArmyExcluded,
  isBuildingExcluded,
  isPipelineGated,
  type ArmyPipeline,
} from './exclusions';
import {
  remainingArmyCosts,
  remainingBuildingCosts,
  sumCosts,
  buildingUpgradeChainTimes,
  scheduleChains,
  type CostTime,
} from './upgradeCosts';

export type PipelineKey = 'lab' | 'builders' | 'pets' | 'equipment' | 'bb-builders' | 'bb-lab';

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
  /**
   * True when the pipeline is skipped wholesale because its gating building
   * (Laboratory, Pet House, Blacksmith, Star Laboratory) is excluded.
   */
  gated?: boolean;
}

export interface MaxTimeInput {
  player: ClashPlayer;
  th: number;
  builderCount: number;
  /** Pre-fetched package details keyed by display name (armyData.getArmyTroopDetail). */
  armyDetails: Record<string, TroopDetail | null>;
  /**
   * Exclusions from the Time to Max screen, keyed by building display name or by
   * `exclusions.armyKey(name)` for a single troop, spell, siege, hero, pet or
   * piece of equipment. Excluding a gating building drops its whole pipeline.
   */
  excludedBuildings?: ReadonlySet<string>;
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
  excludedBuildings?: ReadonlySet<string>,
): PipelineResult {
  const superTroops = new Set(getSuperTroopNames());
  const rows: PipelineItemRow[] = [];
  for (const item of items) {
    if (item.village === 'builderBase') continue;
    if (key === 'lab' && superTroops.has(item.name)) continue;
    if (isArmyExcluded(excludedBuildings, item.name)) continue;
    const maxLevel = getMaxLevelAtTH(item.name, th) ?? 0;
    if (maxLevel <= 0) continue;
    const ct = remainingArmyCosts(armyDetails[item.name], item.level, maxLevel);
    if (ct.time <= 0 && ct.cost <= 0) continue;
    rows.push(toRow(item.name, item.level, maxLevel, ct));
  }
  return aggregate(key, rows);
}

/** An empty pipeline, used when the building that runs it is excluded. */
function gatedPipeline(key: PipelineKey): PipelineResult {
  return { ...aggregate(key, []), gated: true };
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
  excludedBuildings?: ReadonlySet<string>,
): PipelineResult {
  const rows: PipelineItemRow[] = [];
  const buildingChains: number[] = [];
  const heroChains: number[] = [];
  // Hero upgrades need the Hero Hall, so excluding it takes the whole hero chain
  // out of the builder pool.
  const heroesGated = isPipelineGated(excludedBuildings, 'heroes');

  const cats = getBuildingCategories(th);
  for (const items of Object.values(cats)) {
    for (const [name, thData] of Object.entries(items)) {
      if (isBuildingExcluded(excludedBuildings, name)) continue;
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

  for (const hero of heroesGated ? [] : heroItems) {
    if (hero.village === 'builderBase') continue;
    if (isArmyExcluded(excludedBuildings, hero.name)) continue;
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
function buildEquipmentPipeline(
  player: ClashPlayer,
  th: number,
  excludedBuildings?: ReadonlySet<string>,
): PipelineResult {
  const blacksmithMax = getBuildingMaxLevelAtTH('blacksmith', th) ?? 0;
  const rows: PipelineItemRow[] = [];
  for (const eq of player.heroEquipment ?? []) {
    if (eq.village === 'builderBase') continue;
    if (isArmyExcluded(excludedBuildings, eq.name)) continue;
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

/** Max equipment level the Blacksmith can reach at this TH (0 when locked). */
function equipmentMaxLevel(name: string, blacksmithMax: number): number {
  const item = getArmyItem(name);
  if (!item || item.base === 'builder' || !item.levels?.length) return 0;
  let maxLevel = 0;
  for (const lvl of item.levels) {
    const req = lvl.blacksmithLevelRequired ?? 0;
    if ((req === 0 || req <= blacksmithMax) && lvl.level > maxLevel) maxLevel = lvl.level;
  }
  return maxLevel;
}

export function computeMaxTime(input: MaxTimeInput): MaxTimeResult {
  const { player, th, builderCount, armyDetails, excludedBuildings } = input;
  // Locked (not yet unlocked) troops/spells/heroes still count toward max: the
  // player must research and upgrade them too, so they start from level 0.
  const labItems = mergeLeveled(
    [...(player.troops ?? []), ...(player.spells ?? [])],
    lockedItemsAtTH(th, ['troop', 'spell']),
  );
  const heroItems = mergeLeveled(player.heroes ?? [], lockedItemsAtTH(th, ['hero']));
  // Each research pipeline is gated by one building: excluding that building
  // drops the pipeline rather than just its own upgrade chain.
  const lab = isPipelineGated(excludedBuildings, 'lab')
    ? gatedPipeline('lab')
    : buildSerialPipeline('lab', labItems, th, armyDetails, excludedBuildings);
  const pets = isPipelineGated(excludedBuildings, 'pets')
    ? gatedPipeline('pets')
    : buildSerialPipeline('pets', player.pets ?? [], th, armyDetails, excludedBuildings);
  const builders = buildBuildersPipeline(player, heroItems, th, builderCount, armyDetails, excludedBuildings);
  const equipment = isPipelineGated(excludedBuildings, 'equipment')
    ? gatedPipeline('equipment')
    : buildEquipmentPipeline(player, th, excludedBuildings);

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

// --- Builder Base ---

export interface BuilderBaseMaxTimeInput {
  player: ClashPlayer;
  /** Builder Hall level the plan targets. */
  bh: number;
  /** Number of Builder Base builder heads (1–3). */
  builderCount: number;
  /** Pre-fetched package details keyed by display name (armyData.getArmyTroopDetail with builderBase). */
  armyDetails: Record<string, TroopDetail | null>;
  /**
   * Same exclusion set as the Home Village (`MaxTimeInput.excludedBuildings`):
   * Builder Base display names ("BB Cannon", "Star Laboratory") never collide
   * with Home ones, so one list covers both villages.
   */
  excludedBuildings?: ReadonlySet<string>;
}

export interface BuilderBaseMaxTimeResult {
  /** BB buildings + heroes scheduled across the BB builder heads. */
  bbBuilders: PipelineResult;
  /** BB troops researched serially at the Star Laboratory. */
  bbLab: PipelineResult;
  /** Pipelines run in parallel, so the headline number is the longest one. */
  totalTimeSec: number;
  totalCost: number;
  totalByResource: Record<string, number>;
  builderCount: number;
}

/** Locked (not yet unlocked) Builder Base troops/heroes at this BH, from level 0. */
function lockedBuilderItems(bh: number, types: ('troop' | 'hero')[]): LeveledItem[] {
  return getAllBuilderItemsAtBH(bh)
    .filter((i) => types.includes(i.type))
    .map((i) => ({ name: i.name, level: 0 }));
}

/** Merge player-owned Builder Base items (real level) over the locked set (level 0). */
function mergeBuilderLeveled(playerItems: LeveledItem[], locked: LeveledItem[]): LeveledItem[] {
  const byName = new Map<string, LeveledItem>();
  for (const it of locked) byName.set(it.name, it);
  for (const it of playerItems) {
    if (it.village !== 'builderBase') continue;
    byName.set(it.name, { name: it.name, level: it.level });
  }
  return [...byName.values()];
}

/** BB buildings + heroes compete for the same builder pool (bin-packed chains). */
function buildBBBuildersPipeline(
  player: ClashPlayer,
  heroItems: LeveledItem[],
  bh: number,
  builderCount: number,
  armyDetails: Record<string, TroopDetail | null>,
  excludedBuildings?: ReadonlySet<string>,
): PipelineResult {
  const rows: PipelineItemRow[] = [];
  const buildingChains: number[] = [];
  const heroChains: number[] = [];
  // Builder Base hero upgrades need the Builder Barracks.
  const heroesGated = isPipelineGated(excludedBuildings, 'bb-heroes');

  const cats = getBBCategories(bh);
  for (const items of Object.values(cats)) {
    for (const [name, bhData] of Object.entries(items)) {
      if (isBuildingExcluded(excludedBuildings, name)) continue;
      const entry = bhData[String(bh)];
      if (!entry || (entry.level ?? 0) <= 0) continue;
      const effectiveMax = getBuildingMaxLevelAtBH(name, bh) ?? 0;
      if (effectiveMax <= 0) continue;
      const count = getCountAtBH(name, bh);
      const copies = getBuildingCopies(name, player.buildingLevels, player.buildings, effectiveMax, count, undefined);
      const ct = remainingBuildingCosts(name, copies.levels, effectiveMax);
      if (ct.time <= 0 && ct.cost <= 0) continue;
      const totalLevel = copies.levels.reduce((s, l) => s + l, 0);
      const copyLevel = copies.levels.length > 0 ? Math.max(...copies.levels) : 1;
      rows.push({ ...toRow(name, totalLevel, count * effectiveMax, ct), iconLevel: copyLevel });
      buildingChains.push(...buildingUpgradeChainTimes(name, copies.levels, effectiveMax));
    }
  }

  for (const hero of heroesGated ? [] : heroItems) {
    if (isArmyExcluded(excludedBuildings, hero.name)) continue;
    const maxLevel = getBuilderHeroMaxLevel(hero.name, bh) ?? 0;
    if (maxLevel <= 0) continue;
    const ct = remainingArmyCosts(armyDetails[hero.name], hero.level, maxLevel);
    if (ct.time <= 0 && ct.cost <= 0) continue;
    rows.push(toRow(hero.name, hero.level, maxLevel, ct));
    if (ct.time > 0) heroChains.push(ct.time);
  }

  const chains = [...buildingChains, ...heroChains];
  const total = aggregate('bb-builders', rows);
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

/** BB troops share one serial research building (the Star Laboratory). */
function buildBBLabPipeline(
  troopItems: LeveledItem[],
  bh: number,
  armyDetails: Record<string, TroopDetail | null>,
  excludedBuildings?: ReadonlySet<string>,
): PipelineResult {
  const rows: PipelineItemRow[] = [];
  for (const item of troopItems) {
    if (isArmyExcluded(excludedBuildings, item.name)) continue;
    const maxLevel = getBuilderTroopMaxLevel(item.name, bh) ?? 0;
    if (maxLevel <= 0) continue;
    const ct = remainingArmyCosts(armyDetails[item.name], item.level, maxLevel);
    if (ct.time <= 0 && ct.cost <= 0) continue;
    rows.push(toRow(item.name, item.level, maxLevel, ct));
  }
  return aggregate('bb-lab', rows);
}

export function computeBuilderBaseMaxTime(input: BuilderBaseMaxTimeInput): BuilderBaseMaxTimeResult {
  const { player, bh, builderCount, armyDetails, excludedBuildings } = input;
  const heroItems = mergeBuilderLeveled(player.heroes ?? [], lockedBuilderItems(bh, ['hero']));
  const troopItems = mergeBuilderLeveled(player.troops ?? [], lockedBuilderItems(bh, ['troop']));
  const bbBuilders = buildBBBuildersPipeline(player, heroItems, bh, builderCount, armyDetails, excludedBuildings);
  const bbLab = isPipelineGated(excludedBuildings, 'bb-lab')
    ? gatedPipeline('bb-lab')
    : buildBBLabPipeline(troopItems, bh, armyDetails, excludedBuildings);

  const totalTimeSec = Math.max(bbBuilders.timeSec, bbLab.timeSec);
  const totalCost = bbBuilders.cost + bbLab.cost;
  const totalByResource: Record<string, number> = {};
  for (const p of [bbBuilders, bbLab]) {
    for (const [res, v] of Object.entries(p.byResource)) {
      totalByResource[res] = (totalByResource[res] ?? 0) + v;
    }
  }

  return {
    bbBuilders,
    bbLab,
    totalTimeSec,
    totalCost,
    totalByResource,
    builderCount,
  };
}

// --- Exclusion listing ---

export interface ExcludableArmyItem {
  name: string;
  /** The pipeline this item's upgrades belong to. */
  pipeline: ArmyPipeline;
  currentLevel: number;
  maxLevel: number;
}

export interface ExcludableArmyInput {
  player: ClashPlayer;
  village: 'home' | 'builder';
  /** Home Village Town Hall level (ignored for the Builder Base). */
  th: number;
  /** Builder Hall level (ignored for the Home Village). */
  bh: number;
}

/**
 * Army items still waiting on research or an upgrade, so the screen can offer a
 * per-item exclusion for every pipeline. Deliberately computed *without* the
 * exclusion set: excluding a gating building empties its pipeline, but the items
 * must stay listable so the exclusion can be undone from the same screen.
 * Fully-maxed items are left out — there is nothing left to skip.
 */
export function listExcludableArmyItems(input: ExcludableArmyInput): ExcludableArmyItem[] {
  const { player, village, th, bh } = input;
  const rows: ExcludableArmyItem[] = [];
  const push = (pipeline: ArmyPipeline, name: string, currentLevel: number, maxLevel: number | null) => {
    if (maxLevel == null || maxLevel <= 0) return;
    if (currentLevel >= maxLevel) return;
    rows.push({ name, pipeline, currentLevel: Math.max(0, currentLevel), maxLevel });
  };

  if (village === 'home') {
    const superTroops = new Set(getSuperTroopNames());
    const labItems = mergeLeveled(
      [...(player.troops ?? []), ...(player.spells ?? [])],
      lockedItemsAtTH(th, ['troop', 'spell']),
    );
    for (const item of labItems) {
      if (item.village === 'builderBase' || superTroops.has(item.name)) continue;
      push('lab', item.name, item.level, getMaxLevelAtTH(item.name, th));
    }
    for (const hero of mergeLeveled(player.heroes ?? [], lockedItemsAtTH(th, ['hero']))) {
      if (hero.village === 'builderBase') continue;
      push('heroes', hero.name, hero.level, getMaxLevelAtTH(hero.name, th));
    }
    for (const pet of player.pets ?? []) {
      if (pet.village === 'builderBase') continue;
      push('pets', pet.name, pet.level, getMaxLevelAtTH(pet.name, th));
    }
    const blacksmithMax = getBuildingMaxLevelAtTH('blacksmith', th) ?? 0;
    for (const eq of player.heroEquipment ?? []) {
      if (eq.village === 'builderBase') continue;
      push('equipment', eq.name, eq.level, equipmentMaxLevel(eq.name, blacksmithMax));
    }
    return rows;
  }

  for (const troop of mergeBuilderLeveled(player.troops ?? [], lockedBuilderItems(bh, ['troop']))) {
    push('bb-lab', troop.name, troop.level, getBuilderTroopMaxLevel(troop.name, bh));
  }
  for (const hero of mergeBuilderLeveled(player.heroes ?? [], lockedBuilderItems(bh, ['hero']))) {
    push('bb-heroes', hero.name, hero.level, getBuilderHeroMaxLevel(hero.name, bh));
  }
  return rows;
}
