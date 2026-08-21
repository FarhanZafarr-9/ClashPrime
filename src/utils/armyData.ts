// Primary Army data source: clash-of-clans-data (canonical, package-maintained).

import { home, builder } from 'clash-of-clans-data';
import type { TroopDetail, TroopDetailLevel } from '../api/troopDetail';
import type { UnlockableType } from './thMaxLevels';
import { getTroopImageUrl, getHeroImageUrl, getPetImageUrl, getEquipmentImageUrl } from './troopImages';
import { PACKAGE_IMAGES } from '../data/packageImages';

export type { UnlockableType };

export type BuildingKey = 'laboratory' | 'heroHall' | 'blacksmith' | 'petHouse' | 'workshop';
export type CostResource =
  | 'Elixir'
  | 'Dark Elixir'
  | 'Builder Elixir'
  | 'Gold'
  | 'Shiny Ore'
  | 'Glowing Ore'
  | 'Starry Ore'
  | 'Unknown';

export interface ResourceMeta {
  label: string;
  short: string;
  color: string;
  icon: string;
}

export const RESOURCE_META: Record<CostResource, ResourceMeta> = {
  Elixir: { label: 'Elixir', short: 'Elixir', color: '#E84A9D', icon: '🧪' },
  'Dark Elixir': { label: 'Dark Elixir', short: 'DE', color: '#7C3AED', icon: '🌑' },
  'Builder Elixir': { label: 'Builder Elixir', short: 'B. Elixir', color: '#A855F7', icon: '🔧' },
  Gold: { label: 'Gold', short: 'Gold', color: '#E8B339', icon: '🪙' },
  'Shiny Ore': { label: 'Shiny Ore', short: 'Shiny', color: '#60A5FA', icon: '✨' },
  'Glowing Ore': { label: 'Glowing Ore', short: 'Glowy', color: '#A78BFA', icon: '💎' },
  'Starry Ore': { label: 'Starry Ore', short: 'Starry', color: '#FBBF24', icon: '⭐' },
  Unknown: { label: 'Unknown', short: '?', color: '#94A3B8', icon: '❓' },
};

// --- Package item shapes (subset we consume) ---

interface BuildTimeLike {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

interface PackageLevel {
  level: number;
  townHallRequired?: number;
  builderHallRequired?: number;
  builderHallLevelRequired?: number;
  heroHallLevelRequired?: number;
  starLabRequired?: number;
  laboratoryRequired?: number;
  petHouseLevelRequired?: number;
  blacksmithLevelRequired?: number;
  researchCost?: number;
  researchCostResource?: string;
  researchTime?: BuildTimeLike;
  upgradeCost?: number;
  upgradeCostResource?: string;
  upgradeTime?: BuildTimeLike;
  damagePerSecond?: number;
  damagePerHit?: number;
  damagePerShot?: number;
  damageVsWalls?: number;
  hitpoints?: number;
  damage?: number;
  dps?: number;
  unitsPerCamp?: number;
  rageDurationSeconds?: number;
  healthRecovery?: number;
  abilityLevel?: number;
  hpRecoveryIncrease?: number;
  upgradeShinyOre?: number;
  upgradeGlowingOre?: number;
  upgradeStarryOre?: number;
  stats?: Record<string, Record<string, number | string>>;
}

interface PackageItem {
  id: string;
  name: string;
  base: string;
  category: string;
  description?: string;
  housingSpace?: number;
  range?: number;
  attackSpeed?: number;
  movementSpeed?: number;
  damageType?: string;
  targetType?: string;
  preferredTarget?: string;
  spellType?: string;
  radius?: number;
  superTroop?: { name?: string };
  unlockRequirement?: string[];
  levels: PackageLevel[];
}

// --- Lazy loading (degrade gracefully to [] if the package fails to load) ---

let loaded = false;
let homeTroops: PackageItem[] = [];
let homeSpells: PackageItem[] = [];
let homePets: PackageItem[] = [];
let homeHeroes: PackageItem[] = [];
let homeEquipment: PackageItem[] = [];
let homeSiege: PackageItem[] = [];
let builderTroops: PackageItem[] = [];
let builderHeroes: PackageItem[] = [];

function safeLoad<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function getItems(getter: () => any): PackageItem[] {
  return safeLoad(() => (getter()?.get?.() ?? []) as PackageItem[], []);
}

function load(): void {
  if (loaded) return;
  loaded = true;
  homeTroops = getItems(() => home().troops());
  homeSpells = getItems(() => home().spells());
  homePets = getItems(() => home().pets());
  homeHeroes = getItems(() => home().heroes());
  homeEquipment = getItems(() => home().heroEquipment());
  homeSiege = getItems(() => home().siegeMachines());
  builderTroops = getItems(() => builder().troops());
  builderHeroes = getItems(() => builder().heroes());
}

let byNameIndex: Map<string, PackageItem[]> | null = null;

function indexItems(): void {
  load();
  if (byNameIndex) return;
  const map = new Map<string, PackageItem[]>();
  const push = (i: PackageItem) => {
    const arr = map.get(i.name);
    if (arr) arr.push(i);
    else map.set(i.name, [i]);
  };
  for (const list of [
    homeTroops,
    homeSpells,
    homePets,
    homeHeroes,
    homeEquipment,
    homeSiege,
    builderTroops,
    builderHeroes,
  ]) {
    for (const item of list) push(item);
  }
  byNameIndex = map;
}

/** Resolve a package item by display name. Pass builderBase=true to prefer the Builder Base copy when a name collides (e.g. "Baby Dragon"). */
export function getArmyItem(name: string, builderBase = false): PackageItem | null {
  indexItems();
  const matches = byNameIndex?.get(name);
  if (!matches || matches.length === 0) return null;
  if (builderBase) {
    const bb = matches.find((i) => i.base === 'builder');
    if (bb) return bb;
  }
  return matches[0];
}

// --- Max levels ---

function maxLevelUnderCap(levels: PackageLevel[], capKey: keyof PackageLevel, cap: number): number {
  let max = 0;
  for (const lvl of levels) {
    const req = lvl[capKey];
    if ((req == null || (typeof req === 'number' && req <= cap)) && lvl.level > max) max = lvl.level;
  }
  return max;
}

/**
 * Max level where BOTH the item's own Town Hall requirement and its research
 * building requirement (lab / pet house) are met. `buildingKey` is the
 * per-level building gate and `buildingMax` the max level of that building at
 * this Town Hall; a building requirement of 0 means the base level needs no
 * research and only the Town Hall gate applies.
 */
function maxLevelWithBuildingAndTH(
  levels: PackageLevel[],
  buildingKey: keyof PackageLevel,
  buildingMax: number,
  th: number,
): number {
  let max = 0;
  for (const lvl of levels) {
    const thReq = lvl.townHallRequired;
    if (thReq != null && thReq > th) continue;
    const bReq = (lvl[buildingKey] as number | undefined) ?? 0;
    const bOk = bReq === 0 || bReq <= buildingMax;
    if (bOk && lvl.level > max) max = lvl.level;
  }
  return max;
}

const buildingMaxCache = new Map<string, number>();

/** Max level of a home-base gating building at the given Town Hall. */
export function getBuildingMaxLevelAtTH(building: BuildingKey, th: number): number | null {
  const cacheKey = `${building}:${th}`;
  if (buildingMaxCache.has(cacheKey)) {
    const cached = buildingMaxCache.get(cacheKey)!;
    return cached > 0 ? cached : null;
  }
  const item = safeLoad(() => ((home().armyBuildings() as any)[building]()?.get?.() as PackageItem[] | undefined)?.[0], undefined);
  let result: number | null = null;
  if (item?.levels?.length) {
    const max = maxLevelUnderCap(item.levels, 'townHallRequired', th);
    result = max > 0 ? max : null;
  }
  buildingMaxCache.set(cacheKey, result ?? -1);
  return result;
}

/**
 * Max level of an army item reachable at a given Town Hall. Research items are
 * gated by the item's own Town Hall requirement AND the max Laboratory level
 * reachable at that TH (not the player's actual Lab); heroes by the max Hero
 * Hall; pets by the max Pet House. Falls back to townHallRequired where the
 * package carries no building gate.
 */
export function getMaxLevelAtTH(name: string, thLevel: number): number | null {
  indexItems();
  const item = getArmyItem(name);
  if (!item || item.base === 'builder') return null;
  let max = 0;
  if (item.category === 'hero') {
    const hhMax = getBuildingMaxLevelAtTH('heroHall', thLevel);
    if (hhMax == null) return null;
    max = maxLevelUnderCap(item.levels, 'heroHallLevelRequired', hhMax);
  } else if (item.category === 'pet') {
    const phMax = getBuildingMaxLevelAtTH('petHouse', thLevel);
    max = phMax != null ? maxLevelWithBuildingAndTH(item.levels, 'petHouseLevelRequired', phMax, thLevel) : 0;
    if (max <= 0) max = maxLevelUnderCap(item.levels, 'townHallRequired', thLevel);
  } else {
    const labMax = getBuildingMaxLevelAtTH('laboratory', thLevel);
    max = labMax != null ? maxLevelWithBuildingAndTH(item.levels, 'laboratoryRequired', labMax, thLevel) : 0;
    if (max <= 0) max = maxLevelUnderCap(item.levels, 'townHallRequired', thLevel);
  }
  return max > 0 ? max : null;
}

/** Max level of a Builder Base troop at a given Builder Hall (Star Lab gating). */
export function getBuilderTroopMaxLevel(name: string, bh: number): number | null {
  indexItems();
  const item = getArmyItem(name, true);
  if (!item || item.base !== 'builder' || item.category !== 'troop') return null;
  const starLab = safeLoad(() => ((builder().armyBuildings() as any).starLaboratory()?.get?.() as PackageItem[] | undefined)?.[0], undefined);
  const starLabMax = starLab?.levels?.length ? maxLevelUnderCap(starLab.levels, 'builderHallRequired', bh) : 0;
  if (starLabMax <= 0) return null;
  const max = maxLevelUnderCap(item.levels, 'starLabRequired', starLabMax);
  return max > 0 ? max : null;
}

/** All home troops/spells/heroes unlockable at a Town Hall, for "locked" lists. */
export function getAllItemsAtTH(th: number): { name: string; type: UnlockableType; maxLevel: number }[] {
  indexItems();
  const result: { name: string; type: UnlockableType; maxLevel: number }[] = [];
  const seen = new Set<string>();
  const addItem = (item: PackageItem, type: UnlockableType) => {
    if (item.base !== 'home' || seen.has(item.name)) return;
    const maxLevel = getMaxLevelAtTH(item.name, th);
    if (maxLevel != null && maxLevel > 0) {
      result.push({ name: item.name, type, maxLevel });
      seen.add(item.name);
    }
  };
  for (const item of homeTroops) addItem(item, 'troop');
  for (const item of homeSpells) addItem(item, 'spell');
  for (const item of homeHeroes) addItem(item, 'hero');
  for (const item of homeSiege) addItem(item, 'siege');
  return result;
}

// --- Name sets (replaces the Fandom useGameData calls) ---

let nameSets: { siege: string[]; pets: string[]; superTroops: string[] } | null = null;

export function getArmyNameSets(): { siege: string[]; pets: string[]; superTroops: string[] } {
  load();
  if (nameSets) return nameSets;
  const superTroops: string[] = [];
  for (const t of homeTroops) if (t.superTroop?.name) superTroops.push(t.superTroop.name);
  nameSets = {
    siege: homeSiege.map((i) => i.name),
    pets: homePets.map((i) => i.name),
    superTroops,
  };
  return nameSets;
}

export function getSiegeMachineNames(): string[] {
  return getArmyNameSets().siege;
}

export function getPetNames(): string[] {
  return getArmyNameSets().pets;
}

export function getSuperTroopNames(): string[] {
  return getArmyNameSets().superTroops;
}

/**
 * Bundled package image (require'd asset) for an army item. Returns the
 * level-specific sprite when `level` matches one, otherwise the item icon.
 * Returns null when the package ships no image (callers keep the network fallback).
 */
export function getArmyItemImage(name: string, level?: number | null): number | null {
  const entry = PACKAGE_IMAGES[name];
  if (!entry) return null;
  if (level != null) {
    const sprite = entry.levels[String(level)];
    if (sprite) return sprite;
  }
  return entry.icon || null;
}

// --- Cost/time formatting ---

export function formatCost(n: number): string {
  if (!n || n <= 0) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function formatTime(t?: BuildTimeLike): string {
  if (!t) return '—';
  const days = t.days ?? 0;
  const hours = t.hours ?? 0;
  const minutes = t.minutes ?? 0;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

// --- Detail panels ---

const STAT_LABELS: Record<string, string> = {
  dps: 'DPS',
  damagePerSecond: 'DPS',
  damagePerShot: 'Damage per Shot',
  damagePerHit: 'Damage per Hit',
  healingPerSecond: 'Healing per Second',
  healingPerPulse: 'Healing per Pulse',
  healingPerSecondOnHeroes: 'Heal/Sec on Heroes',
  healingPerPulseOnHeroes: 'Heal/Pulse on Heroes',
  damageVsWalls: 'DPS vs Walls',
  abilityDuration: 'Ability Duration',
  incomingDamageReduction: 'Damage Reduction',
  selfHealingPerSecond: 'Self Heal/Sec',
};

function titleCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function statLabel(key: string): string {
  return STAT_LABELS[key] ?? titleCase(key);
}

function buildDetailFromPackage(item: PackageItem): TroopDetail {
  const name = item.name;
  const isBuilder = item.base === 'builder';
  const isEquipment = item.category === 'hero-equipment';
  const isSpell = item.category === 'spell';
  const isSiege = item.category === 'siege-machine';
  const isHero = item.category === 'hero';

  const levels: TroopDetailLevel[] = item.levels.map((lvl) => {
    const common: TroopDetailLevel = {
      level: lvl.level,
      dps: 0,
      damagePerHit: 0,
      hitpoints: lvl.hitpoints ?? 0,
      upgradeCost: '—',
      upgradeTime: '—',
      xp: 0,
      labLevel: null,
      thRequired: null,
    };

    const extra: { label: string; value: string }[] = [];

    if (isEquipment) {
      const shiny = lvl.upgradeShinyOre ?? 0;
      const glowing = lvl.upgradeGlowingOre ?? 0;
      const starry = lvl.upgradeStarryOre ?? 0;
      common.upgradeCost = shiny > 0 ? formatCost(shiny) : '—';
      common.costResource = 'Shiny Ore';
      common.costAmount = shiny;
      const costs: { resource: string; amount: number }[] = [];
      if (shiny > 0) costs.push({ resource: 'Shiny Ore', amount: shiny });
      if (glowing > 0) costs.push({ resource: 'Glowing Ore', amount: glowing });
      if (starry > 0) costs.push({ resource: 'Starry Ore', amount: starry });
      common.costs = costs.length > 0 ? costs : undefined;
      if (glowing > 0) {
        extra.push({ label: 'Glowing Ore', value: formatCost(glowing) });
      }
      if (starry > 0) {
        extra.push({ label: 'Starry Ore', value: formatCost(starry) });
      }
      if ((lvl.hpRecoveryIncrease ?? 0) > 0) {
        extra.push({ label: 'HP Recovery', value: String(lvl.hpRecoveryIncrease) });
      }
      for (const [k, v] of Object.entries(lvl.stats ?? {})) {
        if (v != null && String(v) !== '') extra.push({ label: statLabel(k), value: String(v) });
      }
    } else {
      const cost = lvl.researchCost ?? lvl.upgradeCost;
      if (cost != null && cost > 0) {
        common.upgradeCost = formatCost(cost);
        common.costAmount = cost;
        common.costResource = lvl.researchCostResource ?? lvl.upgradeCostResource ?? 'Unknown';
      }
      const time = lvl.researchTime ?? lvl.upgradeTime;
      if (time) common.upgradeTime = formatTime(time);
    }

    if (isBuilder) {
      common.labLevel = lvl.starLabRequired ?? null;
      common.thRequired = lvl.builderHallLevelRequired ?? null;
    } else {
      common.labLevel =
        lvl.laboratoryRequired ??
        lvl.petHouseLevelRequired ??
        lvl.heroHallLevelRequired ??
        lvl.blacksmithLevelRequired ??
        null;
      common.thRequired = lvl.townHallRequired ?? null;
    }

    if (isSpell) {
      if (lvl.damage != null) extra.push({ label: 'Damage', value: String(lvl.damage) });
    } else if (isSiege) {
      common.dps = lvl.damagePerSecond ?? 0;
      common.damagePerHit = lvl.damagePerHit ?? 0;
      if ((lvl.damageVsWalls ?? 0) > 0) extra.push({ label: 'DPS vs Walls', value: String(lvl.damageVsWalls) });
    } else if (isHero) {
      common.dps = lvl.damagePerSecond ?? 0;
      common.damagePerHit = lvl.damagePerHit ?? 0;
      if ((lvl.healthRecovery ?? 0) > 0) extra.push({ label: 'Health Recovery', value: String(lvl.healthRecovery) });
      if (lvl.abilityLevel != null) extra.push({ label: 'Ability Level', value: String(lvl.abilityLevel) });
    } else if (isBuilder) {
      common.dps = lvl.dps ?? 0;
      common.damagePerHit = lvl.damagePerShot ?? 0;
      if ((lvl.unitsPerCamp ?? 0) > 0) extra.push({ label: 'Units per Camp', value: String(lvl.unitsPerCamp) });
      if ((lvl.rageDurationSeconds ?? 0) > 0) {
        extra.push({ label: 'Rage Duration', value: `${lvl.rageDurationSeconds}s` });
      }
    } else {
      const stats = lvl.stats ?? {};
      const n = stats.normal ?? {};
      common.dps = (n.dps as number) ?? (n.damagePerSecond as number) ?? 0;
      common.damagePerHit = (n.damagePerShot as number) ?? (n.damagePerHit as number) ?? 0;
      for (const mode of Object.keys(stats)) {
        const prefix = mode === 'normal' ? '' : `${mode} `;
        for (const [k, v] of Object.entries(stats[mode] ?? {})) {
          if (mode === 'normal' && ['dps', 'damagePerSecond', 'damagePerShot', 'damagePerHit'].includes(k)) continue;
          if (v == null || String(v) === '') continue;
          extra.push({ label: prefix + statLabel(k), value: String(v) });
        }
      }
    }

    if (extra.length) common.extra = extra;
    return common;
  });

  const info: TroopDetail['info'] = {
    range: item.range != null ? `${item.range} tiles` : '',
    housingSpace: item.housingSpace ?? 0,
    attackSpeed: item.attackSpeed != null ? `${item.attackSpeed} seconds` : '',
    damageType: item.damageType ?? '',
    targetType: item.targetType ?? '',
    favoriteTarget: item.preferredTarget ?? '',
  };

  const infoPairs: { label: string; value: string }[] = [];
  if (isEquipment && Array.isArray(item.unlockRequirement) && item.unlockRequirement.length > 0) {
    infoPairs.push({ label: 'Unlock Requirement', value: item.unlockRequirement.join(' ') });
  }
  if (isSpell) {
    if (item.spellType) infoPairs.push({ label: 'Spell Type', value: item.spellType });
    if (item.radius != null) infoPairs.push({ label: 'Radius', value: `${item.radius} tiles` });
    if (item.housingSpace != null) infoPairs.push({ label: 'Housing Space', value: String(item.housingSpace) });
  }
  if (isHero && !isBuilder) {
    const minHall = Math.min(...item.levels.filter((l) => l.heroHallLevelRequired != null).map((l) => l.heroHallLevelRequired!));
    if (isFinite(minHall)) infoPairs.push({ label: 'Unlock Requirement', value: `Upgrade the Hero Hall to Level ${minHall}` });
  }

  return {
    name,
    slug: item.id ?? name.replace(/\s+/g, '-').toLowerCase(),
    description: item.description ?? '',
    imageUrl:
      getHeroImageUrl(name) ||
      getPetImageUrl(name) ||
      getEquipmentImageUrl(name) ||
      getTroopImageUrl(name) ||
      '',
    levels,
    info,
    infoPairs: infoPairs.length ? infoPairs : undefined,
  };
}

/**
 * Detail panel data for an army item. Package data is the only source; items
 * the package does not carry yet return null (they appear once the package is
 * updated).
 */
export async function getArmyTroopDetail(
  name: string,
  opts: { builderBase?: boolean } = {},
): Promise<TroopDetail | null> {
  indexItems();
  const item = getArmyItem(name, opts.builderBase);
  if (!item || item.levels.length === 0) return null;
  const detail = buildDetailFromPackage(item);
  return detail.levels.length > 0 ? detail : null;
}

// --- Resource-aware summations ---

export interface ResourceSum {
  resource: CostResource;
  amount: number;
}

/**
 * Sum remaining upgrade costs grouped by resource type, between currentLevel
 * (exclusive) and maxLevel (inclusive). Reuses the same level-cost metadata the
 * detail tables display, so per-resource totals never need string parsing.
 */
export function sumLevelCostsByResource(
  levels: TroopDetailLevel[],
  currentLevel: number,
  maxLevel: number | null | undefined,
): ResourceSum[] {
  const byRes = new Map<CostResource, number>();
  for (const l of levels) {
    if (l.level <= currentLevel) continue;
    if (maxLevel != null && l.level > maxLevel) continue;
    if (l.costs && l.costs.length > 0) {
      for (const c of l.costs) {
        if (c.amount <= 0) continue;
        const res = c.resource as CostResource;
        byRes.set(res, (byRes.get(res) ?? 0) + c.amount);
      }
      continue;
    }
    const amount = l.costAmount ?? 0;
    if (amount <= 0) continue;
    const res = (l.costResource as CostResource) ?? 'Unknown';
    byRes.set(res, (byRes.get(res) ?? 0) + amount);
  }
  return [...byRes.entries()]
    .map(([resource, amount]) => ({ resource, amount }))
    .sort((a, b) => b.amount - a.amount);
}
