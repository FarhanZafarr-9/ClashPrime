import { scrapeTroopList } from './coc-guide-troops';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('Scraping troop list from coc.guide...');
  const items = await scrapeTroopList();

  const outPath = path.join(__dirname, '..', 'src', 'data', 'troop-list.json');
  fs.writeFileSync(outPath, JSON.stringify({ source_url: 'https://coc.guide/troop', scraped_at: new Date().toISOString(), troops: items }, null, 2), 'utf-8');
  console.log(`Saved ${items.length} troops to ${outPath}`);

  const home = items.filter((t) => t.village === 'home');
  const bb = items.filter((t) => t.village === 'builderBase');
  const cc = items.filter((t) => t.village === 'clanCapital');
  console.log(`  Home: ${home.length}, Builder: ${bb.length}, Capital: ${cc.length}`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exitCode = 1;
});
