import { scrapeThLevels } from './clash-ninja-th-levels';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('Scraping max levels from clash.ninja...');
  const data = await scrapeThLevels();

  const outPath = path.join(__dirname, '..', 'src', 'data', 'th-levels.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved to ${outPath}`);
  console.log(`Categories: ${Object.keys(data.categories).join(', ')}`);

  let totalItems = 0;
  for (const cat of Object.values(data.categories)) {
    totalItems += Object.keys(cat).length;
  }
  console.log(`Total items: ${totalItems}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exitCode = 1;
});
