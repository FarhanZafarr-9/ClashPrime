import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScrapedBase, ScrapeResult } from '../types/bases';

const BASE_URL = 'https://clashofclans-layouts.com';
const CACHE_PREFIX = 'bases_th_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const TYPE_MAP: Record<string, string> = { '0': 'defence', '1': 'farm', '2': 'war' };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseViews(raw: string): number {
  const s = raw.trim().replace(/,/g, '');
  if (s.endsWith('M')) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith('K')) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s, 10) || 0;
}

function attr(html: string, tag: string, name: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${name}=["']([^"']*)["']`, 'i');
  return html.match(re)?.[1] || '';
}

function between(html: string, start: string, end: string): string {
  const i = html.indexOf(start);
  if (i < 0) return '';
  const s = i + start.length;
  const e = html.indexOf(end, s);
  return e < 0 ? html.slice(s) : html.slice(s, e);
}

function parseListingHTML(html: string, thLevel: number): { bases: ScrapedBase[]; maxPage: number } {
  const bases: ScrapedBase[] = [];
  const items = html.split('base_grid_item');

  for (let i = 1; i < items.length; i++) {
    const item = items[i];

    const titleMatch = item.match(/<a\s+title=["']([^"']+)["'][^>]*href=["']([^"']+)["']/);
    if (!titleMatch) continue;
    const title = titleMatch[1];
    const href = titleMatch[2];

    const rawId = parseInt(between(item, 'name="base_id"', 'value="') || '0', 10);
    const id = rawId || (i * 1000 + bases.length);
    const typeCode = between(item, 'name="type"', 'value="') || '0';
    const widthMatch = item.match(/name="stars_width"[^>]*style="width:\s*(\d+)%/);
    const starsWidth = widthMatch ? parseInt(widthMatch[1], 10) : 0;

    const imgMatch = item.match(/class="base_grid_img"[^>]*src=["']([^"']+)["']/);
    const previewSrc = imgMatch?.[1] || '';

    const viewsMatch = item.match(/views_block_mg[\s\S]*?<div[^>]*>([^<]+)</);
    const viewsRaw = viewsMatch?.[1]?.trim() || '0';

    const hasLink = item.includes('#217edd') || item.includes('with Link');
    const yearMatch = item.match(/(20\d{2})/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
    const updated = item.includes('Base Updated') || item.includes('NEW');

    const tagMatches = [...item.matchAll(/title="Tag\s+([^"]+)"/g)];
    const tags = tagMatches.map((m) => m[1]);

    bases.push({
      id,
      type: TYPE_MAP[typeCode] || 'defence',
      th_level: thLevel,
      title,
      detail_url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
      preview_image_url: previewSrc.startsWith('http') ? previewSrc : `${BASE_URL}${previewSrc}`,
      full_image_url: null,
      game_copy_link: null,
      has_link: hasLink,
      year,
      updated,
      rating_out_of_5: Math.round((starsWidth / 20) * 10) / 10,
      views: parseViews(viewsRaw),
      views_raw: viewsRaw,
      tags,
    });
  }

  let maxPage = 1;
  const pageMatches = [...html.matchAll(/page_(\d+)\//g)];
  for (const m of pageMatches) {
    const n = parseInt(m[1], 10);
    if (n > maxPage) maxPage = n;
  }

  return { bases, maxPage };
}

function parseDetailHTML(html: string): { full_image_url: string | null; game_copy_link: string | null; tags: string[] } {
  let full_image_url: string | null = null;
  const imgMatch = html.match(/data-fancybox="images"[^>]*href=["']([^"']+)["']/);
  if (imgMatch) {
    full_image_url = imgMatch[1].startsWith('http') ? imgMatch[1] : `${BASE_URL}${imgMatch[1]}`;
  }

  let game_copy_link: string | null = null;
  const linkMatch = html.match(/href="(https:\/\/link\.clashofclans\.com[^"]+)"/);
  if (linkMatch) game_copy_link = linkMatch[1];

  const tags = [...html.matchAll(/title="Tag\s+([^"]+)"/g)].map((m) => m[1]);

  return { full_image_url, game_copy_link, tags };
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

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function scrapeBasesForTH(
  thLevel: number,
  opts: { maxPages?: number; skipDetail?: boolean } = {}
): Promise<ScrapeResult> {
  const { maxPages = 2, skipDetail = false } = opts;

  const cached = await getCached(thLevel);
  if (cached) return cached;

  console.log(`[BaseScraper] Fetching TH${thLevel}...`);
  const baseUrl = `${BASE_URL}/plans/th_${thLevel}/`;

  const page1Html = await fetchHTML(baseUrl);
  const { bases: page1Bases, maxPage } = parseListingHTML(page1Html, thLevel);
  const pagesToCrawl = Math.min(maxPages, maxPage);

  let allBases = [...page1Bases];
  for (let p = 2; p <= pagesToCrawl; p++) {
    await sleep(1200);
    try {
      const html = await fetchHTML(`${baseUrl}page_${p}/`);
      const { bases } = parseListingHTML(html, thLevel);
      if (bases.length === 0) break;
      allBases = allBases.concat(bases);
    } catch {}
  }

  if (!skipDetail && allBases.length > 0) {
    const toFetch = allBases.slice(0, 12);
    for (let i = 0; i < toFetch.length; i++) {
      await sleep(1200);
      try {
        const html = await fetchHTML(toFetch[i].detail_url);
        const detail = parseDetailHTML(html);
        toFetch[i].full_image_url = detail.full_image_url;
        toFetch[i].game_copy_link = detail.game_copy_link;
        if (detail.tags.length > 0) toFetch[i].tags = detail.tags;
      } catch {}
    }
  }

  const groups: Record<string, ScrapedBase[]> = {};
  for (const base of allBases) {
    if (!groups[base.type]) groups[base.type] = [];
    groups[base.type].push(base);
  }
  for (const t of Object.keys(groups)) {
    groups[t].sort((a, b) => b.rating_out_of_5 - a.rating_out_of_5 || b.views - a.views);
  }

  const result: ScrapeResult = {
    th_level: thLevel,
    scraped_at: new Date().toISOString(),
    total_bases: allBases.length,
    groups,
  };

  await setCache(thLevel, result);
  console.log(`[BaseScraper] TH${thLevel}: ${allBases.length} bases scraped`);
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
