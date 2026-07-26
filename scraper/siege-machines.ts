import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://clashofclans.fandom.com/api.php';

interface CategoryMember {
  title: string;
}

async function fetchCategoryMembers(category: string): Promise<string[]> {
  const members: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: 'max',
      cmtype: 'page',
    });
    if (cmcontinue) params.set('cmcontinue', cmcontinue);

    const url = `${API_BASE}?${params}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ClashPrime/1.0' },
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data: any = await res.json();
    if (data.query?.categorymembers) {
      for (const m of data.query.categorymembers as CategoryMember[]) {
        members.push(m.title);
      }
    }
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);

  return members;
}

export interface SiegeMachinesData {
  source_url: string;
  scraped_at: string;
  names: string[];
}

export async function scrapeSiegeMachines(): Promise<SiegeMachinesData> {
  const all = await fetchCategoryMembers('Siege_Machines');
  const names = all.filter((n) => n !== 'Siege Machines');

  return {
    source_url: 'https://clashofclans.fandom.com/wiki/Siege_Machines',
    scraped_at: new Date().toISOString(),
    names,
  };
}

async function main() {
  console.log('Scraping siege machines from Fandom wiki...');
  const data = await scrapeSiegeMachines();

  const outPath = path.join(__dirname, '..', 'src', 'data', 'siege-machines.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved ${data.names.length} siege machines to ${outPath}`);
  console.log(data.names.join(', '));
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exitCode = 1;
});
