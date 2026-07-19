import * as cheerio from 'cheerio';

const URL = 'https://www.clash.ninja/guides/max-levels-for-each-th';

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

interface ThLevelInfo {
  level: number | null;
  isMaxLevel: boolean;
}

function parseTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>): Record<string, Record<number, ThLevelInfo>> {
  const rows = table.find('tr');

  const headerCells = rows.first().find('th');
  const thNumbers: number[] = [];
  headerCells.each((i: number, th: any) => {
    if (i < 2) return;
    const n = parseInt($(th).text().trim(), 10);
    if (!Number.isNaN(n)) thNumbers.push(n);
  });

  const items: Record<string, Record<number, ThLevelInfo>> = {};
  rows.slice(1).each((_: number, row: any) => {
    const $row = $(row);
    const itemName = $row.find('th').first().text().trim();
    if (!itemName) return;

    const dataCells = $row.find('td').slice(1);
    const levels: Record<number, ThLevelInfo> = {};
    dataCells.each((i: number, td: any) => {
      const thNum = thNumbers[i];
      if (thNum === undefined) return;
      const $td = $(td);
      const raw = $td.text().trim();
      const isLocked = $td.hasClass('locked') || raw === '-' || raw === '';
      const isMax = $td.hasClass('max');
      const parsed = parseInt(raw, 10);

      levels[thNum] = {
        level: isLocked || Number.isNaN(parsed) ? null : parsed,
        isMaxLevel: isMax,
      };
    });

    items[itemName] = levels;
  });

  return items;
}

export interface ThLevelsData {
  source_url: string;
  scraped_at: string;
  categories: Record<string, Record<string, Record<number, ThLevelInfo>>>;
}

export async function scrapeThLevels(): Promise<ThLevelsData> {
  const html = await fetchHtml(URL);
  const $ = cheerio.load(html);

  const categories: Record<string, Record<string, Record<number, ThLevelInfo>>> = {};

  $('h3[id^="cphBody_ctl"]').each((_: number, h3El: any) => {
    const categoryName = $(h3El).text().trim();
    if (!categoryName) return;

    const table = $(h3El).closest('div.cell').find('table.all-th-overview').first();
    if (!table.length) return;

    const items = parseTable($, table);
    if (Object.keys(items).length) categories[categoryName] = items;
  });

  return {
    source_url: URL,
    scraped_at: new Date().toISOString(),
    categories,
  };
}
