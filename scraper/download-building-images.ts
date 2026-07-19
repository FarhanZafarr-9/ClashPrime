import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { readFileSync } from 'fs';

const DATA_PATH = join(__dirname, '..', 'src', 'data', 'building-images.json');
const ASSETS_DIR = join(__dirname, '..', 'assets', 'buildings');
const MAPPING_PATH = join(__dirname, '..', 'src', 'data', 'buildingAssets.ts');
const EXT = 'webp';

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  return false;
}

async function downloadImage(url: string, dest: string, retries = 3): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok) {
        if (attempt < retries - 1) { await delay(500); continue; }
        return false;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!isImageBuffer(buffer)) {
        if (attempt < retries - 1) { await delay(1000); continue; }
        return false;
      }
      writeFileSync(dest, buffer);
      return true;
    } catch (err) {
      if (attempt < retries - 1) await delay(500);
    }
  }
  return false;
}

interface LevelEntry {
  level: number;
  imageUrl: string;
}

interface BuildingImageEntry {
  name: string;
  imageUrl: string;
  levels?: LevelEntry[];
}

interface BuildingAssetEntry {
  name: string;
  folder: string;
  main: string;
  levels: Record<number, string>;
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8')) as { images: BuildingImageEntry[] };
  const images = data.images;

  console.log(`Processing ${images.length} buildings...`);

  const assets: BuildingAssetEntry[] = [];
  let totalDownloaded = 0;
  let totalFailed = 0;

  for (let idx = 0; idx < images.length; idx++) {
    const building = images[idx];
    const folder = sanitizeName(building.name);
    const folderPath = join(ASSETS_DIR, folder);
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }

    process.stdout.write(`  [${idx + 1}/${images.length}] ${building.name}... `);

    const levels: Record<number, string> = {};

    if (building.levels && building.levels.length > 0) {
      const CONCURRENT = 5;
      for (let i = 0; i < building.levels.length; i += CONCURRENT) {
        const batch = building.levels.slice(i, i + CONCURRENT);
        await Promise.all(batch.map(async (lvl) => {
          const fileName = `level_${lvl.level}.${EXT}`;
          const destPath = join(folderPath, fileName);
          if (existsSync(destPath)) {
            levels[lvl.level] = `assets/buildings/${folder}/${fileName}`;
            return;
          }
          const ok = await downloadImage(lvl.imageUrl, destPath);
          if (ok) {
            levels[lvl.level] = `assets/buildings/${folder}/${fileName}`;
            totalDownloaded++;
          } else {
            totalFailed++;
          }
        }));
      }
    }

    const mainFileName = `main.${EXT}`;
    const mainDestPath = join(folderPath, mainFileName);
    let mainPath = '';
    if (existsSync(mainDestPath)) {
      mainPath = `assets/buildings/${folder}/${mainFileName}`;
    } else {
      const ok = await downloadImage(building.imageUrl, mainDestPath);
      if (ok) {
        mainPath = `assets/buildings/${folder}/${mainFileName}`;
        totalDownloaded++;
      } else {
        totalFailed++;
      }
    }

    const levelCount = Object.keys(levels).length;
    process.stdout.write(`${levelCount} levels + main\n`);

    assets.push({ name: building.name, folder, main: mainPath, levels });
  }

  console.log(`\nDownloaded: ${totalDownloaded}, Failed: ${totalFailed}`);

  const requireLines: string[] = [];
  requireLines.push('// Auto-generated building assets mapping');
  requireLines.push('// Do not edit manually - run: npx tsx scraper/download-building-images.ts');
  requireLines.push('');
  requireLines.push('const buildingAssets: Record<string, { main: any; levels: Record<number, any> }> = {');

  for (const asset of assets) {
    const levelEntries = Object.entries(asset.levels)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([lvl, path]) => `    ${lvl}: require('../../${path}')`)
      .join(',\n');

    const safeName = asset.name.includes("'") ? `"${asset.name}"` : `'${asset.name}'`;
    requireLines.push(`  ${safeName}: {`);
    if (asset.main) {
      requireLines.push(`    main: require('../../${asset.main}'),`);
    } else {
      requireLines.push(`    main: null,`);
    }
    requireLines.push(`    levels: {`);
    if (levelEntries) requireLines.push(levelEntries);
    requireLines.push(`    },`);
    requireLines.push(`  },`);
  }

  requireLines.push('};');
  requireLines.push('');
  requireLines.push('export default buildingAssets;');

  writeFileSync(MAPPING_PATH, requireLines.join('\n'));
  console.log(`Wrote mapping to ${MAPPING_PATH}`);

  const totalLevels = assets.reduce((sum, a) => sum + Object.keys(a.levels).length, 0);
  console.log(`Total: ${assets.length} buildings, ${totalLevels} level images mapped`);
}

main().catch(console.error);
