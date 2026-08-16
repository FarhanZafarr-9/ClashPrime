import type { TroopDetail } from '../api/troopDetail';
import { parseCost, parseTimeToSeconds, formatCost, formatTime, formatTimeShort } from './buildingImages';
import {
  getBuildingDetail,
  isBuilderName,
  BUILDING_RESOURCE_META,
  BuildingCostResource,
} from './buildingData';

export { parseCost, parseTimeToSeconds, formatCost, formatTime, formatTimeShort };

export interface CostTime {
  cost: number;
  time: number;
  hasData: boolean;
  /** Remaining cost grouped by resource (e.g. { Elixir, Gold, 'Dark Elixir' }). */
  byResource?: Record<string, number>;
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
  const byResource: Record<string, number> = {};
  let cost = 0;
  let time = 0;
  for (const l of detail.levels) {
    if (l.level > currentLevel && l.level <= maxLevel) {
      const amount = l.costAmount ?? (l.upgradeCost ? parseCost(l.upgradeCost) : 0);
      if (amount > 0) {
        cost += amount;
        const res = l.costResource ?? 'Unknown';
        byResource[res] = (byResource[res] ?? 0) + amount;
      }
      if (l.upgradeTime) time += parseTimeToSeconds(l.upgradeTime);
    }
  }
  return { cost, time, hasData: true, byResource };
}

/**
 * Remaining upgrade cost/time for a building across every copy, using the
 * package detail rows (bundled, no network needed). Costs are summed per
 * resource (each row's "Build Cost Resource").
 * `copies` is the per-copy current level array and `effectiveMax` the per-copy cap.
 */
export function remainingBuildingCosts(
  name: string,
  copies: number[],
  effectiveMax: number,
): CostTime {
  if (copies.length === 0 || effectiveMax <= 0) return EMPTY;
  const detail = getBuildingDetail(name, { builderBase: isBuilderName(name) });
  if (!detail || detail.levels.length === 0) return EMPTY;
  const byResource: Record<string, number> = {};
  let cost = 0;
  let time = 0;
  for (const lvl of copies) {
    if (lvl <= 0) continue;
    for (const l of detail.levels) {
      if (l.Level <= lvl || l.Level > effectiveMax) continue;
      const rowCost =
        typeof l['Build Cost'] === 'number'
          ? (l['Build Cost'] as number)
          : parseCost(String(l['Build Cost'] ?? ''));
      if (rowCost > 0) {
        cost += rowCost;
        const res: string = l['Build Cost Resource'] ?? 'Unknown';
        byResource[res] = (byResource[res] ?? 0) + rowCost;
      }
      const bt = l['Build Time'];
      if (bt) time += parseTimeToSeconds(String(bt));
    }
  }
  return { cost, time, hasData: true, byResource };
}

/**
 * Merge a list of CostTime into one aggregate. Rows without data (e.g. a troop
 * whose wiki page hasn't loaded yet) contribute 0 and only hide the label if
 * *no* row has data, so a single missing entry can't blank the whole category.
 */
export function sumCosts(items: CostTime[]): CostTime {
  let cost = 0;
  let time = 0;
  let hasData = false;
  const byResource: Record<string, number> = {};
  for (const it of items) {
    if (it.hasData) hasData = true;
    cost += it.cost;
    time += it.time;
    if (it.byResource) {
      for (const [res, v] of Object.entries(it.byResource)) {
        byResource[res] = (byResource[res] ?? 0) + v;
      }
    }
  }
  return {
    cost,
    time,
    hasData,
    byResource: Object.keys(byResource).length > 0 ? byResource : undefined,
  };
}

const RESOURCE_ORDER: BuildingCostResource[] = [
  'Gold',
  'Elixir',
  'Dark Elixir',
  'Builder Gold',
  'Builder Elixir',
  'Gold or Elixir',
  'Builder Gold or Builder Elixir',
  'Unknown',
];

/**
 * Format a per-resource cost breakdown as one label, e.g.
 * "700K Elixir · 250K Gold · 50K DE". Unknown-resource costs are omitted so
 * callers can fall back to a plain total; compound resources (walls) use the
 * short form ("Gold/Elixir").
 */
export function formatCostBreakdown(byResource?: Record<string, number>): string {
  if (!byResource) return '';
  const entries = (Object.entries(byResource).filter(([, v]) => v > 0) as [string, number][]).filter(
    ([res]) => res !== 'Unknown',
  );
  if (entries.length === 0) return '';
  entries.sort((a, b) => {
    const ia = RESOURCE_ORDER.indexOf(a[0] as BuildingCostResource);
    const ib = RESOURCE_ORDER.indexOf(b[0] as BuildingCostResource);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return entries
    .map(([res, v]) => {
      const meta = BUILDING_RESOURCE_META[res as BuildingCostResource];
      const label =
        meta && (res === 'Gold or Elixir' || res === 'Builder Gold or Builder Elixir')
          ? meta.short
          : meta?.label ?? res;
      return `${formatCost(v)} ${label}`;
    })
    .join(' · ');
}
