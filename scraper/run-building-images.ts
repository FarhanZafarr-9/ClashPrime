import { writeFileSync } from 'fs';
import { join } from 'path';
import { scrapeBuildingImages } from './fandom-buildings';

async function run() {
  const images = await scrapeBuildingImages();
  const outPath = join(__dirname, '..', 'src', 'data', 'building-images.json');
  writeFileSync(outPath, JSON.stringify({ images }, null, 2));
  console.log(`Wrote ${images.length} building images to ${outPath}`);
}

run().catch(console.error);
