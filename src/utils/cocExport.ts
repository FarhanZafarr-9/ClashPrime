// Decodes a Clash of Clans JSON Export snapshot (the format produced by the
// "Clash of Clans JSON Export" app) into building-level records the app can
// apply via setBulkLevels. Home Village and Builder Base buildings and traps
// are supported; each village is resolved against its own dataId map so
// colliding names (Cannon, Archer Tower, Wall, ...) stay disambiguated.

import {
  COC_HOME_BUILDING_IDS,
  COC_BUILDER_BUILDING_IDS,
  COC_CRAFTED_DEFENSE_IDS,
  COC_CRAFTED_MODULE_IDS,
} from '../data/cocBuildingIds';
import { toStoreName } from './buildingCopies';
import { HOME_CATEGORIES, BB_BUILDINGS, isBuilderName } from './buildingData';

/** The Crafting Station is the one building an export does not describe with a
 *  `lvl`: it nests the crafted defenses it has produced under `types[]`, and each
 *  of those carries `modules[]` holding the level of every individual upgrade. */
export interface CocCraftedType {
  data: number;
  modules?: { data: number; lvl?: number }[];
}

export interface CocExportEntry {
  data: number;
  lvl?: number;
  timer?: number;
  cnt?: number;
  types?: CocCraftedType[];
}

export interface CocExportData {
  tag?: string;
  timestamp?: number;
  buildings?: CocExportEntry[];
  traps?: CocExportEntry[];
  buildings2?: CocExportEntry[];
  traps2?: CocExportEntry[];
  [key: string]: unknown;
}

export interface CocExportResult {
  ok: boolean;
  error?: string;
  data?: CocExportData;
}

export interface CocImportItem {
  /** buildingLevels key (store name, e.g. "Walls", "Lab"). */
  storeName: string;
  /** Display name from the export mapping. */
  displayName: string;
  /** Representative level = max level across copies. */
  level: number;
  /** Actual level of every copy in the export (one entry per copy). */
  levels: number[];
  /** How many copies were present in the export. */
  copies: number;
  /** Copies with an in-progress upgrade (timer rows): their current level and
   *  seconds left. These stay at `lvl` but can be bumped to `lvl + 1` when the
   *  user opts to treat them as done. */
  timerRows: { level: number; remainingSec: number }[];
}

/** One crafted defense decoded out of the Crafting Station's `types[]`. */
export interface CocCraftedDefense {
  /** Defense name from the export mapping, e.g. "Hot Candle". */
  displayName: string;
  dataId: number;
  /** One entry per upgrade module, e.g. Hitpoints / Damage / Poison Level. */
  modules: { name: string; level: number }[];
  /** Highest module level — a stand-in for "how built out is it". */
  level: number;
}

export interface CocImportResult {
  /** storeName → representative level, ready for setBulkLevels. */
  levels: Record<string, number>;
  /** Buildings the app tracks (Home Village + Builder Base buildings and traps). */
  resolved: CocImportItem[];
  /** Resolved by ID but not tracked by the app (e.g. Town Hall). */
  skipped: CocImportItem[];
  /** Crafted defenses nested inside the Crafting Station. Not tracked by the
   *  app yet, so they are reported separately from `skipped`. */
  crafted: CocCraftedDefense[];
  /** dataIds with no mapping. */
  unresolved: { dataId: number; level: number; copies: number }[];
}

/** Export levels are plain numbers, but a row can omit `lvl` entirely. Feeding
 *  undefined into Math.max yields NaN, which then poisons every level total and
 *  renders as "NaN" in the import preview, so coerce anything non-finite to 0. */
function finiteLvl(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/** Every building the app stores levels for (HOME_CATEGORIES + BB_BUILDINGS values are store names). */
const TRACKED = new Set<string>([
  ...Object.values(HOME_CATEGORIES).flat(),
  ...BB_BUILDINGS,
]);

/** Map a COC_BUILDER_BUILDING_IDS display name to the app's Builder Base store
 * name. Names unique to the Builder Base (Clock Tower, Crusher, Gem Mine, ...)
 * keep their own label; names that collide with Home Village buildings (Cannon,
 * Archer Tower, X-Bow, ...) get the "BB " prefix the app keys levels by. "Wall"
 * pluralizes to "BB Walls" to match the app convention. */
function toBuilderStoreName(name: string): string {
  if (name === 'Wall') return 'BB Walls';
  return isBuilderName(name) ? name : `BB ${name}`;
}

/** Normalize a Clash of Clans player tag to the app's canonical "#XXXX" form. */
export function normalizeTag(raw?: string | null): string {
  const t = (raw ?? '').trim().toUpperCase().replace(/[^#A-Z0-9]/g, '');
  if (!t) return '';
  return t.startsWith('#') ? t : `#${t}`;
}

export function parseCocExport(raw: string): CocExportResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Paste a Clash of Clans JSON Export first.' };
  let data: CocExportData;
  try {
    data = JSON.parse(trimmed) as CocExportData;
  } catch {
    return { ok: false, error: 'Invalid JSON. Copy the full export text and try again.' };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'The pasted text is not a JSON object.' };
  }
  if (!Array.isArray(data.buildings)) {
    return { ok: false, error: 'This does not look like a Clash of Clans JSON Export (missing the "buildings" array).' };
  }
  return { ok: true, data };
}

export function cocExportToBuildingLevels(data: CocExportData): CocImportResult {
  const byStore = new Map<string, CocImportItem>();
  const skipped = new Map<string, CocImportItem>();
  const crafted: CocCraftedDefense[] = [];
  const unresolved: CocImportResult['unresolved'] = [];

  const ingest = (entry: CocExportEntry, idMap: Record<number, string>, builderBase: boolean) => {
    // The Crafting Station carries no `lvl` of its own — it reports the crafted
    // defenses it has produced under `types[]`. Decode those here and keep the
    // station itself out of the level tables, so no row is built from a missing
    // level.
    const types = entry.types;
    if (Array.isArray(types)) {
      for (const type of types) {
        const name = COC_CRAFTED_DEFENSE_IDS[type.data];
        if (!name) {
          unresolved.push({ dataId: type.data, level: 0, copies: 1 });
          continue;
        }
        const modules = (type.modules ?? []).map((m) => ({
          name: COC_CRAFTED_MODULE_IDS[m.data] ?? `Module ${m.data}`,
          level: finiteLvl(m.lvl),
        }));
        crafted.push({
          displayName: name,
          dataId: type.data,
          modules,
          level: Math.max(0, ...modules.map((m) => m.level)),
        });
      }
      return;
    }
    const copies = entry.cnt ?? 1;
    const hasTimer = typeof entry.timer === 'number' && entry.timer > 0;
    // A building row with `lvl` + `cnt` packs the level distribution; timer rows
    // are one copy each (stuck/upgrading) described individually.
    const effectiveLvl = finiteLvl(entry.lvl);
    const rawName = idMap[entry.data];
    if (!rawName) {
      unresolved.push({ dataId: entry.data, level: effectiveLvl, copies });
      return;
    }
    const displayName = builderBase ? toBuilderStoreName(rawName) : rawName;
    const storeName = toStoreName(displayName);
    if (!TRACKED.has(storeName)) {
      const prev = skipped.get(storeName);
      const levels = [...(prev?.levels ?? []), ...new Array<number>(copies).fill(effectiveLvl)];
      const timerRows = [
        ...(prev?.timerRows ?? []),
        ...(hasTimer ? [{ level: effectiveLvl, remainingSec: entry.timer as number }] : []),
      ];
      skipped.set(storeName, {
        storeName,
        displayName,
        level: Math.max(prev?.level ?? 0, effectiveLvl),
        levels,
        copies: (prev?.copies ?? 0) + copies,
        timerRows,
      });
      return;
    }
    const prev = byStore.get(storeName);
    const levels = [...(prev?.levels ?? []), ...new Array<number>(copies).fill(effectiveLvl)];
    const timerRows = [
      ...(prev?.timerRows ?? []),
      ...(hasTimer ? [{ level: effectiveLvl, remainingSec: entry.timer as number }] : []),
    ];
    byStore.set(storeName, {
      storeName,
      displayName,
      level: Math.max(prev?.level ?? 0, effectiveLvl),
      levels,
      copies: (prev?.copies ?? 0) + copies,
      timerRows,
    });
  };

  for (const entry of data.buildings ?? []) ingest(entry, COC_HOME_BUILDING_IDS, false);
  for (const entry of data.traps ?? []) ingest(entry, COC_HOME_BUILDING_IDS, false);
  for (const entry of data.buildings2 ?? []) ingest(entry, COC_BUILDER_BUILDING_IDS, true);
  for (const entry of data.traps2 ?? []) ingest(entry, COC_BUILDER_BUILDING_IDS, true);

  const resolved = [...byStore.values()].sort((a, b) => a.storeName.localeCompare(b.storeName));
  const levels: Record<string, number> = {};
  for (const item of resolved) levels[item.storeName] = item.level;

  return {
    levels,
    resolved,
    skipped: [...skipped.values()].sort((a, b) => a.storeName.localeCompare(b.storeName)),
    crafted,
    unresolved,
  };
}

/** How many Builder Huts the export describes, for useBuilderCount.
 *
 *  The export lists one Builder Hut row per copy (packed as `cnt`), so the copy
 *  count is the player's hut count - 4 for `{"data":1000015,"lvl":1,"cnt":4}`.
 *  Returns null when the export carries no Builder Hut row, or a count outside
 *  the 2-6 range the app stores (6 = O.T.T.O.), so callers can tell "unknown"
 *  apart from a detected value. */
export function detectBuilderHutCount(result: CocImportResult): number | null {
  const huts = result.resolved.find((r) => r.storeName === 'Builder Hut');
  if (!huts) return null;
  return huts.copies >= 2 && huts.copies <= 6 ? huts.copies : null;
}
