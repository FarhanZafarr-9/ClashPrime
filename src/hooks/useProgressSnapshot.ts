import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'clashprime_progress_';

export type ProgressCategory = 'heroes' | 'troops' | 'spells' | 'equipment' | 'builderTroops' | 'builderHeroes';

export interface ProgressSnapshot {
  timestamp: number;
  /** Town Hall level at capture time. Optional: snapshots taken before this
   *  existed have no value, and those are treated as "unknown" rather than 0. */
  townHall?: number;
  categories: Record<ProgressCategory, number>;
  items: Record<ProgressCategory, Record<string, number>>;
}

export interface ProgressDiff {
  since: number;
  /** Town Hall change, or null when either side never recorded one. */
  townHall: { before: number; after: number } | null;
  categories: { key: ProgressCategory; before: number; after: number }[];
  levelUps: { key: ProgressCategory; name: string; before: number; after: number }[];
  hasChanges: boolean;
}

export async function loadProgressSnapshot(tag: string): Promise<ProgressSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + tag);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProgressSnapshot;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.categories !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveProgressSnapshot(tag: string, snapshot: ProgressSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + tag, JSON.stringify(snapshot));
  } catch {}
}

export function diffProgress(before: ProgressSnapshot, after: ProgressSnapshot): ProgressDiff {
  const categories: ProgressDiff['categories'] = [];
  const levelUps: ProgressDiff['levelUps'] = [];
  const keys: ProgressCategory[] = ['heroes', 'troops', 'spells', 'equipment', 'builderTroops', 'builderHeroes'];

  for (const key of keys) {
    const b = before.categories[key] ?? 0;
    const a = after.categories[key] ?? 0;
    if (a - b > 0.001) categories.push({ key, before: b, after: a });

    const bItems = before.items[key] ?? {};
    const aItems = after.items[key] ?? {};
    for (const [name, level] of Object.entries(aItems)) {
      const prev = bItems[name];
      if (prev !== undefined && level > prev) {
        levelUps.push({ key, name, before: prev, after: level });
      }
    }
  }

  levelUps.sort((x, y) => y.after - x.after);
  // Only a real Town Hall jump counts. An old snapshot with no recorded level is
  // unknown, not zero - treating it as 0 would report a bogus upgrade the first
  // time an existing user refreshed.
  const townHall =
    typeof before.townHall === 'number' && typeof after.townHall === 'number' && after.townHall > before.townHall
      ? { before: before.townHall, after: after.townHall }
      : null;
  return {
    since: before.timestamp,
    townHall,
    categories,
    levelUps,
    hasChanges: townHall !== null || categories.length > 0 || levelUps.length > 0,
  };
}
