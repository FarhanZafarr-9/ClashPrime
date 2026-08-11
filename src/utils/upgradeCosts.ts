import type { TroopDetail } from '../api/troopDetail';
import { parseCost, parseTimeToSeconds, formatCost, formatTime, formatTimeShort } from './buildingImages';
import { toJsonName } from './buildingCopies';
import buildingLevelsData from '../data/building-levels.json';

export { parseCost, parseTimeToSeconds, formatCost, formatTime, formatTimeShort };

export interface CostTime {
  cost: number;
  time: number;
  hasData: boolean;
}

const EMPTY: CostTime = { cost: 0, time: 0, hasData: false };

/**
 * Remaining upgrade cost/time for a troop/spell/hero/equipment (wiki detail)
 * between the current level and the max reachable at this Town Hall.
 * Locked items (currentLevel 0) count the full cost to unlock and max.
 */
export function remainingArmyCosts(
  detail: TroopDetail | null | undefined,
  currentLevel: number,
  maxLevel: number,
): CostTime {
  if (!detail || detail.levels.length === 0) return EMPTY;
  if (maxLevel <= 0 || currentLevel >= maxLevel) return { cost: 0, time: 0, hasData: true };
  let cost = 0;
  let time = 0;
  for (const l of detail.levels) {
    if (l.level > currentLevel && l.level <= maxLevel) {
      if (l.upgradeCost) cost += parseCost(l.upgradeCost);
      if (l.upgradeTime) time += parseTimeToSeconds(l.upgradeTime);
    }
  }
  return { cost, time, hasData: true };
}

/**
 * Remaining upgrade cost/time for a building across every copy, using the static
 * building-levels.json data (already bundled, no network needed).
 * `copies` is the per-copy current level array and `effectiveMax` the per-copy cap.
 */
export function remainingBuildingCosts(
  name: string,
  copies: number[],
  effectiveMax: number,
): CostTime {
  if (copies.length === 0 || effectiveMax <= 0) return EMPTY;
  const key = toJsonName(name).toLowerCase();
  const b = (buildingLevelsData as any[]).find((x: any) => x.name.toLowerCase() === key);
  if (!b || !b.levels) return EMPTY;
  const allLevels = (b.levels as any[]).filter((l: any) => l.Level <= effectiveMax);
  let cost = 0;
  let time = 0;
  for (const lvl of copies) {
    if (lvl <= 0) continue;
    for (const l of allLevels) {
      if (l.Level > lvl) {
        if (l['Build Cost']) cost += parseCost(String(l['Build Cost']));
        if (l['Build Time']) time += parseTimeToSeconds(String(l['Build Time']));
      }
    }
  }
  return { cost, time, hasData: true };
}

/**
 * Merge a list of CostTime into one aggregate. Rows without data (e.g. a
 * building that has no entry in building-levels.json, or a troop whose wiki
 * page hasn't loaded yet) contribute 0 and only hide the label if *no* row has
 * data, so a single missing entry can't blank the whole category.
 */
export function sumCosts(items: CostTime[]): CostTime {
  let cost = 0;
  let time = 0;
  let hasData = false;
  for (const it of items) {
    if (it.hasData) hasData = true;
    cost += it.cost;
    time += it.time;
  }
  return { cost, time, hasData };
}
