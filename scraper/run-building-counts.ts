import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ALL_BUILDINGS, extractCounts } from './building-counts-lib.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = 'https://clashofclans.fandom.com/api.php';
const DELAY_MS = 400;
const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'building-levels.json');

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

interface BuildingEntry {
  name: string;
  village: string;
  [key: string]: unknown;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as BuildingEntry[];
  const byName = new Map(data.map((b) => [b.name, b]));

  let injected = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const [name, slug] of Object.entries(ALL_BUILDINGS)) {
    const entry = byName.get(name);
    if (!entry) {
      console.warn(`  Skip ${name}: not in building-levels.json`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${name}... `);
    const wt = await fetchWikitext(slug);
    const counts = extractCounts(wt);

    if (counts === null) {
      // No count template: single-copy/fixed-count building. Remove any stale
      // counts field so absence means "single copy" unambiguously.
      if (entry.counts !== undefined) {
        delete entry.counts;
        injected++;
        console.log('counts removed');
      } else {
        unchanged++;
        console.log('no counts (single copy)');
      }
      await delay(DELAY_MS);
      continue;
    }

    const prev = JSON.stringify(entry.counts ?? null);
    entry.counts = counts;
    const next = JSON.stringify(counts);
    if (prev !== next) {
      injected++;
      console.log(`${Object.keys(counts).length} pts`);
    } else {
      unchanged++;
      console.log('unchanged');
    }

    await delay(DELAY_MS);
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nDone: ${injected} injected, ${unchanged} unchanged, ${skipped} skipped`);
  console.log(`Data written to ${DATA_PATH}`);
}

main().catch(console.error);
