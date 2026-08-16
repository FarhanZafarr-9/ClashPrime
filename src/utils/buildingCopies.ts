import type { PlayerBuilding } from '../types/clash';
import { getBuildingCountAtBH, getBuildingCountAtTH, isBuilderName } from './buildingData';

// Store keys (th-levels.json / buildingLevels) → building-levels.json names.
const STORE_TO_JSON: Record<string, string> = {
  'Walls': 'Wall',
  'Lab': 'Laboratory',
  'Builder Hut': "Builder's Hut",
};

const JSON_TO_STORE: Record<string, string> = {
  'Wall': 'Walls',
  'Laboratory': 'Lab',
  "Builder's Hut": 'Builder Hut',
};

/** Convert a store key (buildingLevels) to its building-levels.json name. */
export function toJsonName(name: string): string {
  return STORE_TO_JSON[name] ?? name;
}

/** Convert a building-levels.json name back to its store key. */
export function toStoreName(name: string): string {
  return JSON_TO_STORE[name] ?? name;
}

/** How many copies of a building exist at a given Town Hall level (1 if single-copy). */
export function getCountAtTH(name: string, th: number): number {
  return isBuilderName(name) ? getBuildingCountAtBH(name, th) : getBuildingCountAtTH(name, th);
}

/** How many copies of a building exist at a given Builder Hall level (1 if single-copy). */
export function getCountAtBH(name: string, bh: number): number {
  return getBuildingCountAtBH(name, bh);
}

export interface BuildingCopies {
  count: number;
  levels: number[];
  maxLevel: number;
  /** True when the building is locked at the current TH/BH. */
  locked: boolean;
}

/**
 * Resolve per-copy current levels for a building.
 *
 * Sources, in priority order:
 *  1. The raw API `buildings` array (one entry per copy when available).
 *  2. Manual/onboarding `buildingLevels[name]` — a single representative value
 *     that equals the max level at `lastMaxedTH`. Copies that already existed at
 *     `lastMaxedTH` inherit that value; copies unlocked by a later TH are seeded
 *     at level 1 (you can't have upgraded a copy you couldn't build yet).
 * Missing copies (newly unlocked by a higher TH/BH) default to level 1, matching
 * how the game seeds extra copies.
 */
export function getBuildingCopies(
  name: string,
  buildingLevels: Record<string, number> | undefined,
  buildings: PlayerBuilding[] | undefined,
  maxLevel: number,
  count: number,
  lastMaxedTH?: number,
  th?: number,
): BuildingCopies {
  const jsonName = toJsonName(name);
  const key = jsonName.toLowerCase();
  const apiCopies = (buildings ?? [])
    .filter((b) => b.name.toLowerCase() === key)
    .map((b) => b.level)
    .filter((l) => l > 0);

  const representative = buildingLevels?.[toStoreName(name)] ?? buildingLevels?.[name] ?? 0;
  // How many copies were already available at the last fully maxed TH.
  const maxedCount =
    lastMaxedTH && th && lastMaxedTH < th
      ? getBuildingCountAtTH(name, lastMaxedTH)
      : count;

  const levels: number[] = [];
  if (apiCopies.length > 0) {
    for (let i = 0; i < count; i++) {
      levels.push(i < apiCopies.length ? Math.min(apiCopies[i], maxLevel) : 1);
    }
  } else if (representative > 0) {
    for (let i = 0; i < count; i++) {
      if (i < maxedCount) {
        levels.push(Math.min(representative, maxLevel));
      } else {
        levels.push(1);
      }
    }
  } else {
    // Available at the current TH but no recorded level yet. You can't progress
    // without building it, so every copy seeds at level 1 (only truly unavailable
    // buildings — count 0 — remain locked).
    for (let i = 0; i < count; i++) {
      levels.push(1);
    }
  }

  const locked = levels.length === 0 || levels.every((l) => l === 0);
  return { count, levels, maxLevel, locked };
}
