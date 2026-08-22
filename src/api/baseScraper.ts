import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScrapedBase, ScrapeResult, Village } from '../types/bases';

const CLASHLY_API = 'https://api.clashly.app';
const CLASHLY_APP_ID = '923673396b6e8649e9ed06ea63a3828f';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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
}

function cacheKey(village: Village, level: number): string {
  const prefix = village === 'home' ? 'bases_clashly_th_' : 'bases_clashly_bh_';
  return `${prefix}${level}`;
}

function hallPrefix(village: Village): string {
  return village === 'home' ? 'th' : 'bh';
}

async function getCached(village: Village, level: number): Promise<ScrapeResult | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(village, level));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

async function setCache(village: Village, level: number, data: ScrapeResult): Promise<void> {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
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
    views_raw: formatNumber(layout.downloadCount),
    tags: [mapBaseTag(layout.baseTag)],
    votes: layout.votes,
    hotScore: layout.hotScore,
    recentDownloads: layout.recentDownloads,
  };
}

async function scrapeBases(
  village: Village,
  level: number,
  _opts: { maxPages?: number; skipDetail?: boolean } = {}
): Promise<ScrapeResult> {
  const cached = await getCached(village, level);
  if (cached) return cached;

  const label = hallPrefix(village).toUpperCase();

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

  const bases = allLayouts.map((l) => layoutToBase(l, level, village));

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
  opts: { maxPages?: number; skipDetail?: boolean } = {}
): Promise<ScrapeResult> {
  return scrapeBases('home', thLevel, opts);
}

export async function scrapeBasesForBH(
  bhLevel: number,
  opts: { maxPages?: number; skipDetail?: boolean } = {}
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
