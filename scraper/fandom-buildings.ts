const API_BASE = 'https://clashofclans.fandom.com/api.php';
const DELAY_MS = 200;

const HOME_VILLAGE_BUILDINGS: Record<string, string> = {
  // Defenses
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
  // Resources
  'Town Hall': 'Town_Hall',
  'Gold Mine': 'Gold_Mine/Home_Village',
  'Elixir Collector': 'Elixir_Collector/Home_Village',
  'Dark Elixir Drill': 'Dark_Elixir_Drill',
  'Gold Storage': 'Gold_Storage/Home_Village',
  'Elixir Storage': 'Elixir_Storage/Home_Village',
  'Dark Elixir Storage': 'Dark_Elixir_Storage',
  'Clan Castle': 'Clan_Castle',
  // Army
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
  // Traps
  'Bomb': 'Bomb',
  'Spring Trap': 'Spring_Trap/Home_Village',
  'Giant Bomb': 'Giant_Bomb',
  'Air Bomb': 'Air_Bomb',
  'Seeking Air Mine': 'Seeking_Air_Mine',
  'Skeleton Trap': 'Skeleton_Trap',
  'Tornado Trap': 'Tornado_Trap',
  'Giga Bomb': 'Giga_Bomb',
  // Builder Base - Defenses
  'BB Cannon': 'Cannon/Builder_Base',
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
  'BB Walls': 'Wall/Builder_Base',
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface FandomImageResponse {
  query: {
    pages: Record<string, {
      title: string;
      thumbnail?: { source: string; width: number; height: number };
      missing?: string;
    }>;
  };
}

interface FandomImagesListResponse {
  query: {
    pages: Record<string, {
      title: string;
      images?: Array<{ title: string }>;
    }>;
  };
}

interface ImageInfoResponse {
  query: {
    pages: Record<string, {
      title: string;
      imageinfo?: Array<{ url: string; thumburl: string }>;
      missing?: string;
    }>;
  };
}

async function apiFetch(url: string, retries = 3): Promise<any | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (res.status === 429) {
        console.warn(`  Rate limited, waiting 3s...`);
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

async function getAllImagesOnPage(title: string): Promise<string[]> {
  const url = `${API_BASE}?action=query&titles=${encodeURIComponent(title)}&prop=images&format=json&imlimit=500`;
  const data: FandomImagesListResponse | null = await apiFetch(url);
  if (!data?.query?.pages) return [];
  const pages = Object.values(data.query.pages);
  if ((pages[0] as any)?.missing !== undefined) return [];
  return pages[0]?.images?.map(img => img.title) ?? [];
}

async function getFileUrls(titles: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const BATCH_SIZE = 50;
  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    const batch = titles.slice(i, i + BATCH_SIZE);
    const url = `${API_BASE}?action=query&titles=${encodeURIComponent(batch.join('|'))}&prop=imageinfo&iiprop=url&format=json`;
    const data: ImageInfoResponse | null = await apiFetch(url);
    if (!data?.query?.pages) continue;
    for (const page of Object.values(data.query.pages)) {
      if (page.imageinfo?.[0]?.url && !page.missing) {
        result.set(page.title, page.imageinfo[0].url);
      }
    }
    if (i + BATCH_SIZE < titles.length) await delay(DELAY_MS);
  }
  return result;
}

async function getPageWikitext(title: string): Promise<string> {
  const url = `${API_BASE}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2`;
  const data = await apiFetch(url);
  return data?.parse?.wikitext || '';
}

export interface BuildingImageEntry {
  name: string;
  imageUrl: string;
  levels?: { level: number; imageUrl: string }[];
}

function getImageNamePrefixes(name: string): string[] {
  const prefixes: string[] = [];
  const base = name.toLowerCase().replace(/'/g, '');
  prefixes.push(base.replace(/ /g, '_'));
  prefixes.push(base);
  if (base.startsWith('bb ')) {
    const stripped = base.slice(3);
    prefixes.push(stripped.replace(/ /g, '_'));
    prefixes.push(stripped);
  }
  const noSpace = base.replace(/ /g, '');
  if (noSpace !== base && noSpace !== prefixes[0]) {
    prefixes.push(noSpace);
  }
  return [...new Set(prefixes)];
}

function isCanonicalLevelImage(imgName: string): boolean {
  const lower = imgName.toLowerCase();
  if (lower.includes('pre ')) return false;
  if (lower.includes('_pre_')) return false;
  if (lower.includes(' animation')) return false;
  if (lower.endsWith('.gif')) return false;
  if (lower.includes('depleted')) return false;
  if (lower.includes(' info')) return false;
  if (lower.includes('infobutton')) return false;
  if (lower.endsWith('.mp4')) return false;
  if (lower.endsWith('.jpg')) return false;
  if (lower.includes('run out')) return false;
  return true;
}

interface LevelMapping {
  gameLevel: number;
  rawFile: string;
  wikiNumber: number;
}

function parseLevelRangesFromWikitext(wikitext: string): LevelMapping[] {
  const mappings: LevelMapping[] = [];

  const lines = wikitext.split('\n');
  let inFlexbox = false;
  let sectionCount = 0;

  for (const line of lines) {
    if (line.includes('flexbox-display')) {
      sectionCount++;
      if (sectionCount > 1) break;
      inFlexbox = true;
      continue;
    }
    if (inFlexbox && line.trim() === '</div>') {
      inFlexbox = false;
      continue;
    }
    if (!inFlexbox) continue;

    const match = line.match(/\[\[File:([^\]|]+\.(?:png|webp|gif))(?:\|[^\]]*)?\]\]/i);
    if (!match) continue;

    const filename = match[1].trim();
    const fnLower = filename.toLowerCase();
    if (fnLower.includes('unarmed') ||
        fnLower.includes('targeting') ||
        fnLower.endsWith(' air.png') ||
        fnLower.match(/ air\d+\.png/)) continue;

    const levelMatch = line.match(/<div>(?:Level[s]?\s+)(\d+)(?:\s*-\s*(\d+))?<\/div>/i);
    if (!levelMatch) continue;

    const startLevel = parseInt(levelMatch[1]);
    const endLevel = levelMatch[2] ? parseInt(levelMatch[2]) : startLevel;
    const numMatch = filename.match(/(\d+)/);
    const wikiNumber = numMatch ? parseInt(numMatch[1]) : startLevel;

    for (let lvl = startLevel; lvl <= endLevel; lvl++) {
      mappings.push({
        gameLevel: lvl,
        rawFile: 'File:' + filename,
        wikiNumber,
      });
    }
  }

  return mappings;
}

function parseLevelFromFilename(filename: string, prefixes: string[]): number | null {
  const lower = filename.toLowerCase();
  let afterPrefix = filename;
  for (const p of prefixes) {
    if (lower.startsWith(p)) {
      afterPrefix = filename.slice(p.length);
      break;
    }
  }
  const match = afterPrefix.match(/(\d+)/);
  if (!match) return null;
  const level = parseInt(match[1]);
  if (level > 25) return null;
  return level;
}

export async function scrapeBuildingImages(): Promise<BuildingImageEntry[]> {
  const results: BuildingImageEntry[] = [];
  const entries = Object.entries(HOME_VILLAGE_BUILDINGS);
  const titleToName = new Map<string, string>();
  for (const [name, slug] of entries) {
    titleToName.set(slug.replace(/_/g, ' '), name);
  }

  const allSlugs = entries.map(([, v]) => v);
  const BATCH_SIZE = 50;

  console.log(`Fetching main images for ${entries.length} buildings (batched)...`);
  for (let i = 0; i < allSlugs.length; i += BATCH_SIZE) {
    const batch = allSlugs.slice(i, i + BATCH_SIZE);
    const url = `${API_BASE}?action=query&titles=${encodeURIComponent(batch.join('|'))}&prop=pageimages&format=json&pithumbsize=128`;
    const data: FandomImageResponse | null = await apiFetch(url);
    if (!data?.query?.pages) { console.warn(`Batch ${i} failed`); continue; }
    for (const page of Object.values(data.query.pages)) {
      if (page.thumbnail?.source && !page.missing) {
        const slug = page.title.replace(/ /g, '_');
        const name = titleToName.get(page.title) ?? entries.find(([, v]) => v === slug)?.[0];
        if (name) {
          results.push({ name, imageUrl: page.thumbnail.source });
        }
      }
    }
    if (i + BATCH_SIZE < allSlugs.length) await delay(DELAY_MS);
  }

  console.log(`Got main images for ${results.length} buildings`);

  let withLevels = 0;
  let totalLevelImages = 0;

  console.log('Fetching per-level images from individual pages...');
  for (let idx = 0; idx < results.length; idx++) {
    const entry = results[idx];
    const slug = HOME_VILLAGE_BUILDINGS[entry.name];
    if (!slug) continue;

    process.stdout.write(`  [${idx + 1}/${results.length}] ${entry.name}... `);

    try {
      const wikitext = await getPageWikitext(slug);
      const prefixes = getImageNamePrefixes(entry.name);
      let levelMappings = parseLevelRangesFromWikitext(wikitext);

      if (levelMappings.length === 0) {
        const images = await getAllImagesOnPage(slug);
        const filtered = images
          .map(img => img.replace(/^File:/, ''))
          .filter(img => {
            if (!/\d+/.test(img)) return false;
            if (!isCanonicalLevelImage(img)) return false;
            const lower = img.toLowerCase();
            return prefixes.some(p => lower.startsWith(p));
          })
          .map(img => {
            const level = parseLevelFromFilename(img, prefixes);
            if (level === null) return null;
            return { gameLevel: level, rawFile: 'File:' + img, wikiNumber: level };
          })
          .filter((x): x is LevelMapping => x !== null);
        levelMappings = filtered;
      }

      levelMappings.sort((a, b) => a.gameLevel - b.gameLevel);

      const uniqueFiles = new Map<string, LevelMapping>();
      for (const m of levelMappings) {
        if (!uniqueFiles.has(m.rawFile)) {
          uniqueFiles.set(m.rawFile, m);
        }
      }
      const fileKeys = Array.from(uniqueFiles.values());

      if (fileKeys.length > 0) {
        const thumbs = await getFileUrls(fileKeys.map(l => l.rawFile));
        const normalizedThumbs = new Map<string, string>();
        for (const [k, v] of thumbs) {
          normalizedThumbs.set(k, v);
          normalizedThumbs.set(k.replace(/_/g, ' '), v);
        }
        const fileToUrl = new Map<string, string>();
        for (const f of fileKeys) {
          const url = normalizedThumbs.get(f.rawFile) || normalizedThumbs.get(f.rawFile.replace(/_/g, ' '));
          if (url) fileToUrl.set(f.rawFile, url);
        }

        const levelMap = new Map<number, string>();
        for (const m of levelMappings) {
          const url = fileToUrl.get(m.rawFile);
          if (url && !levelMap.has(m.gameLevel)) {
            levelMap.set(m.gameLevel, url);
          }
        }

        entry.levels = Array.from(levelMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([level, imageUrl]) => ({ level, imageUrl }));

        if (entry.levels.length > 0) {
          withLevels++;
          totalLevelImages += entry.levels.length;
        }
        process.stdout.write(`${entry.levels.length} levels\n`);
      } else {
        process.stdout.write('0 levels\n');
      }
    } catch (err) {
      process.stdout.write(`error: ${err}\n`);
    }

    await delay(DELAY_MS);
  }

  console.log(`\nDone: ${results.length} buildings, ${withLevels} with level images, ${totalLevelImages} total level images`);
  return results;
}

async function main() {
  console.log('Scraping building images from Clash of Clans Fandom wiki...');
  try {
    const images = await scrapeBuildingImages();
    console.log(JSON.stringify(images.map(i => ({ name: i.name, levels: i.levels?.length ?? 0 })), null, 2));
  } catch (err) {
    console.error('Failed:', err);
  }
}

main();
