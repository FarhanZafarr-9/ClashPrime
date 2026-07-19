import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

const ASSETS_DIR = join(__dirname, '..', 'assets', 'buildings');
const DATA_PATH = join(__dirname, '..', 'src', 'data', 'building-images.json');

function isPNG(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(url: string, dest: string, retries = 3): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!res.ok) {
        if (attempt < retries - 1) { await delay(1000); continue; }
        return false;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!isPNG(buffer)) {
        console.warn(`  Downloaded file is not PNG (${buffer.length} bytes, starts with ${buffer.slice(0, 4).toString('hex')}), retrying...`);
        if (attempt < retries - 1) { await delay(1000); continue; }
        return false;
      }
      writeFileSync(dest, buffer);
      return true;
    } catch (err) {
      if (attempt < retries - 1) await delay(1000);
    }
  }
  return false;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  const buildings: Array<{ name: string; imageUrl: string; levels?: Array<{ level: number; imageUrl: string }> }> = data.images;
  const urlMap = new Map<string, string>();
  for (const b of buildings) {
    if (b.levels) {
      for (const lvl of b.levels) {
        urlMap.set(`${b.name}|${lvl.level}`, lvl.imageUrl);
      }
    }
    urlMap.set(`${b.name}|main`, b.imageUrl);
  }

  const folders = readdirSync(ASSETS_DIR).filter(f => statSync(join(ASSETS_DIR, f)).isDirectory());

  let invalidCount = 0;
  let fixedCount = 0;
  let failedCount = 0;

  console.log(`Scanning ${folders.length} building folders...`);

  for (const folder of folders) {
    const folderPath = join(ASSETS_DIR, folder);
    const files = readdirSync(folderPath).filter(f => f.endsWith('.png'));
    const invalidFiles: string[] = [];

    for (const file of files) {
      const filePath = join(folderPath, file);
      try {
        const buffer = readFileSync(filePath);
        if (!isPNG(buffer)) {
          invalidFiles.push(file);
        }
      } catch {
        invalidFiles.push(file);
      }
    }

    if (invalidFiles.length === 0) continue;
    invalidCount += invalidFiles.length;

    const buildingName = buildings.find(b => sanitizeName(b.name) === folder)?.name;
    if (!buildingName) {
      console.warn(`  ${folder}: Can't map folder to building name, deleting ${invalidFiles.length} invalid files`);
      for (const f of invalidFiles) unlinkSync(join(folderPath, f));
      failedCount += invalidFiles.length;
      continue;
    }

    console.log(`  ${buildingName}: ${invalidFiles.length} invalid PNG(s)`);
    for (const file of invalidFiles) {
      const filePath = join(folderPath, file);
      const levelMatch = file.match(/level_(\d+)\.png/);
      const isMain = file === 'main.png';
      const level = levelMatch ? parseInt(levelMatch[1]) : null;

      let url: string | undefined;
      if (isMain) {
        url = urlMap.get(`${buildingName}|main`);
      } else if (level !== null) {
        url = urlMap.get(`${buildingName}|${level}`);
      }

      if (url) {
        process.stdout.write(`    Re-downloading ${file}... `);
        const ok = await downloadImage(url, filePath);
        if (ok) {
          process.stdout.write('OK\n');
          fixedCount++;
        } else {
          process.stdout.write('FAILED, removing\n');
          unlinkSync(filePath);
          failedCount++;
        }
        await delay(200);
      } else {
        console.warn(`    No URL for ${file}, removing`);
        unlinkSync(filePath);
        failedCount++;
      }
    }
  }

  console.log(`\nDone: ${invalidCount} invalid, ${fixedCount} fixed, ${failedCount} removed`);
}

main().catch(console.error);
