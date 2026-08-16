// Decodes a Clash of Clans JSON Export snapshot (the format produced by the
// "Clash of Clans JSON Export" app) into building-level records the app can
// apply via setBulkLevels. Home Village buildings and traps are supported.

import { COC_HOME_BUILDING_IDS } from '../data/cocBuildingIds';
import { toStoreName } from './buildingCopies';
import { HOME_CATEGORIES } from './buildingData';

export interface CocExportEntry {
  data: number;
  lvl: number;
  timer?: number;
  cnt?: number;
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
  /** How many copies were present in the export. */
  copies: number;
}

export interface CocImportResult {
  /** storeName → representative level, ready for setBulkLevels. */
  levels: Record<string, number>;
  /** Buildings the app tracks (Home Village buildings + traps). */
  resolved: CocImportItem[];
  /** Resolved by ID but not tracked by the app (e.g. Town Hall). */
  skipped: CocImportItem[];
  /** dataIds with no mapping. */
  unresolved: { dataId: number; level: number; copies: number }[];
}

/** Every building the app stores levels for (HOME_CATEGORIES values are store names). */
const TRACKED = new Set<string>(Object.values(HOME_CATEGORIES).flat());

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
  const unresolved: CocImportResult['unresolved'] = [];

  const ingest = (entry: CocExportEntry) => {
    const copies = entry.cnt ?? 1;
    const displayName = COC_HOME_BUILDING_IDS[entry.data];
    if (!displayName) {
      unresolved.push({ dataId: entry.data, level: entry.lvl, copies });
      return;
    }
    const storeName = toStoreName(displayName);
    if (!TRACKED.has(storeName)) {
      const prev = skipped.get(storeName);
      skipped.set(storeName, {
        storeName,
        displayName,
        level: Math.max(prev?.level ?? 0, entry.lvl),
        copies: (prev?.copies ?? 0) + copies,
      });
      return;
    }
    const prev = byStore.get(storeName);
    byStore.set(storeName, {
      storeName,
      displayName,
      level: Math.max(prev?.level ?? 0, entry.lvl),
      copies: (prev?.copies ?? 0) + copies,
    });
  };

  for (const entry of data.buildings ?? []) ingest(entry);
  for (const entry of data.traps ?? []) ingest(entry);

  const resolved = [...byStore.values()].sort((a, b) => a.storeName.localeCompare(b.storeName));
  const levels: Record<string, number> = {};
  for (const item of resolved) levels[item.storeName] = item.level;

  return {
    levels,
    resolved,
    skipped: [...skipped.values()].sort((a, b) => a.storeName.localeCompare(b.storeName)),
    unresolved,
  };
}
