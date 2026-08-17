// Primary Buildings data source: clash-of-clans-data (canonical, package-maintained).
// Provides max levels, copy counts, per-level stats/costs and bundled images for
// every Home Village and Builder Base building shown in the Buildings tab.

import { home, builder } from 'clash-of-clans-data';
import { PACKAGE_IMAGES, PACKAGE_BUILDER_IMAGES } from '../data/packageImages';

// --- Display-name ↔ package-name mapping ---
//
// The app stores/keys buildings by its own display names ("Lab", "Walls",
// "Builder Hut", "BB Cannon", ...). The package uses canonical names
// ("Laboratory", "Wall", "Builder's Hut", "Cannon", ...). Map between them so
// existing saved state and UI labels stay stable.

const HOME_NAME_FIX: Record<string, string> = {
  'Lab': 'Laboratory',
  'Walls': 'Wall',
  'Builder Hut': "Builder's Hut",
};

const BB_NAME_FIX: Record<string, string> = {
  'BB Cannon': 'Cannon',
  'BB Archer Tower': 'Archer Tower',
  'BB Hidden Tesla': 'Hidden Tesla',
  'BB Air Bombs': 'Air Bombs',
  'BB Roaster': 'Roaster',
  'BB Lava Launcher': 'Lava Launcher',
  'BB X-Bow': 'X-Bow',
  'BB Walls': 'Wall',
  'BB Spring Trap': 'Spring Trap',
  'BB Gold Mine': 'Gold Mine',
  'BB Elixir Collector': 'Elixir Collector',
  'BB Gold Storage': 'Gold Storage',
  'BB Elixir Storage': 'Elixir Storage',
  'BB Army Camp': 'Army Camp',
};

/** Resolve a display (store) name to its package name. Identity when unmapped. */
export function toPackageName(name: string): string {
  return HOME_NAME_FIX[name] ?? BB_NAME_FIX[name] ?? name;
}

/** True when the name is a Builder Base building display name. */
export function isBuilderName(name: string): boolean {
  return name.startsWith('BB ') || BB_BUILDINGS.includes(name);
}

// --- Building manifests (category grouping, keeps the exact set the app shows) ---

export const HOME_CATEGORIES: Record<string, string[]> = {
  Defenses: [
    'Cannon', 'Archer Tower', 'Mortar', 'Air Defense', 'Wizard Tower', 'Air Sweeper',
    'Hidden Tesla', 'Bomb Tower', 'X-Bow', 'Inferno Tower', 'Eagle Artillery',
    'Scattershot', 'Builder Hut', 'Monolith', 'Spell Tower', 'Multi-Archer Tower',
    'Ricochet Cannon', 'Firespitter', 'Multi-Gear Tower', 'Revenge Tower', 'Super Wizard Tower',
  ],
  Resources: [
    'Gold Mine', 'Elixir Collector', 'Gold Storage', 'Elixir Storage',
    'Dark Elixir Drill', 'Dark Elixir Storage', 'Helper Hut',
  ],
  Army: [
    'Army Camp', 'Barracks', 'Clan Castle', 'Lab', 'Hero Hall', 'Spell Factory',
    'Dark Barracks', 'Dark Spell Factory', 'Blacksmith', 'Workshop', 'Pet House',
  ],
  Traps: [
    'Bomb', 'Spring Trap', 'Air Bomb', 'Giant Bomb', 'Seeking Air Mine',
    'Skeleton Trap', 'Tornado Trap', 'Giga Bomb',
  ],
  Walls: ['Walls'],
};

export const BB_BUILDINGS: string[] = [
  'BB Cannon', 'Double Cannon', 'BB Archer Tower', 'BB Hidden Tesla', 'Firecrackers',
  'Crusher', 'Guard Post', 'BB Air Bombs', 'Multi Mortar', "O.T.T.O's Outpost",
  'BB Roaster', 'Giant Cannon', 'Mega Tesla', 'BB Lava Launcher', 'BB X-Bow',
  'BB Walls', 'BB Spring Trap', 'Mine', 'Mega Mine', 'Push Trap', 'Builder Hall',
  'BB Gold Mine', 'BB Elixir Collector', 'BB Gold Storage', 'BB Elixir Storage',
  'Gem Mine', 'B.O.B Control', 'Builder Barracks', 'BB Army Camp', 'Star Laboratory',
  'Battle Machine Altar', 'Reinforcement Camp', 'Healing Hut', 'Battle Copter Altar',
  'Clock Tower',
];

// --- Package item shapes (subset we consume) ---

interface BuildTimeLike {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

interface PackageLevel {
  level: number;
  hitpoints?: number;
  buildCost?: number;
  buildCostResource?: string;
  buildTime?: BuildTimeLike;
  xpGained?: number;
  townHallRequired?: number;
  builderHallRequired?: number;
  capacity?: number;
  productionRate?: number;
  housingSpace?: number;
  unlockedUnit?: string | null;
  unlockedSpell?: string | null;
  unlockedSiegeMachine?: string | null;
  unlockedPet?: string | null;
  unlockedHero?: string | null;
  heroSlots?: number;
  equipmentUnlocked?: string | null;
  oreCapacity?: Record<string, number>;
  maxEquipmentLevel?: Record<string, number>;
  troopCapacity?: number;
  spellCapacity?: number;
  siegeMachineCapacity?: number;
  spellStorageCapacity?: number;
  damage?: number;
  damageVsHeroes?: number;
  springCapacity?: number;
  wallRings?: number;
  troopLevel?: number;
  healthRecovery?: number;
  boostDurationMinutes?: number;
  timeGainedMinutes?: number;
  maxBuildings?: number;
  spawnCount?: number;
  supercharge?: boolean;
  stats?: any;
  images?: Record<string, string>;
}

export interface PackageBuilding {
  id: string;
  name: string;
  base: string;
  category: string;
  description?: string;
  availablePerTownHall?: { townHallLevel: number; count: number }[];
  availablePerBuilderHall?: { builderHallLevel: number; count: number }[];
  levels: PackageLevel[];
}

// --- Lazy loading (degrade gracefully to [] if the package fails to load) ---

let loaded = false;
let homeBuildings: PackageBuilding[] = [];
let builderBuildings: PackageBuilding[] = [];

function safeLoad<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function load(): void {
  if (loaded) return;
  loaded = true;
  const h = home();
  const b = builder();
  homeBuildings = safeLoad(() => [
    ...h.defenses().get(),
    ...h.resourceBuildings().get(),
    ...h.resourceBuildings().clanCastle().get(),
    ...h.otherBuildings().helperHut().get(),
    ...h.armyBuildings().armyCamp().get(),
    ...h.armyBuildings().barracks().get(),
    ...h.armyBuildings().darkBarracks().get(),
    ...h.armyBuildings().laboratory().get(),
    ...h.armyBuildings().spellFactory().get(),
    ...h.armyBuildings().darkSpellFactory().get(),
    ...h.armyBuildings().heroHall().get(),
    ...h.armyBuildings().blacksmith().get(),
    ...h.armyBuildings().workshop().get(),
    ...h.armyBuildings().petHouse().get(),
    ...h.traps().get(),
    ...h.walls().get(),
  ] as unknown as PackageBuilding[], []);
  builderBuildings = safeLoad(() => [
    ...b.defenses().get(),
    ...b.resourceBuildings().get(),
    ...b.armyBuildings().get(),
    ...b.otherBuildings().get(),
    ...b.traps().get(),
    ...b.walls().get(),
    ...b.builderHall().get(),
  ] as unknown as PackageBuilding[], []);
}

let homeIndex: Map<string, PackageBuilding> | null = null;
let builderIndex: Map<string, PackageBuilding> | null = null;

function indexItems(): void {
  load();
  if (!homeIndex) {
    homeIndex = new Map();
    for (const item of homeBuildings) homeIndex.set(item.name, item);
  }
  if (!builderIndex) {
    builderIndex = new Map();
    for (const item of builderBuildings) builderIndex.set(item.name, item);
  }
}

function getHomeItem(name: string): PackageBuilding | null {
  indexItems();
  return homeIndex?.get(name) ?? null;
}

function getBuilderItem(name: string): PackageBuilding | null {
  indexItems();
  return builderIndex?.get(name) ?? null;
}

/** Resolve a package building item by display or package name. */
export function getBuildingItem(name: string, builderBase = false): PackageBuilding | null {
  const pkg = toPackageName(name);
  return builderBase ? getBuilderItem(pkg) : getHomeItem(pkg);
}

// --- Max levels ---

/** The package lists some defenses twice: a normal path plus "supercharge"
 * variants of the same levels. The app tracks the normal path only. */
function normalLevels(levels: PackageLevel[]): PackageLevel[] {
  return levels.filter((l) => !l.supercharge);
}

function maxLevelUnderCap(levels: PackageLevel[], capKey: 'townHallRequired' | 'builderHallRequired', cap: number): number {
  let max = 0;
  for (const lvl of normalLevels(levels)) {
    const req = lvl[capKey];
    if ((req == null || req <= cap) && lvl.level > max) max = lvl.level;
  }
  return max;
}

const maxTHCache = new Map<string, number>();
const maxBHCache = new Map<string, number>();

/** Max level of a Home Village building reachable at the given Town Hall. */
export function getBuildingMaxLevelAtTH(name: string, th: number): number | null {
  const pkg = toPackageName(name);
  const cacheKey = `${pkg}:${th}`;
  if (maxTHCache.has(cacheKey)) {
    const cached = maxTHCache.get(cacheKey)!;
    return cached > 0 ? cached : null;
  }
  const item = getHomeItem(pkg);
  let result: number | null = null;
  if (item?.levels?.length) {
    const max = maxLevelUnderCap(item.levels, 'townHallRequired', th);
    result = max > 0 ? max : null;
  }
  maxTHCache.set(cacheKey, result ?? -1);
  return result;
}

/** Max level of a Builder Base building reachable at the given Builder Hall. */
export function getBuildingMaxLevelAtBH(name: string, bh: number): number | null {
  const pkg = toPackageName(name);
  const cacheKey = `${pkg}:${bh}`;
  if (maxBHCache.has(cacheKey)) {
    const cached = maxBHCache.get(cacheKey)!;
    return cached > 0 ? cached : null;
  }
  const item = getBuilderItem(pkg);
  let result: number | null = null;
  if (item?.levels?.length) {
    if (pkg === 'Builder Hall') {
      // The Builder Hall gates itself: at BH n the building is at level n.
      result = Math.min(normalLevels(item.levels).length, Math.max(1, bh));
    } else {
      const max = maxLevelUnderCap(item.levels, 'builderHallRequired', bh);
      result = max > 0 ? max : null;
    }
  }
  maxBHCache.set(cacheKey, result ?? -1);
  return result;
}

// --- Copy counts ---

/** How many copies of a Home Village building exist at a Town Hall. */
export function getBuildingCountAtTH(name: string, th: number): number {
  const item = getHomeItem(toPackageName(name));
  if (!item?.availablePerTownHall?.length) return 1;
  let result = 1;
  for (const e of item.availablePerTownHall) {
    if (e.townHallLevel <= th) result = e.count;
  }
  return result;
}

/** How many copies of a Builder Base building exist at a Builder Hall. */
export function getBuildingCountAtBH(name: string, bh: number): number {
  const item = getBuilderItem(toPackageName(name));
  if (!item?.availablePerBuilderHall?.length) return 1;
  let result = 0;
  for (const e of item.availablePerBuilderHall) {
    if (e.builderHallLevel <= bh) result = e.count;
  }
  return result;
}

// --- Per-level stats (shape the Buildings tab renders) ---

export interface BuildingDetailLevel {
  Level: number;
  [column: string]: any;
}

export interface BuildingDetail {
  name: string;
  village: 'home' | 'builderBase';
  description?: string;
  maxLevel: number;
  statsColumns: string[];
  levels: BuildingDetailLevel[];
}

function buildTimeToSeconds(t?: BuildTimeLike): number {
  if (!t) return 0;
  return (t.days ?? 0) * 86400 + (t.hours ?? 0) * 3600 + (t.minutes ?? 0) * 60 + (t.seconds ?? 0);
}

/** Per-level build time as the scraped-style string ("5s", "30m", "1d 12h"). */
function formatBuildTime(t?: BuildTimeLike): string {
  const total = buildTimeToSeconds(t);
  if (total <= 0) return '—';
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function pickColumns(item: PackageBuilding): string[] {
  const cols: string[] = [];
  const any = (pred: (l: PackageLevel) => boolean) => item.levels.some(pred);
  const cat = item.category;

  if (any((l) => l.hitpoints != null)) cols.push('Hitpoints');
  if (cat === 'defense') {
    cols.push('Damage per Second', 'Damage per Shot');
  } else if (cat === 'trap') {
    if (any((l) => l.damage != null)) cols.push('Damage');
    if (any((l) => l.springCapacity != null)) cols.push('Spring Capacity');
  } else if (item.name === 'Clan Castle') {
    if (any((l) => l.troopCapacity != null)) cols.push('Troop Capacity');
    if (any((l) => l.spellCapacity != null)) cols.push('Spell Capacity');
    if (any((l) => l.siegeMachineCapacity != null)) cols.push('Siege Machine Capacity');
  } else if (cat === 'resource') {
    if (any((l) => l.capacity != null)) cols.push('Capacity');
    if (any((l) => l.productionRate != null)) cols.push('Production Rate');
  } else if (cat === 'army') {
    if (any((l) => !!l.unlockedUnit)) cols.push('Unlocked Unit');
    if (any((l) => !!l.unlockedSpell)) {
      cols.push('Unlocked Spell');
      if (any((l) => l.spellStorageCapacity != null)) cols.push('Spell Capacity');
    }
    if (any((l) => !!l.unlockedSiegeMachine)) {
      cols.push('Unlocked Siege Machine');
      if (any((l) => l.siegeMachineCapacity != null)) cols.push('Siege Machine Capacity');
    }
    if (any((l) => !!l.unlockedPet)) cols.push('Unlocked Pet');
    if (any((l) => !!l.unlockedHero)) {
      cols.push('Unlocked Hero');
      if (any((l) => l.heroSlots != null)) cols.push('Hero Slots');
    }
    if (any((l) => !!l.equipmentUnlocked)) cols.push('Equipment Unlocked');
    if (any((l) => (l.housingSpace ?? 0) > 0)) cols.push('Troop Capacity');
  } else if (cat === 'wall') {
    if (any((l) => l.wallRings != null)) cols.push('Wall Ring Cost');
  } else if (cat === 'other') {
    if (any((l) => l.boostDurationMinutes != null)) cols.push('Boost Duration');
  } else if (cat === 'builder-hall') {
    if (any((l) => l.maxBuildings != null)) cols.push('Max Buildings');
  }

  if (any((l) => l.healthRecovery != null)) cols.push('Health Recovery');
  if (any((l) => l.troopLevel != null)) cols.push('Troop Level');
  if (any((l) => l.spawnCount != null)) cols.push('Spawn Count');
  if (any((l) => l.buildCost != null)) cols.push('Build Cost');
  if (any((l) => buildTimeToSeconds(l.buildTime) > 0)) cols.push('Build Time');
  if (any((l) => (l.xpGained ?? 0) > 0)) cols.push('Experience');
  if (any((l) => l.townHallRequired != null || l.builderHallRequired != null)) cols.push('Town Hall Level');
  return cols;
}

function columnValue(col: string, l: PackageLevel): any {
  switch (col) {
    case 'Damage per Second': {
      const n = l.stats?.normal ?? {};
      return (n.dps ?? n.damagePerSecond ?? 0) || '—';
    }
    case 'Damage per Shot': return l.stats?.normal?.damagePerShot ?? '—';
    case 'Damage': return l.damage ?? '—';
    case 'Spring Capacity': return l.springCapacity ?? '—';
    case 'Capacity': return l.capacity ?? '—';
    case 'Production Rate': return l.productionRate != null ? `${l.productionRate}/hr` : '—';
    case 'Troop Capacity': {
      const h = l.housingSpace ?? 0;
      return h > 0 ? h : (l.troopCapacity ?? '—');
    }
    case 'Spell Capacity': return l.spellStorageCapacity ?? l.spellCapacity ?? '—';
    case 'Siege Machine Capacity': return l.siegeMachineCapacity ?? '—';
    case 'Unlocked Unit': return l.unlockedUnit ?? '—';
    case 'Unlocked Spell': return l.unlockedSpell ?? '—';
    case 'Unlocked Siege Machine': return l.unlockedSiegeMachine ?? '—';
    case 'Unlocked Pet': return l.unlockedPet ?? '—';
    case 'Unlocked Hero': return l.unlockedHero ?? '—';
    case 'Hero Slots': return l.heroSlots ?? '—';
    case 'Equipment Unlocked': return l.equipmentUnlocked ?? '—';
    case 'Wall Ring Cost': return l.wallRings ?? '—';
    case 'Max Buildings': return l.maxBuildings ?? '—';
    case 'Boost Duration': return l.boostDurationMinutes != null ? `${l.boostDurationMinutes}m` : '—';
    case 'Health Recovery': return l.healthRecovery ?? '—';
    case 'Troop Level': return l.troopLevel ?? '—';
    case 'Spawn Count': return l.spawnCount ?? '—';
    case 'Hitpoints': return l.hitpoints ?? '—';
    case 'Build Cost': return l.buildCost ?? 0;
    case 'Build Time': return formatBuildTime(l.buildTime);
    case 'Experience': return l.xpGained ?? 0;
    case 'Town Hall Level': return l.townHallRequired ?? l.builderHallRequired ?? '—';
    default: return '—';
  }
}

/**
 * Stats-table data for a building, shaped like the legacy building-levels.json
 * entries so the existing table renderers work unchanged. Every row also carries
 * a non-column `Build Cost Resource` key for resource-coloured costs.
 */
export function getBuildingDetail(name: string, opts: { builderBase?: boolean } = {}): BuildingDetail | null {
  const item = getBuildingItem(name, opts.builderBase);
  const levels = item?.levels?.length ? normalLevels(item.levels) : [];
  if (!item || levels.length === 0) return null;
  const statsColumns = pickColumns({ ...item, levels });
  const rows = levels.map((l) => {
    const row: BuildingDetailLevel = { Level: l.level };
    for (const col of statsColumns) row[col] = columnValue(col, l);
    row['Build Cost Resource'] = l.buildCostResource ?? 'Unknown';
    return row;
  });
  return {
    name: item.name,
    village: item.base === 'builder' ? 'builderBase' : 'home',
    description: item.description,
    maxLevel: levels[levels.length - 1].level,
    statsColumns,
    levels: rows,
  };
}

// --- Categories (the record the Buildings tab consumes) ---

interface ThLevelEntry {
  level: number | null;
  isMaxLevel: boolean;
}

export type BuildingCategories = Record<string, Record<string, Record<string, ThLevelEntry>>>;

const categoriesCache = new Map<number, BuildingCategories>();

/** Category → building → { th → { level, isMaxLevel } } for the current Town Hall. */
export function getBuildingCategories(th: number): BuildingCategories {
  const cached = categoriesCache.get(th);
  if (cached) return cached;
  const result: BuildingCategories = {};
  for (const [cat, names] of Object.entries(HOME_CATEGORIES)) {
    const catData: Record<string, Record<string, ThLevelEntry>> = {};
    for (const display of names) {
      const item = getHomeItem(toPackageName(display));
      const globalMax = item?.levels.length ? normalLevels(item.levels).length : 0;
      const max = getBuildingMaxLevelAtTH(display, th);
      catData[display] = {
        [String(th)]: {
          level: max,
          isMaxLevel: max != null && globalMax > 0 && max >= globalMax,
        },
      };
    }
    result[cat] = catData;
  }
  categoriesCache.set(th, result);
  return result;
}

// --- Images ---

/**
 * Bundled package image (require'd asset) for a building. Returns the
 * level-specific sprite when `level` matches one, otherwise the level-1 icon.
 * Returns null when the package ships no image (callers keep their fallback).
 */
export function getBuildingItemImage(name: string, level?: number | null, builderBase = false): number | null {
  const map = builderBase ? PACKAGE_BUILDER_IMAGES : PACKAGE_IMAGES;
  const entry = map[toPackageName(name)];
  if (!entry) return null;
  if (level != null) {
    const sprite = entry.levels[String(level)];
    if (sprite) return sprite;
  }
  return entry.icon || null;
}

// --- Resource metadata (mirrors the army tab's cost colouring) ---

export type BuildingCostResource =
  | 'Gold'
  | 'Elixir'
  | 'Dark Elixir'
  | 'Builder Gold'
  | 'Builder Elixir'
  | 'Gold or Elixir'
  | 'Builder Gold or Builder Elixir'
  | 'Unknown';

export interface BuildingResourceMeta {
  label: string;
  short: string;
  color: string;
}

export const BUILDING_RESOURCE_META: Record<BuildingCostResource, BuildingResourceMeta> = {
  Gold: { label: 'Gold', short: 'Gold', color: '#E8B339' },
  Elixir: { label: 'Elixir', short: 'Elixir', color: '#E84A9D' },
  'Dark Elixir': { label: 'Dark Elixir', short: 'DE', color: '#7C3AED' },
  'Builder Gold': { label: 'Builder Gold', short: 'B.Gold', color: '#E8B339' },
  'Builder Elixir': { label: 'Builder Elixir', short: 'B.Elixir', color: '#A855F7' },
  'Gold or Elixir': { label: 'Gold or Elixir', short: 'Gold/Elixir', color: '#F1C40F' },
  'Builder Gold or Builder Elixir': { label: 'Builder Gold or Builder Elixir', short: 'B.G/E', color: '#F1C40F' },
  Unknown: { label: 'Unknown', short: '?', color: '#94A3B8' },
};
