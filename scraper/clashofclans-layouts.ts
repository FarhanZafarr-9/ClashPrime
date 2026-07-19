import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://clashofclans-layouts.com';
const TYPE_MAP: Record<string, string> = { '0': 'defence', '1': 'farm', '2': 'war' };
const DELAY_MS = 1500;

export interface ScrapedBase {
  id: number;
  type: string;
  th_level: number;
  title: string;
  detail_url: string;
  preview_image_url: string;
  full_image_url: string | null;
  game_copy_link: string | null;
  has_link: boolean;
  year: number | null;
  updated: boolean;
  rating_out_of_5: number;
  views: number;
  views_raw: string;
  tags: string[];
}

export interface ScrapeResult {
  th_level: number;
  scraped_at: string;
  total_bases: number;
  groups: Record<string, ScrapedBase[]>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 500));
}

function parseViews(raw: string): number {
  const s = raw.trim().replace(/,/g, '');
  if (s.endsWith('M')) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith('K')) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s, 10) || 0;
}

async function fetchHTML(url: string, retries = 3): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e: any) {
      console.error(`  [retry ${attempt}/${retries}] ${url}: ${e.message}`);
      if (attempt === retries) throw e;
      await sleep(2000 * attempt);
    }
  }
  throw new Error('unreachable');
}

function parseListingPage(html: string, thLevel: number): { bases: Partial<ScrapedBase>[]; maxPage: number } {
  const $ = cheerio.load(html);
  const bases: Partial<ScrapedBase>[] = [];

  $('div.base_grid_item').each((_, el) => {
    const $el = $(el);
    const $a = $el.find('a[title]').first();
    const title = $a.attr('title') || '';
    const href = $a.attr('href') || '';

    const id = parseInt($el.find('input[name="base_id"]').attr('value') || '0', 10);
    const typeCode = $el.find('input[name="type"]').attr('value') || '0';
    const starsWidth = parseInt(
      ($el.find('input[name="stars_width"]').attr('style') || '').match(/width:\s*(\d+)/)?.[1] || '0',
      10
    );

    const previewSrc = $el.find('img.base_grid_img').attr('src') || '';
    const viewsRaw = $el.find('.views_block_mg div').text().trim();

    const labels = $el.find('.label_std');
    let hasLink = false;
    let year: number | null = null;
    let updated = false;

    labels.each((_, lbl) => {
      const text = $(lbl).text().trim();
      const bg = $(lbl).attr('style') || '';
      if (text === 'with Link' || bg.includes('#217edd')) hasLink = true;
      if (bg.includes('#ff753d') || bg.includes('#ff9121')) {
        const yearMatch = text.match(/(20\d{2})/);
        if (yearMatch) year = parseInt(yearMatch[1], 10);
        if ($(lbl).find('img[title="Base Updated"]').length > 0) updated = true;
        if (text === 'NEW') { year = year || new Date().getFullYear(); updated = true; }
      }
    });

    bases.push({
      id,
      type: TYPE_MAP[typeCode] || 'defence',
      th_level: thLevel,
      title,
      detail_url: href ? `${BASE_URL}${href}` : '',
      preview_image_url: previewSrc ? `${BASE_URL}${previewSrc}` : '',
      has_link: hasLink,
      year,
      updated,
      rating_out_of_5: Math.round((starsWidth / 20) * 10) / 10,
      views_raw: viewsRaw,
      views: parseViews(viewsRaw),
      tags: [],
    });
  });

  let maxPage = 1;
  const pageLinks = $('div.pagination_pages .pages a');
  pageLinks.each((_, a) => {
    const num = parseInt($(a).text().trim(), 10);
    if (num > maxPage) maxPage = num;
  });

  return { bases, maxPage };
}

function parseDetailPage(html: string): { full_image_url: string | null; game_copy_link: string | null; tags: string[] } {
  const $ = cheerio.load(html);

  let full_image_url: string | null = null;
  const fancyboxA = $('a[data-fancybox="images"]').first();
  if (fancyboxA.length) {
    const href = fancyboxA.attr('href');
    if (href) full_image_url = href.startsWith('http') ? href : `${BASE_URL}${href}`;
  }

  let game_copy_link: string | null = null;
  $('a').each((_, a) => {
    const href = $(a).attr('href') || '';
    if (href.includes('link.clashofclans.com') && !game_copy_link) {
      game_copy_link = href;
    }
  });

  const tags: string[] = [];
  $('div.tags_block a').each((_, a) => {
    const text = $(a).text().trim();
    if (text) tags.push(text);
  });

  return { full_image_url, game_copy_link, tags };
}

export async function scrapeTH(thLevel: number, opts: { maxPages?: number; skipDetail?: boolean; outDir?: string } = {}): Promise<ScrapeResult> {
  const { maxPages, skipDetail = false, outDir } = opts;
  const baseUrl = `${BASE_URL}/plans/th_${thLevel}/`;
  const cacheDir = outDir ? path.join(outDir, '.cache') : null;

  console.log(`\n=== Scraping TH${thLevel} ===`);
  console.log(`Listing: ${baseUrl}`);

  const page1Html = await fetchHTML(baseUrl);
  const { bases: page1Bases, maxPage } = parseListingPage(page1Html, thLevel);
  const pagesToCrawl = maxPages ? Math.min(maxPages, maxPage) : maxPage;
  console.log(`Found ${pagesToCrawl} pages to crawl`);

  let allBases = [...page1Bases];
  for (let p = 2; p <= pagesToCrawl; p++) {
    const pageUrl = `${baseUrl}page_${p}/`;
    console.log(`  Page ${p}/${pagesToCrawl}...`);
    await sleep(DELAY_MS);
    const html = await fetchHTML(pageUrl);
    const { bases } = parseListingPage(html, thLevel);
    if (bases.length === 0) { console.log('  Empty page, stopping.'); break; }
    allBases = allBases.concat(bases);
  }

  console.log(`Phase 1 complete: ${allBases.length} bases collected`);

  if (!skipDetail && allBases.length > 0) {
    console.log(`\nPhase 2: Fetching detail pages...`);
    if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });

    for (let i = 0; i < allBases.length; i++) {
      const base = allBases[i];
      if (!base.detail_url) continue;

      const cacheFile = cacheDir ? path.join(cacheDir, `${base.id}.json`) : null;

      if (cacheFile && fs.existsSync(cacheFile)) {
        const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        Object.assign(base, cached);
        continue;
      }

      console.log(`  [${i + 1}/${allBases.length}] Base #${base.id}...`);
      await sleep(DELAY_MS);
      try {
        const html = await fetchHTML(base.detail_url);
        const detail = parseDetailPage(html);
        base.full_image_url = detail.full_image_url;
        base.game_copy_link = detail.game_copy_link;
        if (detail.tags.length > 0) base.tags = detail.tags;
        if (cacheFile) fs.writeFileSync(cacheFile, JSON.stringify(detail));
      } catch (e: any) {
        console.error(`    Failed: ${e.message}`);
      }
    }
    console.log('Phase 2 complete.');
  }

  const groups: Record<string, ScrapedBase[]> = {};
  for (const base of allBases) {
    const t = base.type || 'defence';
    if (!groups[t]) groups[t] = [];
    groups[t].push(base as ScrapedBase);
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

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `th_${thLevel}.json`);
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`\nWrote ${outFile}`);
  }

  return result;
}

export async function scrapeAllTH(levels: number[], opts: { maxPages?: number; skipDetail?: boolean; outDir?: string } = {}): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  for (const level of levels) {
    const r = await scrapeTH(level, opts);
    results.push(r);
    await sleep(DELAY_MS * 2);
  }
  return results;
}
