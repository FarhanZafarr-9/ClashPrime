import buildingImagesData from '../data/building-images.json';
import buildingLevelsData from '../data/building-levels.json';
import buildingAssets from '../data/buildingAssets';
import { getMaxLevelAtTH } from './thMaxLevels';

const images = buildingImagesData.images;
const nameToEntry = new Map(images.map((img) => [img.name.toLowerCase(), img]));

export function getBuildingImageSource(name: string) {
  const asset = buildingAssets[name];
  if (asset?.main) return asset.main;
  const entry = nameToEntry.get(name.toLowerCase());
  if (entry?.imageUrl) return { uri: entry.imageUrl };
  return null;
}

export function getBuildingLevelImageSource(name: string, level: number) {
  const asset = buildingAssets[name];
  if (asset?.levels?.[level]) return asset.levels[level];
  const entry = nameToEntry.get(name.toLowerCase());
  if (entry?.levels && entry.levels.length > 0) {
    const match = entry.levels.find((l) => l.level === level);
    if (match) return { uri: match.imageUrl };
    const highest = entry.levels.reduce((a, b) => (a.level > b.level ? a : b));
    if (level <= highest.level) return { uri: highest.imageUrl };
  }
  if (asset?.main) return asset.main;
  if (entry?.imageUrl) return { uri: entry.imageUrl };
  return null;
}

export function getBuildingAvailableLevels(name: string): number[] {
  const asset = buildingAssets[name];
  if (asset?.levels && Object.keys(asset.levels).length > 0) return Object.keys(asset.levels).map(Number).sort((a, b) => a - b);
  const entry = nameToEntry.get(name.toLowerCase());
  if (entry?.levels) return entry.levels.map((l) => l.level).sort((a, b) => a - b);
  return [];
}

export function parseCost(s: string): number {
  const cleaned = s.replace(/[^0-9.KkMmBb]/g, '');
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (/b/i.test(cleaned)) return num * 1_000_000_000;
  if (/m/i.test(cleaned)) return num * 1_000_000;
  if (/k/i.test(cleaned)) return num * 1_000;
  return num;
}

export function parseTimeToSeconds(s: string): number {
  if (!s || /[—\-]/.test(s)) return 0;
  const d = s.match(/(\d+)\s*d/);
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  return (d ? parseInt(d[1]) * 86400 : 0) + (h ? parseInt(h[1]) * 3600 : 0) + (m ? parseInt(m[1]) * 60 : 0);
}

export function formatCost(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toString();
}

export function formatTime(totalSec: number): string {
  if (totalSec <= 0) return '—';
  const parts: string[] = [];
  const d = Math.floor(totalSec / 86400);
  if (d > 0) parts.push(`${d}d`);
  const h = Math.floor((totalSec % 86400) / 3600);
  if (h > 0) parts.push(`${h}h`);
  const m = Math.floor((totalSec % 3600) / 60);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(' ') || '<1m';
}

export function getBuildingData(name: string) {
  const key = name.toLowerCase();
  return (buildingLevelsData as any[]).find(
    (b: any) => b.name.toLowerCase() === key,
  ) || null;
}

export function getBuildingEffectiveMax(name: string, th: number): number {
  const data = getBuildingData(name);
  if (!data) return 0;
  const globalMax = data.maxLevel || data.levels.length;
  const thMax = getMaxLevelAtTH(name, th);
  return thMax != null ? Math.min(globalMax, thMax) : globalMax;
}

export function getBuildingCurrentLevel(name: string, buildingLevels: Record<string, number>): number {
  return buildingLevels[name] ?? 0;
}
