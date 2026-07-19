import { scrapeTH, scrapeAllTH } from './clashofclans-layouts';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);

function parseArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function parseFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const thArg = parseArg('th');
const maxPages = parseArg('pages') ? parseInt(parseArg('pages')!, 10) : undefined;
const skipDetail = parseFlag('skip-detail');
const outDir = parseArg('out') || path.join(__dirname, '..', 'src', 'data');

async function main() {
  console.log('ClashPrime Base Scraper');
  console.log('======================');

  if (thArg) {
    const levels = thArg.split(',').map(Number).filter(Boolean);
    if (levels.length === 1) {
      await scrapeTH(levels[0], { maxPages, skipDetail, outDir });
    } else {
      await scrapeAllTH(levels, { maxPages, skipDetail, outDir });
    }
  } else {
    // Default: scrape TH16 and TH17 (popular levels)
    await scrapeAllTH([16, 17], { maxPages: 3, skipDetail, outDir });
  }

  console.log('\nDone!');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
