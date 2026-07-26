import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_DATA = 'th_levels_data';
const CACHE_KEY_HASHES = 'th_levels_hashes';
const CACHE_KEY_META = 'th_levels_meta';
const URL = 'https://www.clash.ninja/guides/max-levels-for-each-th';

interface ThLevelInfo {
  level: number | null;
  isMaxLevel: boolean;
}

export interface ThLevelsData {
  source_url: string;
  scraped_at: string;
  categories: Record<string, Record<string, Record<number, ThLevelInfo>>>;
}

interface SectionHashes {
  [categoryName: string]: string;
}

interface CacheMeta {
  scraped_at: string;
  sectionHashes: SectionHashes;
}

function hashStr(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return (hash >>> 0).toString(36);
}

function extractSectionHtmls(fullHtml: string): Map<string, string> {
  const sections = new Map<string, string>();
  const regex = /<h3[^>]*id="cphBody_ctl[^"]*"[^>]*>([\s\S]*?)<\/h3>\s*<div[^>]*class="cell"[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = regex.exec(fullHtml)) !== null) {
    const h3Content = match[1];
    const cellContent = match[2];
    const nameMatch = h3Content.match(/>([^<]+)</);
    const name = nameMatch ? nameMatch[1].trim() : '';
    if (name) {
      sections.set(name, match[0]);
    }
  }
  return sections;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function parseSection(cellHtml: string): Record<string, Record<number, ThLevelInfo>> {
  const items: Record<string, Record<number, ThLevelInfo>> = {};

  const tableMatch = cellHtml.match(/<table[^>]*class="[^"]*all-th-overview[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return items;
  const tableHtml = tableMatch[1];

  const rows: string[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    rows.push(rowMatch[1]);
  }
  if (rows.length < 2) return items;

  const headerCells: string[] = [];
  const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  let hcMatch;
  while ((hcMatch = headerRegex.exec(rows[0])) !== null) {
    headerCells.push(hcMatch[1]);
  }

  const thNumbers: number[] = [];
  for (let i = 2; i < headerCells.length; i++) {
    const n = parseInt(stripTags(headerCells[i]), 10);
    if (!Number.isNaN(n)) thNumbers.push(n);
  }

  for (let r = 1; r < rows.length; r++) {
    const cells: { html: string; classes: string[] }[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rows[r])) !== null) {
      const attrs = cellMatch[0].match(/<t[dh]([^>]*)>/i);
      const classes = attrs ? (attrs[1].match(/class="([^"]*)"/)?.[1]?.split(/\s+/) ?? []) : [];
      cells.push({ html: cellMatch[1], classes });
    }

    const itemName = stripTags(cells[0]?.html ?? '');
    if (!itemName) continue;

    const levels: Record<number, ThLevelInfo> = {};
    const dataCells = cells.slice(2);
    dataCells.forEach((cell, i) => {
      const thNum = thNumbers[i];
      if (thNum === undefined) return;
      const raw = stripTags(cell.html);
      const isLocked = cell.classes.includes('locked') || raw === '-' || raw === '';
      const isMax = cell.classes.includes('max');
      const parsed = parseInt(raw, 10);
      levels[thNum] = {
        level: isLocked || Number.isNaN(parsed) ? null : parsed,
        isMaxLevel: isMax,
      };
    });
    items[itemName] = levels;
  }

  return items;
}

async function fetchHtml(): Promise<string> {
  const res = await fetch(URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`clash.ninja fetch failed: ${res.status}`);
  return res.text();
}

export async function getThLevelsData(bypassCache = false): Promise<ThLevelsData> {
  const now = Date.now();

  let cachedMeta: CacheMeta | null = null;
  let cachedData: ThLevelsData | null = null;

  if (!bypassCache) {
    try {
      const [metaRaw, dataRaw] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY_META),
        AsyncStorage.getItem(CACHE_KEY_DATA),
      ]);
      if (metaRaw && dataRaw) {
        cachedMeta = JSON.parse(metaRaw);
        cachedData = JSON.parse(dataRaw);

        const age = now - new Date(cachedMeta!.scraped_at).getTime();
        if (age < 60 * 60 * 1000) return cachedData!;
      }
    } catch {}
  }

  const html = await fetchHtml();

  const sections = extractSectionHtmls(html);
  const newHashes: SectionHashes = {};
  for (const [name, sectionHtml] of sections) {
    newHashes[name] = hashStr(sectionHtml);
  }

  if (cachedData && cachedMeta && !bypassCache) {
    const oldHashes = cachedMeta.sectionHashes;
    const allMatch = Object.keys(newHashes).length === Object.keys(oldHashes).length &&
      Object.entries(newHashes).every(([k, v]) => oldHashes[k] === v);

    if (allMatch) {
      cachedData.scraped_at = new Date().toISOString();
      await Promise.all([
        AsyncStorage.setItem(CACHE_KEY_META, JSON.stringify({ ...cachedMeta, scraped_at: cachedData.scraped_at })),
        AsyncStorage.setItem(CACHE_KEY_DATA, JSON.stringify(cachedData)),
      ]);
      return cachedData;
    }
  }

  const categories: Record<string, Record<string, Record<number, ThLevelInfo>>> = {};

  for (const [name, sectionHtml] of sections) {
    if (cachedData && cachedMeta && cachedMeta.sectionHashes[name] === newHashes[name] && cachedData.categories[name]) {
      categories[name] = cachedData.categories[name];
      continue;
    }
    const items = parseSection(sectionHtml);
    if (Object.keys(items).length) categories[name] = items;
  }

  const result: ThLevelsData = {
    source_url: URL,
    scraped_at: new Date().toISOString(),
    categories,
  };

  await Promise.all([
    AsyncStorage.setItem(CACHE_KEY_DATA, JSON.stringify(result)),
    AsyncStorage.setItem(CACHE_KEY_HASHES, JSON.stringify(newHashes)),
    AsyncStorage.setItem(CACHE_KEY_META, JSON.stringify({ scraped_at: result.scraped_at, sectionHashes: newHashes })),
  ]);

  return result;
}

export async function clearThLevelsCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CACHE_KEY_DATA, CACHE_KEY_HASHES, CACHE_KEY_META]);
  } catch {}
}
