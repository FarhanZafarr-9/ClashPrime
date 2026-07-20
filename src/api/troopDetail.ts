import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTroopSlug, getHeroSlug, getPetSlug, getEquipmentSlug, getHeroImageUrl } from '../utils/troopImages';

const CACHE_PREFIX = 'troop_detail_v3_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Hero JSON API (served as static JSON by coc.guide, not CSR)
// ---------------------------------------------------------------------------

const COC_HEROES_JSON = 'https://coc.guide/static/json/heroes.json';

// Maps the CoC API hero names → coc.guide JSON keys
const HERO_JSON_KEYS: Record<string, string> = {
  'Barbarian King': 'Barbarian King',
  'Archer Queen': 'Archer Queen',
  'Grand Warden': 'Grand Warden',
  'Royal Champion': 'Royal Champion',
  'Minion Prince': 'Minion Hero',
  'Battle Machine': 'Battle Copter',
  'Battle Copter': 'Battle Copter',
  'Dragon Duke': 'Dragon Duke',
};

function formatHeroUpgradeTime(hours: number): string {
  if (!hours || hours === 0) return 'None';
  if (hours < 24) return `${hours} h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h > 0 ? `${d} d ${h} h` : `${d} d`;
}

function formatCost(cost: number): string {
  if (!cost || cost === 0) return 'None';
  if (cost >= 1_000_000) return `${(cost / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (cost >= 1_000) return `${(cost / 1_000).toFixed(0)}K`;
  return String(cost);
}

async function getHeroDetailFromJson(name: string): Promise<TroopDetail | null> {
  const jsonKey = HERO_JSON_KEYS[name];
  if (!jsonKey) return null;

  try {
    const res = await fetch(COC_HEROES_JSON, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return null;

    const allHeroes: Record<string, any> = await res.json();
    const heroData = allHeroes[jsonKey];
    if (!heroData) return null;

    const dpsArr: number[] = heroData.DPS ?? [];
    const hpArr: number[] = heroData.Hitpoints ?? [];
    const costArr: number[] = heroData.UpgradeCost ?? [];
    const timeArr: number[] = heroData.UpgradeTimeH ?? [];
    const thArr: number[] = heroData.RequiredTownHallLevel ?? [];
    const tavernArr: number[] = heroData.RequiredHeroTavernLevel ?? [];

    const levels: TroopDetailLevel[] = dpsArr.map((dps, i) => ({
      level: i + 1,
      dps,
      damagePerHit: dps, // heroes don't separate damage-per-hit from DPS in this API
      hitpoints: hpArr[i] ?? 0,
      upgradeCost: i === 0 ? 'None' : formatCost(costArr[i - 1] ?? 0),
      upgradeTime: i === 0 ? 'None' : formatHeroUpgradeTime(timeArr[i - 1] ?? 0),
      xp: 0,
      labLevel: tavernArr[i] ?? null,
      thRequired: thArr[i] ?? null,
    }));

    const slug = getHeroSlug(name) ?? '';
    const imageUrl = getHeroImageUrl(name) ?? `https://coc.guide/static/imgs/hero/${slug}.png`;

    // Build info block from fixed values (heroes don't have housing space, training time)
    const range = heroData.AttackRange?.[0];
    const attackSpeed = heroData.AttackSpeed?.[0];

    const info: TroopDetail['info'] = {
      trainingTime: '',
      range: range ? `${range}` : '',
      housingSpace: 0,
      attackSpeed: attackSpeed ? `${(attackSpeed / 1000).toFixed(1)} s` : '',
      damageType: 'Single Target',
      targetType: 'Ground & Air',
      favoriteTarget: '',
    };

    return {
      name,
      slug,
      description: '',
      imageUrl,
      levels,
      info,
    };
  } catch (err) {
    console.warn('[troopDetail] Hero JSON fetch failed', { name, err });
    return null;
  }
}

export interface TroopDetailLevel {
  level: number;
  dps: number;
  damagePerHit: number;
  hitpoints: number;
  upgradeCost: string;
  upgradeTime: string;
  xp: number;
  labLevel: number | null;
  thRequired: number | null;
}

export interface TroopDetail {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  levels: TroopDetailLevel[];
  currentLevel?: number;
  maxLevel?: number;
  info: {
    trainingTime: string;
    range: string;
    housingSpace: number;
    attackSpeed: string;
    damageType: string;
    targetType: string;
    favoriteTarget: string;
  };
}

interface CacheEntry {
  data: TroopDetail;
  timestamp: number;
}

function parseThClass(cls: string): number | null {
  const m = cls.match(/th-(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function parseNumeric(numberLike: string): number {
  const match = numberLike.match(/-?\d[\d,]*/);
  return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
}

function normalizeCellText(input: string): string {
  const withImageLabels = input.replace(/<img\b[^>]*>/gi, (tag: string) => {
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    const alt = altMatch?.[1]?.trim() || '';
    const src = srcMatch?.[1] || '';

    if (alt) return alt;
    const fileName = src.split('/').pop() || '';
    return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  });

  return withImageLabels
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTableCells(rowHtml: string): Array<{ text: string; className: string }> {
  const cells: Array<{ text: string; className: string }> = [];
  const cellRegex = /<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/g;
  let cellMatch: RegExpExecArray | null;

  while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
    const attrs = cellMatch[1] || '';
    const classMatch = attrs.match(/class="([^"]+)"/);
    const rawText = normalizeCellText(cellMatch[2]);

    cells.push({
      text: rawText,
      className: classMatch?.[1] ?? '',
    });
  }

  return cells;
}

function getTableHeaders(tableHtml: string): string[] {
  const source = tableHtml.match(/<thead>([\s\S]*?)<\/thead>/i)?.[1] ?? tableHtml;
  return [...source.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
    .map((match) => normalizeCellText(match[1]))
    .filter((header) => header.length > 0);
}

function findHeaderIndex(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

function getCellByHeader(cells: string[], headers: string[], patterns: RegExp[], fallbackIndex: number): string {
  const headerIndex = findHeaderIndex(headers, patterns);
  return headerIndex >= 0 ? (cells[headerIndex] || '') : (cells[fallbackIndex] || '');
}

function pickHeaderValue(cells: string[], headers: string[], patterns: RegExp[]): string {
  const headerIndex = findHeaderIndex(headers, patterns);
  if (headerIndex >= 0) return cells[headerIndex] || '';

  for (const pattern of patterns) {
    const fallbackIndex = headers.findIndex((header) => pattern.test(header));
    if (fallbackIndex >= 0) return cells[fallbackIndex] || '';
  }

  return '';
}

function getBodyRows(tableHtml: string): string[] {
  return [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((match) => match[1])
    .filter((row) => !/<th/i.test(row) && /<td/i.test(row));
}

function findStatTable(tableHtmls: string[]): string | null {
  const candidates = tableHtmls
    .map((tableHtml) => {
      const headers = getTableHeaders(tableHtml);
      const bodyRows = getBodyRows(tableHtml);
      const bodyCellCounts = bodyRows.map((row) => extractTableCells(row).length);
      const maxBodyCells = Math.max(...bodyCellCounts, 0);
      const bodyCellDensity = bodyRows.length > 0 ? bodyCellCounts.reduce((sum, count) => sum + count, 0) / bodyRows.length : 0;

      return {
        tableHtml,
        headers,
        bodyRows,
        bodyCellDensity,
        maxBodyCells,
      };
    })
    .filter(({ headers, bodyRows, maxBodyCells }) => {
      const hasLevelHeader = headers.some((header) => /^level$/i.test(header));
      const hasStatHeader = headers.some((header) => /damage|health|hitpoints|hp|elixir|xp|laboratory|lab/i.test(header));
      const hasRealBody = bodyRows.length > 1 && maxBodyCells >= 6;
      return hasLevelHeader && hasStatHeader && hasRealBody;
    })
    .sort((a, b) => {
      if (b.headers.length !== a.headers.length) return b.headers.length - a.headers.length;
      if (b.maxBodyCells !== a.maxBodyCells) return b.maxBodyCells - a.maxBodyCells;
      if (b.bodyCellDensity !== a.bodyCellDensity) return b.bodyCellDensity - a.bodyCellDensity;
      return b.bodyRows.length - a.bodyRows.length;
    });

  return candidates[0]?.tableHtml ?? null;
}

function parseDetailHTML(html: string): TroopDetail {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1Content = h1Match?.[1] || '';
  const h1Clean = h1Content.replace(/<img\b[^>]*>/gi, '');
  const name = normalizeCellText(h1Clean);

  const descMatch = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<h5[^>]*>[^<]*<\/h5>\s*<p>([^<]+)<\/p>/);
  const description = descMatch?.[1]?.trim() || '';

  const imgMatch = h1Content.match(/<img[^>]*src=["']([^"']+)["']/);
  const imageUrl = imgMatch ? `https://coc.guide${imgMatch[1]}` : '';

  const levels: TroopDetailLevel[] = [];
  const statTableMatch = findStatTable([...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((match) => match[1]));

  if (statTableMatch) {
    const headers = getTableHeaders(statTableMatch);
    const bodyRows = getBodyRows(statTableMatch);

    for (const row of bodyRows) {
      const cells = extractTableCells(row).map((cell) => cell.text);
      if (!cells.length) continue;

      const level = parseNumeric(getCellByHeader(cells, headers, [/^level$/i], 0));
      if (!level) continue;

      const dps = parseNumeric(pickHeaderValue(cells, headers, [/damage per second|dps/i]));
      const damagePerHit = parseNumeric(pickHeaderValue(cells, headers, [/damage per hit|damage when destroyed/i]));
      const hitpoints = parseNumeric(pickHeaderValue(cells, headers, [/hitpoints|health|hp/i]));
      const upgradeCost = pickHeaderValue(cells, headers, [/upgrade|elixir|gold|dark elixir|gem|cost/i]) || '';
      const upgradeTime = pickHeaderValue(cells, headers, [/clock|training time|time/i]) || '';
      const xp = parseNumeric(pickHeaderValue(cells, headers, [/xp/i]));
      const labLevelValue = pickHeaderValue(cells, headers, [/laboratory|lab/i]) || '';
      const labLevel = parseNumeric(labLevelValue) || null;

      levels.push({
        level,
        dps,
        damagePerHit,
        hitpoints,
        upgradeCost,
        upgradeTime,
        xp,
        labLevel,
        thRequired: parseThClass(labLevelValue),
      });
    }
  }

  const info = { trainingTime: '', range: '', housingSpace: 0, attackSpeed: '', damageType: '', targetType: '', favoriteTarget: '' };
  const infoTableMatch = html.match(/<table[^>]*class="[^"]*info-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (infoTableMatch) {
    const tableHtml = infoTableMatch[1];
    const infoHeaders = getTableHeaders(tableHtml);
    const cleanHtml = tableHtml.replace(/<thead>[\s\S]*?<\/thead>/i, '');
    const infoRows = [...cleanHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .map((match) => match[1]);

    const infoRow = infoRows[0];
    if (infoRow) {
      const cells = extractTableCells(infoRow).map((cell) => cell.text);
      info.trainingTime = getCellByHeader(cells, infoHeaders, [/training time|clock/i], -1) || '';
      info.range = getCellByHeader(cells, infoHeaders, [/range/i], -1) || '';
      info.housingSpace = parseNumeric(getCellByHeader(cells, infoHeaders, [/housing|troop/i], -1));
      info.attackSpeed = getCellByHeader(cells, infoHeaders, [/attack speed|attack/i], -1) || '';
      info.damageType = getCellByHeader(cells, infoHeaders, [/damage type|attack type/i], -1) || '';
      info.targetType = getCellByHeader(cells, infoHeaders, [/^target$/i], -1) || '';
      info.favoriteTarget = getCellByHeader(cells, infoHeaders, [/favorite target/i], -1) || '';
    }
  }

  return { name, slug: '', description, imageUrl, levels, info };
}

// Which URL prefixes to try for each item type, in priority order.
// coc.guide/troop/ and coc.guide/spell/ are SSR; hero/pet/equipment are CSR (SPA) — skip them.
function getCandidateUrls(name: string): { url: string; slug: string }[] {
  const candidates: { url: string; slug: string }[] = [];

  const troopSlug = getTroopSlug(name);
  if (troopSlug) candidates.push({ url: `https://coc.guide/troop/${troopSlug}`, slug: troopSlug });

  const heroSlug = getHeroSlug(name);
  if (heroSlug) {
    // coc.guide hero pages are CSR; try troop path for heroes (some are listed under /troop/)
    candidates.push({ url: `https://coc.guide/troop/${heroSlug}`, slug: heroSlug });
  }

  const petSlug = getPetSlug(name);
  if (petSlug && petSlug !== troopSlug) {
    candidates.push({ url: `https://coc.guide/troop/${petSlug}`, slug: petSlug });
  }

  const equipSlug = getEquipmentSlug(name);
  if (equipSlug && equipSlug !== troopSlug) {
    candidates.push({ url: `https://coc.guide/troop/${equipSlug}`, slug: equipSlug });
  }

  return candidates;
}

function isValidDetailHtml(html: string): boolean {
  // If the H1 is just "Clash of Clans Guide" (CSR shell), the page has no real content
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1Match) return false;
  const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
  if (h1Text === 'clash of clans guide') return false;
  // Must have at least one table for stats
  return /<table/i.test(html);
}

export async function getTroopDetail(name: string): Promise<TroopDetail | null> {
  // For heroes, use the dedicated JSON API (hero pages on coc.guide are CSR and can't be server-fetched)
  if (HERO_JSON_KEYS[name]) {
    const heroDetail = await getHeroDetailFromJson(name);
    if (heroDetail) return heroDetail;
  }

  const candidates = getCandidateUrls(name);

  if (!candidates.length) {
    return null;
  }

  const slug = candidates[0].slug;

  const cacheKey = `${CACHE_PREFIX}${slug}`;
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      // Caching is disabled/bypassed via false
      if (false) {
        const entry: CacheEntry = JSON.parse(raw as string);
        if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
          return entry.data;
        }
      }
    }
  } catch (error) {
    console.warn('[troopDetail] Cache read failed', { name, slug, error });
  }

  for (const { url, slug: candidateSlug } of candidates) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });

      if (!res.ok) {
        continue;
      }

      const html = await res.text();

      if (!isValidDetailHtml(html)) {
        continue;
      }

      const detail = parseDetailHTML(html);
      detail.slug = candidateSlug;

      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: detail, timestamp: Date.now() } as CacheEntry));
      } catch (error) {
        console.warn('[troopDetail] Cache write failed', { name, slug: candidateSlug, error });
      }

      return detail;
    } catch (error) {
      console.warn('[troopDetail] Request threw', { name, url, error });
    }
  }

  return null;
}

