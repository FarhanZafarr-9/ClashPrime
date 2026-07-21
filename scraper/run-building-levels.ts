import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://clashofclans.fandom.com/api.php';
const DELAY_MS = 300;
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'building-levels.json');

// ── Defense buildings only ───────────────────────────────────────────────
const DEFENSE_BUILDINGS: Record<string, string> = {
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
  // Handle <div>Level N</div>, <div>'''Level N'''</div>, <div>Level N</div></div> etc.
  const re = /<div>(?:'''?\s*)?Level\s*(\d+)(?:\s*'''?)?<\/div>/gi;
  let match;
  while ((match = re.exec(wt)) !== null) {
    levels.push(parseInt(match[1], 10));
  }
  if (levels.length === 0) {
    // Fallback: look for gallery-style images with level numbers
    const imgRe = /\[\[File:[^\]]*?Level\s*(\d+)[^\]]*?\]\]/gi;
    while ((match = imgRe.exec(wt)) !== null) {
      levels.push(parseInt(match[1], 10));
    }
  }
  return levels.length > 0 ? Math.max(...levels) : 0;
}

/** Strip wiki formatting from a cell value */
function cleanCell(raw: string): string {
  let v = raw
    .replace(/^[|!]\s*/, '')
    .replace(/class="[^"]*"/gi, '')
    .replace(/style="[^"]*"/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[\[[^\]|]*\|?([^\]|]*)\]\]/g, '$1')
    .replace(/{{Res\|[^}]*}}/g, '')
    .replace(/{{Res\|RES=[^}]*}}/g, '')
    .replace(/\|$/, '')
    .trim();
  // Extract value after last | (for attribute|value format)
  const lastPipe = v.lastIndexOf('|');
  if (lastPipe >= 0) v = v.slice(lastPipe + 1).trim();
  return v;
}

/** Try to parse a numeric value; return number if numeric, otherwise string */
function parseValue(raw: string): string | number {
  const cleaned = cleanCell(raw);
  if (!cleaned || /^(N\/A|Varies|—|-|None)/i.test(cleaned)) return cleaned;
  // Contains any letter → keep as text (time string, unit, etc.)
  if (/[a-zA-Z]/.test(cleaned)) return cleaned;
  // Pure numeric (with optional commas, decimals)
  const stripped = cleaned.replace(/,/g, '');
  const num = parseFloat(stripped);
  return isNaN(num) ? cleaned : num;
}

/**
 * Parse the first wikitable (wikitext table) from the page content.
 * Handles both:
 *   - Single-line format: |1||class="..."|7||class="..."|5.6||300||...
 *   - Multi-line format: |1\n|class="..."|80\n|class="..."|80\n...
 */
function parseStatsTable(wt: string): { columns: string[]; rows: BuildingLevel[] } {
  const tableStart = wt.indexOf('{|');
  if (tableStart === -1) return { columns: [], rows: [] };
  const tableEnd = wt.indexOf('|}', tableStart);
  if (tableEnd === -1) return { columns: [], rows: [] };

  const tableContent = wt.slice(tableStart + 2, tableEnd);
  const lines = tableContent.split('\n');

  // ── 1. Collect header lines ──────────────────────────────────────
  let headerLines: string[] = [];
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
    // Data row
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

  // ── 2. Parse header ──────────────────────────────────────────────
  const headerJoined = headerLines.join('||').replace(/!!/g, '||');
  const headerPieces = splitRow(headerJoined);
  const columns = headerPieces.map(p => {
    const c = cleanCell(p);
    // Derive short name from the cleaned text
    const short = c
      .replace(/\[\[[^\]]*\]\]/g, '')
      .replace(/{{[^}]*}}/g, '')
      .replace(/<br[^>]*>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Map common terms to consistent keys
    if (/level/i.test(short)) return 'Level';
    if (/damage per second|dps/i.test(short)) return 'Damage per Second';
    if (/damage per shot|damage per attack|dph/i.test(short)) return 'Damage per Shot';
    if (/hitpoint|hp/i.test(short)) return 'Hitpoints';
    if (/build cost|cost|gold/i.test(short)) return 'Build Cost';
    if (/build time|time/i.test(short)) return 'Build Time';
    if (/experience|xp/i.test(short)) return 'Experience';
    if (/town hall|th/i.test(short)) return 'Town Hall Level';
    if (/damage/i.test(short)) return short.replace(/^\*+/, '').trim();
    return short || 'Stat';
  });

  // ── 3. Parse rows ────────────────────────────────────────────────
  const rows: BuildingLevel[] = [];
  for (const row of rowLines) {
    const cells = splitRow(row.join('||').replace(/^\|-\s*/, ''));
    if (cells.length === 0) continue;

    const firstVal = cleanCell(cells[0]);
    if (!/^\d+$/.test(firstVal)) continue; // skip non-level rows

    const rowData: BuildingLevel = { Level: parseInt(firstVal, 10) };
    for (let i = 1; i < columns.length && i < cells.length; i++) {
      rowData[columns[i]] = parseValue(cells[i]);
    }
    rows.push(rowData);
  }

  return { columns, rows };
}

/** Split a wikitext row into cells, respecting {{ }} and [[ ]] nesting */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let depth = 0;
  let current = '';
  let i = 0;

  // Skip leading pipe(s)
  while (i < line.length && (line[i] === '|' || line[i] === '!')) i++;

  for (; i < line.length; i++) {
    const ch = line[i];
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;

    if (depth === 0 && ch === '|' && i + 1 < line.length && line[i + 1] === '|') {
      cells.push(current);
      current = '';
      i++; // skip second |
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
  const stats = parseStatsTable(wt);

  const result: BuildingData = {
    name,
    village: detectVillage(slug),
    description,
    maxLevel,
    statsColumns: stats.columns,
    levels: stats.rows,
  };

  const lvlRange = maxLevel > 0 ? `Lv1-${maxLevel}` : 'no gallery';
  console.log(`${lvlRange}, ${stats.rows.length} rows, ${stats.columns.length} cols`);
  return result;
}

async function main() {
  console.log('Scraping building level data from Clash of Clans Fandom wiki...\n');

  const entries = Object.entries(DEFENSE_BUILDINGS);
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

  // Write output
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Data written to ${OUTPUT_PATH}`);
}

main().catch(console.error);
