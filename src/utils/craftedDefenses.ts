// Crafted defenses (the Crafting Station's output) are not flat per-level buildings.
// A defense is upgraded through independent modules — Hitpoints, Damage, Seconds
// Active, ... — each running level 1..10, and its "effective level" is the SUM of
// those module levels. That total is what the game displays and what the bundled
// sprites are tiered by (e.g. one sprite covers effective levels 3-11, the next 12-20).
//
// Exports only ever report the module levels (there is no single level field and no
// copy count), so module levels are the source of truth and the effective level is
// always derived — never stored.

import { home } from 'clash-of-clans-data';
import { PACKAGE_CRAFTED_IMAGES } from '../data/packageImages';

export interface CraftedUpgrade {
  level: number;
  stat: number;
  extraStats?: Record<string, number>;
  buildCost: number;
  buildCostResource: string;
  buildTimeSec: number;
  xpGained: number;
  sparkyStones: number;
}

export interface CraftedModule {
  name: string;
  dataId: number | null;
  /** Short description of what this module controls, e.g. "Damage per second per flame". */
  controls?: string;
  upgrades: CraftedUpgrade[];
}

export interface CraftedDefense {
  name: string;
  /** Absent on the designs that have been retired and replaced by a newer phase. */
  dataId: number | null;
  craftingPhase: number;
  isCurrent: boolean;
  description?: string;
  size?: string;
  targetType?: string;
  modules: CraftedModule[];
  /** Effective-level span each bundled sprite covers, ascending. */
  imageTiers: { from: number; to: number }[];
}

/** Module name → level, e.g. { Hitpoints: 4, Damage: 2 }. */
export type CraftedModuleLevels = Record<string, number>;
/** Defense name → its module levels. */
export type CraftedLevels = Record<string, CraftedModuleLevels>;

interface RawUpgrade {
  level: number;
  stat?: number;
  extraStats?: Record<string, number>;
  buildCost?: number;
  buildCostResource?: string;
  buildTime?: { days?: number; hours?: number; minutes?: number; seconds?: number };
  xpGained?: number;
  sparkyStones?: number;
}

interface RawModule {
  name: string;
  dataId?: number | null;
  controls?: string;
  upgrades?: RawUpgrade[];
}

interface RawDefense {
  name: string;
  dataId?: number | null;
  craftingPhase?: number;
  isCurrent?: boolean;
  description?: string;
  size?: string;
  targetType?: string;
  modules?: RawModule[];
  images?: { fromEffectiveLevel: number; toEffectiveLevel: number; normal?: string }[];
}

function safeLoad<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const toSeconds = (t?: RawUpgrade['buildTime']): number =>
  ((t?.days ?? 0) * 86400) + ((t?.hours ?? 0) * 3600) + ((t?.minutes ?? 0) * 60) + (t?.seconds ?? 0);

function normalize(raw: RawDefense): CraftedDefense {
  const modules: CraftedModule[] = (raw.modules ?? []).map((m) => ({
    name: m.name,
    dataId: m.dataId ?? null,
    controls: m.controls,
    // Level 1 is the free base the Crafting Station produces, so it carries a
    // zero cost/time entry in the package too; keep the whole ladder.
    upgrades: (m.upgrades ?? []).map((u) => ({
      level: u.level,
      stat: u.stat ?? 0,
      extraStats: u.extraStats,
      buildCost: u.buildCost ?? 0,
      buildCostResource: u.buildCostResource ?? '',
      buildTimeSec: toSeconds(u.buildTime),
      xpGained: u.xpGained ?? 0,
      sparkyStones: u.sparkyStones ?? 0,
    })),
  }));
  const tiers = (raw.images ?? [])
    .filter((im) => typeof im.fromEffectiveLevel === 'number' && typeof im.toEffectiveLevel === 'number')
    .map((im) => ({ from: im.fromEffectiveLevel, to: im.toEffectiveLevel }))
    .sort((a, b) => a.from - b.from);
  return {
    name: raw.name,
    dataId: raw.dataId ?? null,
    craftingPhase: raw.craftingPhase ?? 0,
    isCurrent: raw.isCurrent ?? false,
    description: raw.description,
    size: raw.size,
    targetType: raw.targetType,
    modules,
    imageTiers: tiers,
  };
}

let cache: CraftedDefense[] | null = null;

/** Every crafted defense the package knows about, current designs first. */
export function getCraftedDefenses(): CraftedDefense[] {
  if (!cache) {
    const raw = safeLoad<RawDefense[]>(
      () => (home().craftedDefenses ? (home().craftedDefenses().get() as unknown as RawDefense[]) : []),
      [],
    );
    cache = raw.map(normalize).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || a.name.localeCompare(b.name));
  }
  return cache;
}

let index: Map<string, CraftedDefense> | null = null;

/** Resolve a crafted defense by display name (the name an export reports). */
export function getCraftedDefense(name: string): CraftedDefense | null {
  if (!index) index = new Map(getCraftedDefenses().map((d) => [d.name, d]));
  return index.get(name) ?? null;
}

/** Highest level a module can reach (10 in game). */
export const moduleMaxLevel = (m: CraftedModule): number => Math.max(1, m.upgrades.length);

/** Effective level with every module at level 1 — the defense as first crafted. */
export const minEffectiveLevel = (d: CraftedDefense): number => Math.max(1, d.modules.length);

/** Effective level with every module maxed. */
export const maxEffectiveLevel = (d: CraftedDefense): number =>
  d.modules.reduce((sum, m) => sum + moduleMaxLevel(m), 0);

const clampLevel = (level: number | undefined, max: number): number => {
  if (typeof level !== 'number' || !Number.isFinite(level)) return 1;
  return Math.min(max, Math.max(1, Math.round(level)));
};

/**
 * Coerce stored or imported module levels into a full, valid set: every known module
 * present, clamped to 1..max, unknown module names dropped. This is what makes a
 * Crafting Station export (which reports every module) and a partial stored record
 * interchangeable.
 */
export function normalizeModuleLevels(d: CraftedDefense, raw: CraftedModuleLevels | undefined): CraftedModuleLevels {
  const out: CraftedModuleLevels = {};
  for (const m of d.modules) {
    out[m.name] = clampLevel(raw?.[m.name], moduleMaxLevel(m));
  }
  return out;
}

/** The sum of the module levels — the defense's level in game. */
export function effectiveLevel(d: CraftedDefense, moduleLevels: CraftedModuleLevels | undefined): number {
  const levels = normalizeModuleLevels(d, moduleLevels);
  return d.modules.reduce((sum, m) => sum + levels[m.name], 0);
}

/** The package row for one module level, or null when the level is out of range. */
export function upgradeFor(m: CraftedModule, level: number): CraftedUpgrade | null {
  return m.upgrades.find((u) => u.level === level) ?? null;
}

/** Stat value a module reaches at a level, e.g. Hitpoints 4 -> 2500. */
export function statFor(m: CraftedModule, level: number): number {
  return upgradeFor(m, level)?.stat ?? 0;
}

/** Cost/time to go from `level` to `level + 1`, or null when already maxed. */
export function nextUpgrade(d: CraftedDefense, moduleName: string, level: number): CraftedUpgrade | null {
  const m = d.modules.find((x) => x.name === moduleName);
  if (!m) return null;
  const current = clampLevel(level, moduleMaxLevel(m));
  if (current >= moduleMaxLevel(m)) return null;
  return upgradeFor(m, current + 1);
}

/**
 * Bundled sprite for a defense at a given effective level. Sprites are tiered over
 * ranges rather than one per level, so pick the tier whose range start is the
 * highest one at or below the effective level. A tier the generator could not
 * bundle (one upstream file is a 404 page) is emitted as 0 and falls back down.
 */
export function getCraftedDefenseImage(name: string, level: number): number | null {
  const entry = PACKAGE_CRAFTED_IMAGES[name];
  if (!entry) return null;
  const starts = Object.keys(entry.levels).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  let chosen = 0;
  for (const from of starts) {
    if (from <= level) chosen = from;
    else break;
  }
  if (chosen) {
    const sprite = entry.levels[String(chosen)];
    if (sprite) return sprite;
    // Missing tier: fall back to the next lower one that did bundle.
    for (let i = starts.indexOf(chosen) - 1; i >= 0; i--) {
      const lower = entry.levels[String(starts[i])];
      if (lower) return lower;
    }
  }
  return entry.icon || null;
}