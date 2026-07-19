import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTroopSlug } from '../utils/troopImages';

const CACHE_PREFIX = 'troop_detail_v2_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface TroopDetailLevel {
  level: number;
  dps: number;
  damagePerHit: number;
  hitpoints: number;
  upgradeCost: string;
  upgradeTime: string;
  xp: number;
  labLevel: number | null;
  thRequired: number | null;
}

export interface TroopDetail {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  levels: TroopDetailLevel[];
  currentLevel?: number;
  maxLevel?: number;
  info: {
    trainingTime: string;
    range: string;
    housingSpace: number;
    attackSpeed: string;
    damageType: string;
    targetType: string;
  };
}

interface CacheEntry {
  data: TroopDetail;
  timestamp: number;
}

function parseThClass(cls: string): number | null {
  const m = cls.match(/th-(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function parseDetailHTML(html: string): TroopDetail {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const h1Content = h1Match?.[1] || '';
  const name = h1Content.replace(/<[^>]+>/g, '').trim();

  const descMatch = html.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<h5[^>]*>[^<]*<\/h5>\s*<p>([^<]+)<\/p>/);
  const description = descMatch?.[1]?.trim() || '';

  const imgMatch = h1Content.match(/<img[^>]*src=["']([^"']+)["']/);
  const imageUrl = imgMatch ? `https://coc.guide${imgMatch[1]}` : '';

  const levels: TroopDetailLevel[] = [];
  const rowRegex = /<tr>\s*<td>(\d+)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>\s*<td([^>]*)>([^<]*)<\/td>\s*<\/tr>/g;
  let m;
  while ((m = rowRegex.exec(html)) !== null) {
    const labCellClass = m[8] || '';
    levels.push({
      level: parseInt(m[1], 10),
      dps: parseInt(m[2].replace(/,/g, ''), 10) || 0,
      damagePerHit: parseInt(m[3].replace(/,/g, ''), 10) || 0,
      hitpoints: parseInt(m[4].replace(/,/g, ''), 10) || 0,
      upgradeCost: m[5].trim(),
      upgradeTime: m[6].trim(),
      xp: parseInt(m[7].replace(/,/g, ''), 10) || 0,
      labLevel: parseInt(m[9].trim(), 10) || null,
      thRequired: parseThClass(labCellClass),
    });
  }

  const info = { trainingTime: '', range: '', housingSpace: 0, attackSpeed: '', damageType: '', targetType: '' };
  const infoTableMatch = html.match(/class="info-table"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  if (infoTableMatch) {
    const infoRow = infoTableMatch[1].match(/<tr>([\s\S]*?)<\/tr>/);
    if (infoRow) {
      const cells = [...infoRow[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, '').trim());
      if (cells.length >= 7) {
        info.trainingTime = cells[1];
        info.range = cells[2];
        info.housingSpace = parseInt(cells[3], 10) || 0;
        info.attackSpeed = cells[4];
        info.damageType = cells[5];
        info.targetType = cells[6];
      }
    }
  }

  return { name, slug: '', description, imageUrl, levels, info };
}

export async function getTroopDetail(name: string): Promise<TroopDetail | null> {
  const slug = getTroopSlug(name);
  if (!slug) return null;

  const cacheKey = `${CACHE_PREFIX}${slug}`;
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.data;
    }
  } catch {}

  try {
    const res = await fetch(`https://coc.guide/troop/${slug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const detail = parseDetailHTML(html);
    detail.slug = slug;

    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ data: detail, timestamp: Date.now() } as CacheEntry));
    } catch {}

    return detail;
  } catch {
    return null;
  }
}
