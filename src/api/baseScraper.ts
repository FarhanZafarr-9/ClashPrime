import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScrapedBase, ScrapeResult, Village } from '../types/bases';
import { getClashBasesForTH, layoutPayload, type ClashBasesEntry } from './clashBases';

/**
 * Base Library data layer. Home Village snapshots merge two independent
 * catalogues — ClashLy's live API (popularity metrics, Builder Base coverage is
 * ClashLy-only) and the static clash-bases catalogue (names, descriptions,
 * builder credits, tags) — deduplicated by OpenLayout payload. Snapshots are
 * cached per village/hall, so the merge runs at most once per TTL.
 */
const CLASHLY_API = 'https://api.clashly.app';
const CLASHLY_APP_ID = '923673396b6e8649e9ed06ea63a3828f';
// Snapshots are trusted for three days. Anything older is still painted first (so
// navigation never shows a skeleton) but is refetched in the background.
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const HEADERS = {
  'X-Parse-Application-Id': CLASHLY_APP_ID,
  'Accept': 'application/json',
};

interface ClashLyLayout {
  objectId: string;
  image: { __type: string; name: string; url: string };
  hallLevel: string;
  baseTag: string;
  shareUrl: string;
  downloadCount: number;
  votes: number;
  hotScore: number;
  recentDownloads: number;
  velocity: number;
  uploadedAt: { __type: string; iso: string };
  refreshedAt: { __type: string; iso: string };
}

interface CacheEntry {
  data: ScrapeResult;
  timestamp: number;
  /** Stored so a snapshot can be checked without walking every group. */
  count?: number;
}

export interface BaseSnapshot {
  data: ScrapeResult;
  timestamp: number;
  count: number;
}

function cacheKey(village: Village, level: number): string {
  const prefix = village === 'home' ? 'bases_clashly_th_' : 'bases_clashly_bh_';
  return `${prefix}${level}`;
}

function hallPrefix(village: Village): string {
  return village === 'home' ? 'th' : 'bh';
}

function countOf(data: ScrapeResult): number {
  if (typeof data.total_bases === 'number') return data.total_bases;
  return Object.values(data.groups ?? {}).reduce((n, group) => n + group.length, 0);
}

/**
 * Layouts stored without a preview url can only ever render the placeholder, so they
 * are dropped from the snapshot. This happens with snapshots written by older builds
 * or by scrapes where the layout carried no image, and it makes the snapshot fail the
 * isBaseCacheUsable count check so the list is refetched with usable layouts.
 */
function withoutImagelessBases(data: ScrapeResult): { data: ScrapeResult; dropped: number } {
  const groups: Record<string, ScrapedBase[]> = {};
  let kept = 0;
  let dropped = 0;

  for (const [tag, list] of Object.entries(data.groups ?? {})) {
    const usable = list.filter((base) => !!base.preview_image_url);
    dropped += list.length - usable.length;
    if (usable.length === 0) continue;
    groups[tag] = usable;
    kept += usable.length;
  }

  if (dropped === 0) return { data, dropped };
  return { data: { ...data, groups, total_bases: kept }, dropped };
}

/**
 * Reads the stored snapshot with no freshness check, so a screen can paint the
 * cached layouts on navigation and reconcile with the network afterwards.
 */
export async function getCachedBases(village: Village, level: number): Promise<BaseSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(village, level));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (!entry?.data) return null;
    const { data, dropped } = withoutImagelessBases(entry.data);
    return {
      data,
      timestamp: entry.timestamp ?? 0,
      count: dropped > 0 ? countOf(data) : entry.count ?? countOf(data),
    };
  } catch {
    return null;
  }
}

/**
 * A snapshot can be served as-is when it is younger than the TTL and already
 * holds at least as many layouts as the screen is asking for. Anything else is
 * still painted first, but must be refetched.
 */
export function isBaseCacheUsable(snapshot: BaseSnapshot | null, minItems: number): boolean {
  if (!snapshot) return false;
  if (Date.now() - snapshot.timestamp >= CACHE_TTL_MS) return false;
  return snapshot.count >= minItems;
}

async function setCache(village: Village, level: number, data: ScrapeResult): Promise<void> {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now(), count: countOf(data) };
    await AsyncStorage.setItem(cacheKey(village, level), JSON.stringify(entry));
  } catch {}
}

function mapBaseTag(tag: string): string {
  const map: Record<string, string> = {
    war: 'War',
    trophy: 'Trophy',
    farming: 'Farming',
    hybrid: 'Hybrid',
    cwl: 'CWL',
    funny: 'Funny',
    builder: 'Builder',
  };
  return map[tag] || tag.charAt(0).toUpperCase() + tag.slice(1);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function layoutToBase(layout: ClashLyLayout, level: number, village: Village): ScrapedBase {
  const dateStr = layout.uploadedAt?.iso || '';
  const year = dateStr ? new Date(dateStr).getFullYear() : null;

  return {
    id: layout.objectId,
    type: layout.baseTag,
    th_level: level,
    village,
    title: `${mapBaseTag(layout.baseTag)} Base`,
    detail_url: layout.shareUrl,
    preview_image_url: layout.image?.url || '',
    full_image_url: layout.image?.url || null,
    game_copy_link: layout.shareUrl || null,
    has_link: !!layout.shareUrl,
    year,
    updated: false,
    rating_out_of_5: 0,
    views: layout.downloadCount,
    views_raw: layout.downloadCount > 0 ? formatNumber(layout.downloadCount) : '',
    tags: withoutCategoryTag([mapBaseTag(layout.baseTag)], layout.baseTag),
    votes: layout.votes,
    hotScore: layout.hotScore,
    recentDownloads: layout.recentDownloads,
    source: 'clashly',
  };
}

/** clash-bases type labels lowercased into the tags the Bases tab groups by. */
const CLASH_BASES_TYPE_MAP: Record<string, string> = {
  War: 'war',
  Trophy: 'trophy',
  Farm: 'farming',
  Hybrid: 'hybrid',
  Progress: 'progress',
  Fun: 'funny',
  'Home Village': 'general',
};

/** Display label per stored type — the shapes CATEGORY_MAP in bases.tsx maps onto. */
const TYPE_LABELS: Record<string, string> = {
  war: 'War',
  trophy: 'Trophy',
  farming: 'Farming',
  hybrid: 'Hybrid',
  cwl: 'CWL',
  funny: 'Funny',
  builder: 'Builder',
  progress: 'Progress',
  general: 'Home Village',
};

/**
 * Drops tags that merely restate the base's own category — inside the War pill
 * a "war" chip on every card says nothing. Signal tags stay: cross-category
 * tags ("war" on a Hybrid base), style tags (anti-3-star, fwa) and everything
 * else the catalogue thought worth recording.
 */
function withoutCategoryTag(tags: string[], type: string): string[] {
  const label = (TYPE_LABELS[type] ?? type).toLowerCase();
  return tags.filter((t) => {
    const low = t.toLowerCase();
    return low !== type && low !== label;
  });
}

function clashBasesEntryToBase(entry: ClashBasesEntry, level: number): ScrapedBase {
  const addedYear = entry.added ? new Date(entry.added).getFullYear() : NaN;
  const type = CLASH_BASES_TYPE_MAP[entry.type] ?? 'general';
  return {
    id: `clash-bases-${entry.id}`,
    type,
    th_level: level,
    village: 'home',
    title: entry.name,
    detail_url: entry.link,
    preview_image_url: entry.image,
    full_image_url: entry.image,
    game_copy_link: entry.link,
    has_link: true,
    year: Number.isNaN(addedYear) ? null : addedYear,
    updated: false,
    rating_out_of_5: 0,
    views: 0,
    views_raw: '',
    tags: withoutCategoryTag(entry.tags ?? [], type),
    source: 'clash-bases',
    description: entry.description || null,
    builder: entry.builder || null,
  };
}

/**
 * Merges the clash-bases catalogue into the ClashLy results for one Home Village
 * hall. The two sources are independent (clash-bases mirrors cocbases.com,
 * basemelon.com and blueprintcoc.com, not ClashLy), so overlap is small but real:
 * when the same layout appears in both — identical OpenLayout payload — the
 * ClashLy record is kept for its live download/vote metrics and enriched with
 * the clash-bases presentation (name, description, builder credit, tags).
 * Builder Base stays ClashLy-only; clash-bases has no BH coverage.
 */
async function mergeWithClashBases(
  clashlyBases: ScrapedBase[],
  level: number
): Promise<ScrapedBase[]> {
  let entries: ClashBasesEntry[];
  try {
    entries = await getClashBasesForTH(level);
  } catch {
    return clashlyBases;
  }

  const byPayload = new Map<string, ScrapedBase>();
  const deduped: ScrapedBase[] = [];
  for (const base of clashlyBases) {
    const payload = layoutPayload(base.detail_url);
    if (payload) {
      // ClashLy itself re-lists the same layout occasionally (identical
      // OpenLayout payload); the first occurrence is the highest-hotScore one
      // thanks to the pagination order, so later dupes are dropped.
      if (byPayload.has(payload)) continue;
      byPayload.set(payload, base);
    }
    deduped.push(base);
  }

  const seen = new Set(byPayload.keys());
  const merged = [...deduped];
  for (const entry of entries) {
    const payload = layoutPayload(entry.link);
    const existing = payload ? byPayload.get(payload) : undefined;
    if (existing) {
      existing.title = entry.name;
      existing.description = entry.description || null;
      existing.builder = entry.builder || null;
      existing.tags = withoutCategoryTag(
        [...new Set([...(existing.tags ?? []), ...(entry.tags ?? [])])],
        existing.type
      );
      continue;
    }
    if (payload) {
      if (seen.has(payload)) continue;
      seen.add(payload);
    }
    merged.push(clashBasesEntryToBase(entry, level));
  }
  return merged;
}

async function scrapeBases(
  village: Village,
  level: number,
  opts: { minItems?: number; bypass?: boolean } = {}
): Promise<ScrapeResult> {
  if (!opts.bypass) {
    const snapshot = await getCachedBases(village, level);
    if (isBaseCacheUsable(snapshot, opts.minItems ?? 0)) return snapshot!.data;
  }

  const allLayouts: ClashLyLayout[] = [];
  let skip = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const where = JSON.stringify({ hallLevel: `${hallPrefix(village)}${level}` });
    const url = `${CLASHLY_API}/classes/Layout?where=${where}&limit=${limit}&skip=${skip}&order=-hotScore&keys=objectId,image,hallLevel,baseTag,shareUrl,downloadCount,votes,hotScore,recentDownloads,velocity,uploadedAt,refreshedAt`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`ClashLy API error: ${res.status}`);

    const data = await res.json();
    const results: ClashLyLayout[] = data.results || [];
    allLayouts.push(...results);

    if (results.length < limit) hasMore = false;
    else skip += limit;
  }

  const clashlyBases = allLayouts.map((l) => layoutToBase(l, level, village));
  const bases =
    village === 'home' ? await mergeWithClashBases(clashlyBases, level) : clashlyBases;

  const groups: Record<string, ScrapedBase[]> = {};
  for (const base of bases) {
    const key = base.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(base);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));
  }

  const result: ScrapeResult = {
    th_level: level,
    village,
    scraped_at: new Date().toISOString(),
    total_bases: bases.length,
    groups,
  };

  await setCache(village, level, result);
  return result;
}

export async function scrapeBasesForTH(
  thLevel: number,
  opts: { minItems?: number; bypass?: boolean } = {}
): Promise<ScrapeResult> {
  return scrapeBases('home', thLevel, opts);
}

export async function scrapeBasesForBH(
  bhLevel: number,
  opts: { minItems?: number; bypass?: boolean } = {}
): Promise<ScrapeResult> {
  return scrapeBases('builder', bhLevel, opts);
}

export async function clearBaseCache(village?: Village, level?: number): Promise<void> {
  if (village && level) {
    await AsyncStorage.removeItem(cacheKey(village, level));
  } else {
    const keys = await AsyncStorage.getAllKeys();
    const baseKeys = keys.filter(
      (k) => k.startsWith('bases_clashly_th_') || k.startsWith('bases_clashly_bh_')
    );
    await AsyncStorage.multiRemove(baseKeys);
  }
}

/** Which catalogues the Bases tab shows for Home Village. */
export type BaseSourceFilter = 'both' | 'clashly' | 'clash-bases';

const SOURCE_FILTER_KEY = 'bases_source_pref';

export async function getStoredSourceFilter(): Promise<BaseSourceFilter> {
  try {
    const raw = await AsyncStorage.getItem(SOURCE_FILTER_KEY);
    return raw === 'clashly' || raw === 'clash-bases' ? raw : 'both';
  } catch {
    return 'both';
  }
}

export async function setStoredSourceFilter(filter: BaseSourceFilter): Promise<void> {
  try {
    await AsyncStorage.setItem(SOURCE_FILTER_KEY, filter);
  } catch {}
}
