import * as cheerio from 'cheerio';

const BASE_URL = 'https://coc.guide';
const LIST_URL = `${BASE_URL}/troop`;

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export interface TroopListItem {
  name: string;
  slug: string;
  imageUrl: string;
  village: 'home' | 'builderBase' | 'clanCapital';
}

export async function scrapeTroopList(): Promise<TroopListItem[]> {
  const html = await fetchHtml(LIST_URL);
  const $ = cheerio.load(html);
  const items: TroopListItem[] = [];
  const seen = new Set<string>();

  let village: 'home' | 'builderBase' | 'clanCapital' = 'home';

  $('div[role="main"] > *').each((_, el) => {
    const tag = $(el).prop('tagName');
    if (tag === 'H2') {
      const text = $(el).text().trim().toLowerCase();
      if (text.includes('builder')) village = 'builderBase';
      else if (text.includes('capital')) village = 'clanCapital';
      else village = 'home';
    }

    if (tag === 'DIV' && $(el).hasClass('items')) {
      $(el).find('.item-link').each((_, item) => {
        const btnLink = $(item).find('a.btn');
        const href = btnLink.attr('href') || '';
        const name = btnLink.text().trim();
        const imgSrc = $(item).find('img').attr('src') || '';

        if (!href.startsWith('/troop/') || !name || seen.has(name)) return;
        seen.add(name);

        const slug = href.replace('/troop/', '');
        const imageUrl = imgSrc.startsWith('http') ? imgSrc : `${BASE_URL}${imgSrc}`;

        items.push({ name, slug, imageUrl, village });
      });
    }
  });

  return items;
}

export interface TroopDetail {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  levels: {
    level: number;
    dps: number;
    damagePerHit: number;
    hitpoints: number;
    upgradeCost: string;
    upgradeTime: string;
    xp: number;
    labLevel: number | null;
    thRequired: number | null;
  }[];
  info: {
    trainingTime: string;
    range: string;
    housingSpace: number;
    attackSpeed: string;
    damageType: string;
    targetType: string;
  };
}

function parseThClass(cls: string): number | null {
  const m = cls.match(/th-(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export async function fetchTroopDetail(slug: string): Promise<TroopDetail> {
  const html = await fetchHtml(`${BASE_URL}/troop/${slug}`);
  const $ = cheerio.load(html);

  const name = $('h1').text().trim();
  const description = $('h1').nextAll('p').first().text().trim();
  const imgSrc = $('h1').prev('img').attr('src') || '';
  const imageUrl = imgSrc.startsWith('http') ? imgSrc : `${BASE_URL}${imgSrc}`;

  const levels: TroopDetail['levels'] = [];
  $('table tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 8) return;
    const labCell = cells.eq(7);
    levels.push({
      level: parseInt(cells.eq(0).text().trim(), 10),
      dps: parseInt(cells.eq(1).text().trim().replace(/,/g, ''), 10) || 0,
      damagePerHit: parseInt(cells.eq(2).text().trim().replace(/,/g, ''), 10) || 0,
      hitpoints: parseInt(cells.eq(3).text().trim().replace(/,/g, ''), 10) || 0,
      upgradeCost: cells.eq(4).text().trim(),
      upgradeTime: cells.eq(5).text().trim(),
      xp: parseInt(cells.eq(6).text().trim(), 10) || 0,
      labLevel: parseInt(labCell.text().trim(), 10) || null,
      thRequired: parseThClass(labCell.attr('class') || ''),
    });
  });

  const info: TroopDetail['info'] = {
    trainingTime: '', range: '', housingSpace: 0, attackSpeed: '', damageType: '', targetType: '',
  };
  $('table.info-table tbody tr').each((_, row) => {
    const cells = $(row).find('td, th');
    if (cells.length >= 7) {
      info.trainingTime = cells.eq(1).text().trim();
      info.range = cells.eq(2).text().trim();
      info.housingSpace = parseInt(cells.eq(3).text().trim(), 10) || 0;
      info.attackSpeed = cells.eq(4).text().trim();
      info.damageType = cells.eq(5).text().trim();
      info.targetType = cells.eq(6).text().trim();
    }
  });

  return { name, slug, description, imageUrl, levels, info };
}
