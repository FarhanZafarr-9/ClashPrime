import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://clashofclans.fandom.com/api.php';
const DELAY_MS = 400;
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'building-levels.json');

// ── All buildings ────────────────────────────────────────────────────────
const ALL_BUILDINGS: Record<string, string> = {
  // ── Defenses ──
  'Cannon': 'Cannon/Home_Village',
  'Archer Tower': 'Archer_Tower/Home_Village',
  'Mortar': 'Mortar',
  'Air Defense': 'Air_Defense/Home_Village',
  'Wizard Tower': 'Wizard_Tower',
  'Air Sweeper': 'Air_Sweeper',
  'Hidden Tesla': 'Hidden_Tesla/Home_Village',
  'Bomb Tower': 'Bomb_Tower/Home_Village',
  'X-Bow': 'X-Bow/Home_Village',
  'Inferno Tower': 'Inferno_Tower/Home_Village',
  'Eagle Artillery': 'Eagle_Artillery',
  'Scattershot': 'Scattershot',
  "Builder's Hut": "Builder's_Hut",
  'Spell Tower': 'Spell_Tower',
  'Monolith': 'Monolith',
  'Multi-Archer Tower': 'Multi-Archer_Tower',
  'Ricochet Cannon': 'Ricochet_Cannon',
  'Multi-Gear Tower': 'Multi-Gear_Tower',
  'Firespitter': 'Firespitter',
  'Revenge Tower': 'Revenge_Tower',
  'Super Wizard Tower': 'Super_Wizard_Tower/Home_Village',
  'Wall': 'Wall/Home_Village',
  // ── Resources ──
  'Town Hall': 'Town_Hall',
  'Gold Mine': 'Gold_Mine/Home_Village',
  'Elixir Collector': 'Elixir_Collector/Home_Village',
  'Dark Elixir Drill': 'Dark_Elixir_Drill',
  'Gold Storage': 'Gold_Storage/Home_Village',
  'Elixir Storage': 'Elixir_Storage/Home_Village',
  'Dark Elixir Storage': 'Dark_Elixir_Storage',
  'Clan Castle': 'Clan_Castle',
  // ── Army ──
  'Army Camp': 'Army_Camp/Home_Village',
  'Barracks': 'Barracks',
  'Dark Barracks': 'Dark_Barracks',
  'Laboratory': 'Laboratory',
  'Spell Factory': 'Spell_Factory',
  'Hero Hall': 'Hero_Hall',
  'Dark Spell Factory': 'Dark_Spell_Factory',
  'Blacksmith': 'Blacksmith',
  'Workshop': 'Workshop',
  'Pet House': 'Pet_House',
  // ── Traps ──
  'Bomb': 'Bomb',
  'Spring Trap': 'Spring_Trap/Home_Village',
  'Giant Bomb': 'Giant_Bomb',
  'Air Bomb': 'Air_Bomb',
  'Seeking Air Mine': 'Seeking_Air_Mine',
  'Skeleton Trap': 'Skeleton_Trap',
  'Tornado Trap': 'Tornado_Trap',
  'Giga Bomb': 'Giga_Bomb',
  // Builder Base - Defenses
  'Double Cannon': 'Double_Cannon',
  'BB Archer Tower': 'Archer_Tower/Builder_Base',
  'BB Hidden Tesla': 'Hidden_Tesla/Builder_Base',
  'Firecrackers': 'Firecrackers',
  'Crusher': 'Crusher/Builder_Base',
  'Guard Post': 'Guard_Post',
  'BB Air Bombs': 'Air_Bombs/Builder_Base',
  'Multi Mortar': 'Multi_Mortar/Builder_Base',
  "O.T.T.O's Outpost": "O.T.T.O's_Outpost",
  'BB Roaster': 'Roaster/Builder_Base',
  'Giant Cannon': 'Giant_Cannon/Builder_Base',
  'Mega Tesla': 'Mega_Tesla',
  'BB Lava Launcher': 'Lava_Launcher/Builder_Base',
  'BB X-Bow': 'X-Bow/Builder_Base',
  // Builder Base - Walls
  'BB Walls': 'Walls/Builder_Base',
  // Builder Base - Traps
  'Push Trap': 'Push_Trap',
  'BB Spring Trap': 'Spring_Trap/Builder_Base',
  'Mine': 'Mine/Builder_Base',
  'Mega Mine': 'Mega_Mine/Builder_Base',
  // Builder Base - Resources
  'Builder Hall': 'Builder_Hall',
  'BB Gold Mine': 'Gold_Mine/Builder_Base',
  'BB Elixir Collector': 'Elixir_Collector/Builder_Base',
  'BB Gold Storage': 'Gold_Storage/Builder_Base',
  'BB Elixir Storage': 'Elixir_Storage/Builder_Base',
  'Gem Mine': 'Gem_Mine',
  // Builder Base - Army
  'Builder Barracks': 'Builder_Barracks',
  'BB Army Camp': 'Army_Camp/Builder_Base',
  'Star Laboratory': 'Star_Laboratory',
  'Battle Machine Altar': 'Battle_Machine_Altar',
  'Reinforcement Camp': 'Reinforcement_Camp',
  'Healing Hut': 'Healing_Hut',
  'Battle Copter Altar': 'Battle_Copter_Altar',
  // Builder Base - Other
  "B.O.T.O's Shack": "B.O.T.O's_Shack",
  'Clock Tower': 'Clock_Tower',
  'Elixir Cart': 'Elixir_Cart',
};

// ── Types ────────────────────────────────────────────────────────────────
export interface BuildingLevel {
  Level: number;
  [stat: string]: string | number;
}

export interface BuildingData {
  name: string;
  village: 'home' | 'builderBase';
  description: string;
  maxLevel: number;
  statsColumns: string[];
  levels: BuildingLevel[];
}

// ── Fandom API helpers ──────────────────────────────────────────────────
function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function apiFetch(url: string, retries = 3): Promise<any | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (res.status === 429) {
        console.warn('  Rate limited, waiting 3s...');
        await delay(3000);
        continue;
      }
      if (!res.ok) {
        console.warn(`  HTTP ${res.status} (attempt ${attempt + 1})`);
        await delay(1000);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.warn(`  Fetch error (attempt ${attempt + 1}):`, err);
      await delay(1000);
    }
  }
  return null;
}

async function fetchWikitext(page: string): Promise<string> {
  const url = `${API_BASE}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2`;
  const data = await apiFetch(url);
  return data?.parse?.wikitext || '';
}

// ── Parsers ──────────────────────────────────────────────────────────────

function extractDescription(wt: string): string {
  const m = wt.match(/<center>(.*?)<\/center>/s);
  if (!m) return '';
  return m[1]
    .replace(/'''?|''?/g, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]|]*))?\]\]/g, (_, p1, p2) => (p2 || p1))
    .replace(/{{H\|([^|}]+)(?:\|([^}]+))?}}/g, (_, p1, p2) => p2 || p1)
    .replace(/{{B\|([^|}]+)(?:\|([^}]+))?}}/g, (_, p1, p2) => p2 || p1)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMaxLevel(wt: string): number {
  const levels: number[] = [];
  const re = /<div>(?:'''?\s*)?Level\s*(\d+)(?:\s*'''?)?<\/div>/gi;
  let match;
  while ((match = re.exec(wt)) !== null) {
    levels.push(parseInt(match[1], 10));
  }
  if (levels.length === 0) {
    const imgRe = /\[\[File:[^\]]*?Level\s*(\d+)[^\]]*?\]\]/gi;
    while ((match = imgRe.exec(wt)) !== null) {
      levels.push(parseInt(match[1], 10));
    }
  }
  return levels.length > 0 ? Math.max(...levels) : 0;
}

function cleanCell(raw: string): string {
  let v = raw
    .replace(/^[|!]\s*/, '')
    .replace(/class="[^"]*"/gi, '')
    .replace(/style="[^"]*"/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]|]*)\]\]/g, '$1')
    .replace(/{{Res\|[^}]*}}/g, '')
    .replace(/{{Res\|RES=[^}]*}}/g, '')
    .replace(/\|$/, '')
    .trim();
  const lastPipe = v.lastIndexOf('|');
  if (lastPipe >= 0) v = v.slice(lastPipe + 1).trim();
  return v;
}

function parseValue(raw: string): string | number {
  const cleaned = cleanCell(raw);
  if (!cleaned || /^(N\/A|Varies|—|-|None)/i.test(cleaned)) return cleaned;
  if (/[a-zA-Z]/.test(cleaned)) return cleaned;
  const stripped = cleaned.replace(/,/g, '');
  const num = parseFloat(stripped);
  return isNaN(num) ? cleaned : num;
}

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;

  while (i < line.length && (line[i] === '|' || line[i] === '!')) i++;

  for (; i < line.length; i++) {
    const ch = line[i];
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;

    if (depth === 0 && ch === '|' && i + 1 < line.length && line[i + 1] === '|') {
      cells.push(current);
      current = '';
      i++;
      continue;
    }
    current += ch;
  }
  if (current.trim()) cells.push(current);
  return cells;
}

function detectVillage(slug: string): 'home' | 'builderBase' {
  return slug.includes('Builder_Base') ? 'builderBase' : 'home';
}

function normalizeHeaderName(raw: string): string {
  const short = raw
    .replace(/\[\[[^\]]*\]\]/g, '')
    .replace(/{{[^}]*}}/g, '')
    .replace(/<br[^>]*>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/town hall|th\b.*required|level required/i.test(short)) return 'Town Hall Level';
  if (/level/i.test(short) && !/experience|xp/i.test(short)) return 'Level';
  if (/damage per second|dps/i.test(short)) return 'Damage per Second';
  if (/damage per shot|damage per attack|dph/i.test(short)) return 'Damage per Shot';
  if (/damage per hit/i.test(short)) return 'Damage per Hit';
  if (/hitpoint|hp\b/i.test(short)) return 'Hitpoints';
  if (/build cost|cost|gold|elixir|resource/i.test(short) && !/boost/i.test(short) && !/experience|xp/i.test(short)) return 'Build Cost';
  if (/build time|time\b/i.test(short) && !/fill|boost/i.test(short) && !/catch/i.test(short)) return 'Build Time';
  if (/experience|xp/i.test(short)) return 'Experience';
  if (/damage when destroyed/i.test(short)) return 'Damage when destroyed';
  if (/shockwave/i.test(short)) return 'Shockwave Damage';
  if (/splash damage/i.test(short)) return 'Splash Damage**';
  if (/repair per second/i.test(short)) return 'Repair per Second';
  if (/repair per hit/i.test(short)) return 'Repair per Hit';
  if (/secondary chain/i.test(short)) return 'Secondary Chain Damage';
  if (/damage/i.test(short)) return short.replace(/^\*+/, '').trim();
  return short || 'Stat';
}

/**
 * Find the first stat wikitable in the page that looks like building level data.
 * Skips supercharge tables, info-only tables (Range/Attack Speed/etc.), and
 * challenge/achievement tables.
 */
function findStatsTable(wt: string): { columns: string[]; rows: BuildingLevel[] } | null {
  let searchPos = 0;

  while (true) {
    const tableStart = wt.indexOf('{|', searchPos);
    if (tableStart === -1) return null;
    const tableEnd = wt.indexOf('|}', tableStart);
    if (tableEnd === -1) return null;

    const tableContent = wt.slice(tableStart + 2, tableEnd);

    if (/supercharg/i.test(tableContent)) {
      searchPos = tableEnd + 2;
      continue;
    }

    const lines = tableContent.split('\n');
    const headerLines: string[] = [];
    let rowLines: string[][] = [];
    let inHeader = false;
    let inRow = false;

    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;

      if (t.startsWith('!')) {
        inHeader = true;
        headerLines.push(t);
        continue;
      }
      if (t === '|-') {
        if (inRow && rowLines.length > 0) inRow = false;
        continue;
      }
      if (t.startsWith('|')) {
        if (!inRow) {
          if (inHeader) inHeader = false;
          rowLines.push([]);
          inRow = true;
        }
        rowLines[rowLines.length - 1].push(t);
        continue;
      }
    }

    if (headerLines.length === 0 || rowLines.length < 2) {
      searchPos = tableEnd + 2;
      continue;
    }

    const headerJoined = headerLines.join('||').replace(/!!/g, '||');
    const headerPieces = splitRow(headerJoined);
    const normalizedHeaders = headerPieces.map(p => normalizeHeaderName(cleanCell(p)));

    // Must have a Level column to be a stats table. Info tables (Range/Attack
    // Speed/etc.) and achievement tables never have a Level column.
    if (!normalizedHeaders.some(h => h === 'Level')) {
      searchPos = tableEnd + 2;
      continue;
    }

    const usedColNames = new Set<string>();
    const columns = headerPieces.map(p => {
      const c = cleanCell(p);
      let name = normalizeHeaderName(c);
      if (usedColNames.has(name)) {
        let suffix = 2;
        while (usedColNames.has(`${name}_${suffix}`)) suffix++;
        name = `${name}_${suffix}`;
      }
      usedColNames.add(name);
      return name;
    });

    const rows: BuildingLevel[] = [];
    for (let ri = 0; ri < rowLines.length; ri++) {
      const row = rowLines[ri];
      const joined = row.join('||').replace(/^\|-\s*/, '');
      const cells = splitRow(joined);
      if (cells.length === 0) continue;

      const firstValRaw = cells[0] || '';
      const firstValClean = cleanCell(firstValRaw);
      if (!/^\d+$/.test(firstValClean)) continue;

      const rowData: BuildingLevel = { Level: parseInt(firstValClean, 10) };
      for (let i = 1; i < columns.length && i < cells.length; i++) {
        rowData[columns[i]] = parseValue(cells[i]);
      }
      rows.push(rowData);
    }

    if (rows.length > 0) {
      return { columns, rows };
    }

    searchPos = tableEnd + 2;
  }
}

// ── Main scraper ────────────────────────────────────────────────────────
async function scrapeBuilding(name: string, slug: string): Promise<BuildingData | null> {
  process.stdout.write(`  ${name}... `);

  const wt = await fetchWikitext(slug);
  if (!wt) {
    console.log('NO WIKITEXT');
    return null;
  }

  const description = extractDescription(wt);
  const maxLevel = extractMaxLevel(wt);
  const stats = findStatsTable(wt);

  const result: BuildingData = {
    name,
    village: detectVillage(slug),
    description,
    maxLevel,
    statsColumns: stats?.columns ?? [],
    levels: stats?.rows ?? [],
  };

  const lvlRange = maxLevel > 0 ? `Lv1-${maxLevel}` : 'no gallery';
  const rowCount = stats?.rows.length ?? 0;
  const colCount = stats?.columns.length ?? 0;
  console.log(`${lvlRange}, ${rowCount} rows, ${colCount} cols`);
  return result;
}

async function main() {
  console.log('Scraping building level data from Clash of Clans Fandom wiki...\n');

  const entries = Object.entries(ALL_BUILDINGS);
  const results: BuildingData[] = [];

  for (let i = 0; i < entries.length; i++) {
    const [name, slug] = entries[i];
    process.stdout.write(`[${i + 1}/${entries.length}] `);

    try {
      const data = await scrapeBuilding(name, slug);
      if (data) results.push(data);
    } catch (err) {
      console.error(`ERROR: ${err}`);
    }

    if (i < entries.length - 1) await delay(DELAY_MS);
  }

  console.log(`\nDone: ${results.length}/${entries.length} buildings scraped`);

  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Data written to ${OUTPUT_PATH}`);
}

main().catch(console.error);
