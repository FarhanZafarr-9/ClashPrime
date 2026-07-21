import AsyncStorage from '@react-native-async-storage/async-storage';
import { getHeroSlug, getHeroImageUrl } from '../utils/troopImages';

const CACHE_PREFIX = 'troop_detail_v6_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const FANDOM_BASE = 'https://clashofclans.fandom.com';
const FANDOM_API = `${FANDOM_BASE}/api.php`;
const WIKIA_IMAGE_BASE = 'https://static.wikia.nocookie.net/clashofclans/images';

// ---------------------------------------------------------------------------
// Hero JSON API (coc.guide static JSON — fast and reliable)
// ---------------------------------------------------------------------------

const COC_HEROES_JSON = 'https://coc.guide/static/json/heroes.json';

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

// Abbreviate a raw cost string (e.g. from Fandom tables: "130,000" → "130K",
// "24,000,000" → "24M"). Unit suffix only — the value itself is preserved.
function formatCostString(raw: string): string {
  const trimmed = (raw || '').trim();
  const t = trimmed.toLowerCase().replace(/\s+/g, '');
  if (!t || ['-', '—', 'none', 'free', 'n/a', 'na'].includes(t)) return trimmed || '—';
  const num = parseInt(trimmed.replace(/[^0-9]/g, ''), 10);
  if (!num) return trimmed;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${Math.round(num / 1_000)}K`;
  return String(num);
}

async function getHeroDetailFromJson(name: string): Promise<TroopDetail | null> {
  const jsonKey = HERO_JSON_KEYS[name];
  if (!jsonKey) return null;

  try {
    const res = await fetch(COC_HEROES_JSON, {
      headers: { 'User-Agent': 'ClashPrime/1.0' },
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
      damagePerHit: dps,
      hitpoints: hpArr[i] ?? 0,
      upgradeCost: i === 0 ? 'None' : formatCost(costArr[i - 1] ?? 0),
      upgradeTime: i === 0 ? 'None' : formatHeroUpgradeTime(timeArr[i - 1] ?? 0),
      xp: 0,
      labLevel: tavernArr[i] ?? null,
      thRequired: thArr[i] ?? null,
    }));

    const slug = getHeroSlug(name) ?? '';
    const imageUrl = getHeroImageUrl(name) ?? '';

    const range = heroData.AttackRange?.[0];
    const attackSpeed = heroData.AttackSpeed?.[0];

    const info: TroopDetail['info'] = {
      range: range ? `${range}` : '',
      housingSpace: 0,
      attackSpeed: attackSpeed ? `${(attackSpeed / 1000).toFixed(1)} s` : '',
      damageType: 'Single Target',
      targetType: 'Ground & Air',
      favoriteTarget: '',
    };

    return { name, slug, description: '', imageUrl, levels, info };
  } catch (err) {
    console.warn('[troopDetail] Hero JSON fetch failed', { name, err });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

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
  // Generic per-level stat columns (spells, equipment, etc.) that don't map to dps/hitpoints.
  extra?: { label: string; value: string }[];
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
    range: string;
    housingSpace: number;
    attackSpeed: string;
    damageType: string;
    targetType: string;
    favoriteTarget: string;
  };
  // Generic label/value pairs for the info section (spells, equipment, etc.).
  infoPairs?: { label: string; value: string }[];
}

interface CacheEntry {
  data: TroopDetail;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Fandom Wiki: image filename mapping
// The Fandom wiki stores troop info images as "TroopName info.png" (or _info_2.png).
// This map handles special cases where the page or image name differs from the CoC API name.
// ---------------------------------------------------------------------------

const FANDOM_PAGE_NAMES: Record<string, string> = {
  // Home Village — Elixir Troops
  'Barbarian': 'Barbarian/Home_Village',
  'Archer': 'Archer',
  'Giant': 'Giant',
  'Goblin': 'Goblin',
  'Wall Breaker': 'Wall_Breaker',
  'Balloon': 'Balloon',
  'Wizard': 'Wizard',
  'Healer': 'Healer',
  'Dragon': 'Dragon',
  'P.E.K.K.A': 'P.E.K.K.A',
  'Baby Dragon': 'Baby_Dragon',
  'Miner': 'Miner',
  'Electro Dragon': 'Electro_Dragon',
  'Yeti': 'Yeti',
  'Dragon Rider': 'Dragon_Rider',
  'Electro Titan': 'Electro_Titan',
  'Root Rider': 'Root_Rider',
  'Thrower': 'Thrower',
  // Home Village — Dark Elixir Troops
  'Minion': 'Minion',
  'Hog Rider': 'Hog_Rider',
  'Valkyrie': 'Valkyrie',
  'Golem': 'Golem',
  'Witch': 'Witch',
  'Lava Hound': 'Lava_Hound',
  'Bowler': 'Bowler',
  'Ice Golem': 'Ice_Golem',
  'Headhunter': 'Headhunter',
  'Apprentice Warden': 'Apprentice_Warden',
  'Druid': 'Druid',
  'Ruin Witch': 'Ruin_Witch',
  'Furnace': 'Furnace',
  // Home Village — Siege Machines
  'Wall Wrecker': 'Wall_Wrecker',
  'Battle Blimp': 'Battle_Blimp',
  'Stone Slammer': 'Stone_Slammer',
  'Siege Barracks': 'Siege_Barracks',
  'Log Launcher': 'Log_Launcher',
  'Flame Flinger': 'Flame_Flinger',
  'Battle Drill': 'Battle_Drill',
  // ---------------------------------------------------------------------------
  // Builder Base Troops
  // The CoC API returns these under village: 'builderBase'
  // ---------------------------------------------------------------------------
  'Raged Barbarian': 'Raged_Barbarian',
  'Sneaky Archer': 'Sneaky_Archer/Builder_Base',
  'Boxer Giant': 'Boxer_Giant',
  'Beta Minion': 'Beta_Minion',
  'Bomber': 'Bomber',
  'Cannon Cart': 'Cannon_Cart',
  'Night Witch': 'Night_Witch',
  'Drop Ship': 'Drop_Ship',
  'Super P.E.K.K.A': 'Power_P.E.K.K.A/Builder_Base',
  'Power P.E.K.K.A': 'Power_P.E.K.K.A/Builder_Base',
  'Hog Glider': 'Hog_Glider',
  'Electrofire Wizard': 'Electrofire_Wizard',
  'Baby Dragon (Builder Base)': 'Baby_Dragon/Builder_Base',
  // Battle Machine hero (Builder Base hero — shown when TH6+)
  'Battle Machine': 'Battle_Machine',
  'Battle Copter': 'Battle_Copter',
  // ---------------------------------------------------------------------------
  // Super Troops
  // ---------------------------------------------------------------------------
  'Super Barbarian': 'Super_Barbarian',
  'Super Archer': 'Super_Archer',
  'Super Giant': 'Super_Giant',
  'Sneaky Goblin': 'Sneaky_Goblin',
  'Super Wall Breaker': 'Super_Wall_Breaker',
  'Rocket Balloon': 'Rocket_Balloon',
  'Inferno Dragon': 'Inferno_Dragon',
  'Super Witch': 'Super_Witch',
  'Ice Hound': 'Ice_Hound',
  'Super Bowler': 'Super_Bowler',
  'Super Dragon': 'Super_Dragon',
  'Super Minion': 'Super_Minion',
  'Super Valkyrie': 'Super_Valkyrie',
  'Super Hog Rider': 'Super_Hog_Rider',
  'Super Miner': 'Super_Miner',
  // ---------------------------------------------------------------------------
  // Spells
  // Canonical lists per Fandom category pages:
  //   Elixir Spells: https://clashofclans.fandom.com/wiki/Elixir_Spells
  //   Dark Spells:   https://clashofclans.fandom.com/wiki/Dark_Spells
  // Each spell resolves to its own Fandom page (the category pages are indexes
  // with no per-level stat tables).
  // ---------------------------------------------------------------------------
  // Elixir Spells (Spell Factory)
  'Lightning Spell': 'Lightning_Spell',
  'Healing Spell': 'Healing_Spell',
  'Rage Spell': 'Rage_Spell',
  'Jump Spell': 'Jump_Spell',
  'Freeze Spell': 'Freeze_Spell',
  'Clone Spell': 'Clone_Spell',
  'Invisibility Spell': 'Invisibility_Spell',
  'Recall Spell': 'Recall_Spell',
  'Revive Spell': 'Revive_Spell',
  'Totem Spell': 'Totem_Spell',
  // Dark Spells (Dark Spell Factory)
  'Poison Spell': 'Poison_Spell',
  'Earthquake Spell': 'Earthquake_Spell',
  'Haste Spell': 'Haste_Spell',
  'Skeleton Spell': 'Skeleton_Spell',
  'Bat Spell': 'Bat_Spell',
  'Overgrowth Spell': 'Overgrowth_Spell',
  'Ice Block Spell': 'Ice_Block_Spell',
  // ---------------------------------------------------------------------------
  // Hero Equipment
  // ---------------------------------------------------------------------------
  'Dragon Duke': 'Dragon_Duke',
  // ---------------------------------------------------------------------------
  // Heroes (Home Village + Builder Base)
  // ---------------------------------------------------------------------------
  'Barbarian King': 'Barbarian_King',
  'Archer Queen': 'Archer_Queen',
  'Grand Warden': 'Grand_Warden',
  'Royal Champion': 'Royal_Champion',
  'Minion Prince': 'Minion_Prince',
  'Action Figure': 'Action_Figure',
  'Eternal Tome': 'Eternal_Tome',
  'Flame Blower': 'Flame_Blower',
  // ---------------------------------------------------------------------------
  // Pets
  // ---------------------------------------------------------------------------
  'L.A.S.S.I': 'L.A.S.S.I',
  'Electro Owl': 'Electro_Owl',
  'Mighty Yak': 'Mighty_Yak',
  'Unicorn': 'Unicorn',
  'Phoenix': 'Phoenix',
  'Frosty': 'Frosty',
  'Diggy': 'Diggy',
  'Poison Lizard': 'Poison_Lizard',
  'Angry Jelly': 'Angry_Jelly',
  'Spirit Fox': 'Spirit_Fox',
};

// Image filename overrides: some troops have non-standard info image filenames on Fandom.
// Key = CoC API name, Value = exact filename (without leading "File:")
const FANDOM_INFO_IMAGE_OVERRIDES: Record<string, string> = {
  // Home Village
  'Super Barbarian': 'Super_Barbarian_info_2.png',
  'P.E.K.K.A': 'P.E.K.K.A_info.png',
  'L.A.S.S.I': 'L.A.S.S.I._info.png',
  // Builder Base — these troops don't have an "_info.png" but use the same name pattern
  'Power P.E.K.K.A': 'Power_P.E.K.K.A_info.png',
  'Super P.E.K.K.A': 'Power_P.E.K.K.A_info.png',
  'Night Witch': 'Night_Witch_info.png',
  'Drop Ship': 'Drop_Ship_info.png',
  'Hog Glider': 'Hog_Glider_info.png',
  'Electrofire Wizard': 'Electrofire_Wizard_info.png',
};

// ---------------------------------------------------------------------------
// Fandom Wiki helper: convert CoC API name → wiki page title
// ---------------------------------------------------------------------------

function getFandomPageTitle(name: string): string {
  if (FANDOM_PAGE_NAMES[name]) return FANDOM_PAGE_NAMES[name];
  // Default: replace spaces with underscores
  return name.replace(/\s+/g, '_');
}

function getFandomInfoImageFile(name: string): string {
  if (FANDOM_INFO_IMAGE_OVERRIDES[name]) return FANDOM_INFO_IMAGE_OVERRIDES[name];
  // Standard pattern: "Name_info.png"
  const baseName = name.replace(/\s+/g, '_');
  return `${baseName}_info.png`;
}

// ---------------------------------------------------------------------------
// Fandom Wiki API: fetch parsed HTML
// ---------------------------------------------------------------------------

async function fetchFandomHtml(pageTitle: string): Promise<string | null> {
  const url = `${FANDOM_API}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ClashPrime/1.0 (React Native App)' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.parse?.text?.['*'] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fandom Wiki API: fetch image URL
// ---------------------------------------------------------------------------

async function fetchFandomImageUrl(filename: string): Promise<string | null> {
  const url = `${FANDOM_API}?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ClashPrime/1.0 (React Native App)' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const pages = json?.query?.pages ?? {};
    for (const page of Object.values(pages) as any[]) {
      if (page.imageinfo?.[0]?.url) return page.imageinfo[0].url;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML page parser (uses our clean HTML table parser for robust parsing)
// ---------------------------------------------------------------------------

async function fetchTroopFromFandom(name: string): Promise<TroopDetail | null> {
  const pageTitle = getFandomPageTitle(name);
  const imageFile = getFandomInfoImageFile(name);

  const html = await fetchFandomHtml(pageTitle);

  if (!html) {
    console.warn('[troopDetail] No wikitext from Fandom for', { name, pageTitle });
    return null;
  }

  // Prefer the portable-infobox image (correct for troops, spells and equipment alike).
  let imageUrl: string | null = extractInfoboxImage(html);
  // Hero pages put a small *badge* in the infobox; reuse the proper coc.guide portrait instead.
  if (HERO_JSON_KEYS[name]) {
    imageUrl = getHeroImageUrl(name) ?? imageUrl;
  }
  if (!imageUrl) imageUrl = await fetchFandomImageUrl(imageFile);

  // Parse description: a flavor "quote" (often <center><i><b>"…"</b></i></center>,
  // with nested <a>/<b> markup) or, failing that, the first paragraph.
  const description = extractDescription(html);

  // Extract stat levels using the robust HTML table parser
  const levels: TroopDetailLevel[] = [];
  const statTableMatch = findStatTable([...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((match) => match[1]));

  if (statTableMatch) {
    const headers = getTableHeaders(statTableMatch);
    const bodyRows = getBodyRows(statTableMatch);

    // Headers we already handle explicitly (so we don't also dump them into "extra").
    const knownHeaderPatterns = [
      /^level$/i,
      /damage per second|dps/i,
      /damage per hit|damage when destroyed/i,
      /hitpoints|health|hp/i,
      /upgrade|elixir|gold|dark elixir|gem|cost/i,
      /clock|training time|time/i,
      /xp/i,
      /laboratory|lab|blacksmith|hero hall/i,
      /town hall/i,
    ];

    for (const row of bodyRows) {
      const cells = extractTableCells(row).map((cell) => cell.text);
      // Skip partial rows (e.g. hero recovery sub-rows) that lack the full header width.
      if (cells.length < headers.length) continue;

      const level = parseNumeric(getCellByHeader(cells, headers, [/^level$/i], 0));
      if (!level) continue;

      const dps = parseNumeric(pickHeaderValue(cells, headers, [/damage per second|dps/i]));
      const damagePerHit = parseNumeric(pickHeaderValue(cells, headers, [/damage per hit|damage when destroyed/i]));
      const hitpoints = parseNumeric(pickHeaderValue(cells, headers, [/hitpoints|health|hp/i]));
      const upgradeCost = formatCostString(pickHeaderValue(cells, headers, [/upgrade|elixir|gold|dark elixir|gem|cost/i]) || '');
      const upgradeTime = pickHeaderValue(cells, headers, [/clock|training time|time/i]) || '';
      const xp = parseNumeric(pickHeaderValue(cells, headers, [/xp/i]));
      const labLevelValue = pickHeaderValue(cells, headers, [/laboratory|lab|blacksmith|hero hall/i]) || '';
      const labLevel = parseNumeric(labLevelValue) || null;
      const thRequired = parseNumeric(pickHeaderValue(cells, headers, [/town hall/i])) || null;

      // Any column we don't map explicitly (e.g. spell Damage / Healing, equipment Ability stats).
      const extra: { label: string; value: string }[] = [];
      headers.forEach((h, idx) => {
        if (knownHeaderPatterns.some((p) => p.test(h))) return;
        const v = (cells[idx] || '').trim();
        if (v) extra.push({ label: h, value: v });
      });

      levels.push({
        level,
        dps,
        damagePerHit,
        hitpoints,
        upgradeCost,
        upgradeTime,
        xp,
        labLevel,
        thRequired,
        extra: extra.length ? extra : undefined,
      });
    }
  }

  // Parse the info table generically into label/value pairs (works for troops, spells, equipment).
  const info = { range: '', housingSpace: 0, attackSpeed: '', damageType: '', targetType: '', favoriteTarget: '' };
  const infoPairs: { label: string; value: string }[] = [];

  const allTables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((match) => match[1]);
  for (const t of allTables) {
    const hRow = getHeaderRowHtml(t);
    if (!hRow) continue;
    const hCells = [...hRow.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]/g)].map((m) => normalizeCellText(m[1])).filter(Boolean);
    if (hCells.some((h) => /^level$/i.test(h))) continue; // skip stat tables
    if (!hCells.some((h) => /housing|preferred target|target|attack type|range|movement|training|spell factory|blacksmith|ability type|user|radius|favorite|damage type/i.test(h))) continue;

    const tbody = t.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? t;
    const dataRows = [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]).filter((r) => /<td/i.test(r));
    const cells = dataRows[0] ? [...dataRows[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]/g)].map((m) => normalizeCellText(m[1])) : [];

    infoPairs.push(...hCells.map((h, i) => ({ label: h, value: (cells[i] || '').trim() })).filter((p) => p.value));

    // Structured mapping kept for troops (used by the existing panel fallback).
    info.range = getCellByHeader(cells, hCells, [/range/i], -1) || '';
    info.housingSpace = parseNumeric(getCellByHeader(cells, hCells, [/housing|troop/i], -1));
    info.attackSpeed = getCellByHeader(cells, hCells, [/attack speed/i], -1) || '';
    info.damageType = getCellByHeader(cells, hCells, [/attack type|^attack$|damage type/i], -1) || '';
    info.targetType = getCellByHeader(cells, hCells, [/^target$/i], -1) || '';
    info.favoriteTarget = getCellByHeader(cells, hCells, [/favorite target/i], -1) || '';
    break;
  }

  if (levels.length === 0) {
    console.debug('[troopDetail] No stat levels parsed from Fandom for', { name, pageTitle });
    return null;
  }

  const slug = name.replace(/\s+/g, '-').toLowerCase();

  return {
    name,
    slug,
    description,
    imageUrl: imageUrl ?? '',
    levels,
    info,
    infoPairs: infoPairs.length ? infoPairs : undefined,
  };
}

// Pull the unit image straight from the portable infobox <aside> (most reliable across categories).
function extractInfoboxImage(html: string): string {
  // Prefer the lazy-loaded data-src (the real URL) over the base64 placeholder src.
  const imgSrc = (s: string): string =>
    s.match(/<img[^>]*data-src="([^"]+)"/i)?.[1] ||
    s.match(/<img[^>]*src="([^"]+)"/i)?.[1] ||
    '';
  // Skip decorative icons (protection/lock) and embedded placeholders.
  const isJunk = (s: string) => /protection|lock|base64|wikia\.nocookie\.net.*\/Protection/i.test(s);

  // 1) Portable-infobox image (troops, spells, equipment).
  const aside = html.match(/<aside[^>]*>([\s\S]*?)<\/aside>/i);
  if (aside) {
    const src = imgSrc(aside[1]);
    if (src && !isJunk(src)) return src;
  }

  // 2) Fallback: scan <figure> images. Hero pages have no <aside>; their portrait
  //    is usually a "Name info.png" figure (e.g. "Dragon Duke info.png").
  const figures = [...html.matchAll(/<figure[^>]*>([\s\S]*?)<\/figure>/gi)];
  let best = '';
  for (const f of figures) {
    const inner = f[1];
    const src = imgSrc(inner);
    if (!src || isJunk(src)) continue;
    const dataName = (inner.match(/data-image-name="([^"]*)"/i)?.[1] || '').toLowerCase();
    if (/info/.test(dataName)) return src; // portrait image
    if (!best) best = src;
  }
  return best;
}

function extractDescription(html: string): string {
  const clean = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const trimQuotes = (s: string) => s.replace(/^["“'\s]+|["”'\s]+$/g, '');

  // Flavor quotes live in <center><i><b>"…"</b></i></center> (nested <a>/<b> allowed).
  const center = html.match(/<center>\s*<i>(?:<b>)?([\s\S]*?)(?:<\/b>)?\s*<\/i>\s*<\/center>/i);
  if (center) {
    const txt = trimQuotes(clean(center[1]));
    if (txt.length >= 12) return txt;
  }
  // Or a plain <i><b>"…"</b></i> quote.
  const iQuote = html.match(/<i><b>([\s\S]*?)<\/b><\/i>/i);
  if (iQuote) {
    const txt = trimQuotes(clean(iQuote[1]));
    if (txt.length >= 12) return txt;
  }
  // Otherwise use the first real paragraph.
  const p = html.match(/<p>([\s\S]*?)<\/p>/i);
  if (p) {
    const txt = clean(p[1]);
    if (txt.length >= 12) return txt;
  }
  return '';
}
// Fallback: coc.guide HTML scraper (kept for troop types that may not be on Fandom)
// ---------------------------------------------------------------------------

function normalizeCellText(input: string): string {
  // Drop <img> tags entirely. Fandom header/body cells embed icon images whose
  // alt text duplicates the visible label (e.g. <img alt="Level"> inside the
  // "Level" header), and injecting that alt text corrupts header matching.
  return String(input)
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities (Fandom emits numeric refs like &#160; for nbsp, plus named ones).
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '…')
    .replace(/&times;/gi, '×')
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rdquo;/gi, '”')
    .replace(/&ldquo;/gi, '“')
    .replace(/&bull;/gi, '•')
    // Drop any other leftover named entities so raw &xyz; never reaches the UI.
    .replace(/&[a-zA-Z]+;/g, ' ')
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
    cells.push({ text: rawText, className: classMatch?.[1] ?? '' });
  }

  return cells;
}

// Locate the header row of a wiki table. The Fandom `parse` API output usually has
// no <thead> — the header is simply the first <tr> that contains <th> cells. When a
// sticky/floating-header clone is present we prefer the "Original" copy.
function findHeaderRow(tableHtml: string): string | null {
  const floatingOriginal = tableHtml.match(/<thead class="tableFloatingHeaderOriginal">([\s\S]*?)<\/thead>/i);
  const headerSource = floatingOriginal
    ? floatingOriginal[1]
    : (tableHtml.match(/<thead>([\s\S]*?)<\/thead>/i)?.[1] ?? tableHtml);
  const rows = [...headerSource.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  return rows.find((row) => /<th/i.test(row)) ?? null;
}

function getTableHeaders(tableHtml: string): string[] {
  const headerRow = findHeaderRow(tableHtml);
  if (!headerRow) return [];
  return [...headerRow.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)]
    .map((match) => normalizeCellText(match[1]))
    // Drop stray purely-numeric headers (e.g. a trailing "1" in some hero tables).
    .filter((header) => header.length > 0 && !/^\d+$/.test(header));
}

// Returns the first <tr> that contains <th> cells (the real header row), or null.
function getHeaderRowHtml(tableHtml: string): string | null {
  return findHeaderRow(tableHtml);
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
  // Restrict to <tbody>; also exclude the header row so it's never treated as data.
  const headerRow = findHeaderRow(tableHtml);
  const tbody = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? tableHtml;
  return [...tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((match) => match[1])
    .filter((row) => /<td/i.test(row) && row !== headerRow);
}

function findStatTable(tableHtmls: string[]): string | null {
  const candidates = tableHtmls
    .map((tableHtml) => {
      const headers = getTableHeaders(tableHtml);
      const bodyRows = getBodyRows(tableHtml);
      const bodyCellCounts = bodyRows.map((row) => extractTableCells(row).length);
      const maxBodyCells = Math.max(...bodyCellCounts, 0);
      const bodyCellDensity = bodyRows.length > 0 ? bodyCellCounts.reduce((sum, count) => sum + count, 0) / bodyRows.length : 0;

      return { tableHtml, headers, bodyRows, bodyCellDensity, maxBodyCells };
    })
    .filter(({ headers, bodyRows, maxBodyCells }) => {
      const hasLevelHeader = headers.some((header) => /^level$/i.test(header));
      const hasStatHeader = headers.some((header) =>
        /damage|health|hitpoints|hp|elixir|xp|laboratory|lab|blacksmith|hero hall|research|upgrade|ability|healing|boost|ore|duration/i.test(header),
      );
      // Spells/equipment tables have fewer columns (5 or fewer); only require a real multi-row body.
      const hasRealBody = bodyRows.length > 1 && maxBodyCells >= 4;
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

function parseNumeric(numberLike: string): number {
  const match = numberLike.match(/-?\d[\d,]*/);
  return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
}

function parseDetailHTML(html: string): TroopDetail {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1Content = h1Match?.[1] || '';
  const h1Clean = h1Content.replace(/<img\b[^>]*>/gi, '');
  const name = normalizeCellText(h1Clean);

  const descMatch = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<h5[^>]*>[^<]*<\/h5>\s*<p>([^<]+)<\/p>/);
  const description = descMatch?.[1]?.trim() || '';

  const imgMatch = h1Content.match(/<img[^>]*src=["']([^"']+)['"]/);
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
      const upgradeCost = formatCostString(pickHeaderValue(cells, headers, [/upgrade|elixir|gold|dark elixir|gem|cost/i]) || '');
      const upgradeTime = pickHeaderValue(cells, headers, [/clock|training time|time/i]) || '';
      const xp = parseNumeric(pickHeaderValue(cells, headers, [/xp/i]));
      const labLevelValue = pickHeaderValue(cells, headers, [/laboratory|lab/i]) || '';
      const labLevel = parseNumeric(labLevelValue) || null;

      levels.push({ level, dps, damagePerHit, hitpoints, upgradeCost, upgradeTime, xp, labLevel, thRequired: null });
    }
  }

  const info = { range: '', housingSpace: 0, attackSpeed: '', damageType: '', targetType: '', favoriteTarget: '' };
  const infoTableMatch = html.match(/<table[^>]*class="[^"]*info-table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (infoTableMatch) {
    const tableHtml = infoTableMatch[1];
    const infoHeaders = getTableHeaders(tableHtml);
    const cleanHtml = tableHtml.replace(/<thead>[\s\S]*?<\/thead>/i, '');
    const infoRows = [...cleanHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
    const infoRow = infoRows[0];
    if (infoRow) {
      const cells = extractTableCells(infoRow).map((cell) => cell.text);
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

function getCocGuideCandidateUrls(name: string): { url: string; slug: string }[] {
  // Only used as fallback for troops the Fandom approach fails on
  const candidates: { url: string; slug: string }[] = [];
  const slug = name.replace(/\s+/g, '-').toLowerCase();
  candidates.push({ url: `https://coc.guide/troop/${slug}`, slug });
  return candidates;
}

function isValidDetailHtml(html: string): boolean {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (!h1Match) return false;
  const h1Text = h1Match[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
  if (h1Text === 'clash of clans guide') return false;
  return /<table/i.test(html);
}

// ---------------------------------------------------------------------------
// Main exported function
// ---------------------------------------------------------------------------

export async function getTroopDetail(name: string, bypassCache: boolean = false): Promise<TroopDetail | null> {
  const slug = name.replace(/\s+/g, '-').toLowerCase();
  const cacheKey = `${CACHE_PREFIX}${slug}`;

  // Check cache (skip if bypassCache is true)
  if (!bypassCache) {
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const entry: CacheEntry = JSON.parse(raw as string);
        // Only use cache if it has a valid image and is not expired
        if (entry.data?.imageUrl && (Date.now() - entry.timestamp < CACHE_TTL_MS)) {
          return entry.data;
        }
      }
    } catch (error) {
      console.warn('[troopDetail] Cache read failed', { name, error });
    }
  }

  // Primary: Fandom Wiki API
  const fandomDetail = await fetchTroopFromFandom(name);
  if (fandomDetail && fandomDetail.levels.length > 0) {
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: fandomDetail, timestamp: Date.now() } as CacheEntry));
    } catch (error) {
      console.warn('[troopDetail] Cache write failed', { name, error });
    }
    return fandomDetail;
  }

  // Fallback: coc.guide HTML (for troops Fandom wiki doesn't have great data for)
  const candidates = getCocGuideCandidateUrls(name);
  for (const { url, slug: candidateSlug } of candidates) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok) continue;

      const html = await res.text();
      if (!isValidDetailHtml(html)) continue;

      const detail = parseDetailHTML(html);
      detail.slug = candidateSlug;

      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: detail, timestamp: Date.now() } as CacheEntry));
      } catch (error) {
        console.warn('[troopDetail] Cache write failed', { name, slug: candidateSlug, error });
      }

      return detail;
    } catch (error) {
      console.warn('[troopDetail] Fallback request threw', { name, url, error });
    }
  }

  // Last-resort fallback for heroes (Fandom parse failed): dedicated coc.guide JSON.
  if (HERO_JSON_KEYS[name]) {
    const heroDetail = await getHeroDetailFromJson(name);
    if (heroDetail) return heroDetail;
  }

  return null;
}
