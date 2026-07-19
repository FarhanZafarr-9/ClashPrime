import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScrapedBase, ScrapeResult } from '../types/bases';

const CLASHLY_API = 'https://api.clashly.app';
const CLASHLY_APP_ID = '923673396b6e8649e9ed06ea63a3828f';
const CACHE_PREFIX = 'bases_clashly_th_';
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

async function getCached(thLevel: number): Promise<ScrapeResult | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${thLevel}`);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

async function setCache(thLevel: number, data: ScrapeResult): Promise<void> {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${thLevel}`, JSON.stringify(entry));
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

function layoutToBase(layout: ClashLyLayout, thLevel: number): ScrapedBase {
  const dateStr = layout.uploadedAt?.iso || '';
  const year = dateStr ? new Date(dateStr).getFullYear() : null;

  return {
    id: layout.objectId,
    type: layout.baseTag,
    th_level: thLevel,
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

export async function scrapeBasesForTH(
  thLevel: number,
  _opts: { maxPages?: number; skipDetail?: boolean } = {}
): Promise<ScrapeResult> {
  const cached = await getCached(thLevel);
  if (cached) return cached;

  console.log(`[BaseScraper] Fetching TH${thLevel} from ClashLy...`);

  const allLayouts: ClashLyLayout[] = [];
  let skip = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const where = JSON.stringify({ hallLevel: `th${thLevel}` });
    const url = `${CLASHLY_API}/classes/Layout?where=${where}&limit=${limit}&skip=${skip}&order=-hotScore&keys=objectId,image,hallLevel,baseTag,shareUrl,downloadCount,votes,hotScore,recentDownloads,velocity,uploadedAt,refreshedAt`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`ClashLy API error: ${res.status}`);

    const data = await res.json();
    const results: ClashLyLayout[] = data.results || [];
    allLayouts.push(...results);

    if (results.length < limit) hasMore = false;
    else skip += limit;
  }

  const bases = allLayouts.map((l) => layoutToBase(l, thLevel));

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
    th_level: thLevel,
    scraped_at: new Date().toISOString(),
    total_bases: bases.length,
    groups,
  };

  await setCache(thLevel, result);
  console.log(`[BaseScraper] TH${thLevel}: ${bases.length} bases from ClashLy`);
  return result;
}

export async function clearBaseCache(thLevel?: number): Promise<void> {
  if (thLevel) {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${thLevel}`);
  } else {
    const keys = await AsyncStorage.getAllKeys();
    const baseKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(baseKeys);
  }
}
