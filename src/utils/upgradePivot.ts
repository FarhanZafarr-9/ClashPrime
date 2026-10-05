/**
 * A "pivot" is the level a sheet's Remaining totals stop at.
 *
 * The Remaining tables always summed every level from the current one up to the
 * max, which is rarely the number you care about mid-game: the usual question is
 * "what does the next few levels cost". Long-pressing a row in a fully expanded
 * stats table moves the totals to that row instead, and the sheet falls back to
 * the max whenever there is no pivot.
 *
 * Both sheets derive their remaining totals from a single upper bound, so the
 * whole feature is this bound being swapped - see resolvePivotBound.
 */

/**
 * A pivot needs at least three levels strictly between the current level and the
 * max, which is five levels counting both ends.
 *
 * With fewer there is nothing to choose: the condensed table already shows every
 * remaining row, so capping the totals at one of them would only remove rows the
 * player can otherwise see and total.
 */
export const MIN_PIVOT_GAP = 4;

/** Whether this sheet has enough runway for a pivot to mean anything. */
export function canPivot(currentLevel: number, maxLevel: number): boolean {
  return maxLevel - currentLevel >= MIN_PIVOT_GAP;
}

/**
 * Whether a level is a pivot target: after the current level (pivoting to or at
 * the current level would change nothing) and before the max (the max is already
 * the default).
 *
 * `expanded` keeps a pivot off the condensed table, where rows are elided behind
 * an ellipsis and a "Show all" affordance already exists for looking further
 * ahead.
 */
export function isPivotable(level: number, currentLevel: number, maxLevel: number, expanded: boolean): boolean {
  return expanded && canPivot(currentLevel, maxLevel) && level > currentLevel && level < maxLevel;
}

/** The level the remaining totals stop at: the pivot when it is set and valid, else the max. */
export function resolvePivotBound(pivot: number | null | undefined, currentLevel: number, maxLevel: number): number {
  if (pivot == null || !isPivotable(pivot, currentLevel, maxLevel, true)) return maxLevel;
  return pivot;
}

/** "Remaining (3 lvls)" - how many upgrades the totals actually cover. */
export function pivotSpanLabel(currentLevel: number, bound: number): string {
  return `${Math.max(0, bound - currentLevel)} lvls`;
}