import buildingImagesData from '../data/building-images.json';
import {
  getBuildingDetail,
  getBuildingItemImage,
  getBuildingMaxLevelAtBH,
  getBuildingMaxLevelAtTH,
  isBuilderName,
} from './buildingData';

const images = buildingImagesData.images;
const nameToEntry = new Map(images.map((img) => [img.name.toLowerCase(), img]));

export function getBuildingImageSource(name: string) {
  const pkg = getBuildingItemImage(name, null, isBuilderName(name));
  if (pkg) return pkg;
  const entry = nameToEntry.get(name.toLowerCase());
  if (entry?.imageUrl) return { uri: entry.imageUrl };
  return undefined;
}

export function getBuildingLevelImageSource(name: string, level: number) {
  const pkg = getBuildingItemImage(name, level, isBuilderName(name));
  if (pkg) return pkg;
  const entry = nameToEntry.get(name.toLowerCase());
  if (entry?.levels && entry.levels.length > 0) {
    const match = entry.levels.find((l) => l.level === level);
    if (match) return { uri: match.imageUrl };
    const highest = entry.levels.reduce((a, b) => (a.level > b.level ? a : b));
    if (level <= highest.level) return { uri: highest.imageUrl };
  }
  if (entry?.imageUrl) return { uri: entry.imageUrl };
  return undefined;
}

export function getBuildingAvailableLevels(name: string): number[] {
  const detail = getBuildingDetail(name, { builderBase: isBuilderName(name) });
  if (detail?.levels?.length) return detail.levels.map((l) => l.Level);
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

/** Compact number for badges, e.g. "1.2K", "5.3M" (keeps small numbers as-is). */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

/** Full representation, e.g. "64d 5h 20m" (omits zero leading units). */
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

/** Concise representation: single largest unit, rounded up, e.g. "65d", "12h". */
export function formatTimeShort(totalSec: number): string {
  if (totalSec <= 0) return '—';
  const days = Math.ceil(totalSec / 86400);
  if (days >= 1) return `${days}d`;
  const hours = Math.ceil(totalSec / 3600);
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.ceil(totalSec / 60);
  return minutes > 0 ? `${minutes}m` : '<1m';
}

/**
 * Stats-table data for a building, sourced from the clash-of-clans-data package
 * (shaped like the legacy building-levels.json entries the UI already renders).
 */
export function getBuildingData(name: string, opts?: { builderBase?: boolean }) {
  return getBuildingDetail(name, opts);
}

/** Max level of a building reachable at the given TH (or BH for Builder Base). */
export function getBuildingEffectiveMax(name: string, th: number): number {
  if (isBuilderName(name)) {
    return getBuildingMaxLevelAtBH(name, th) ?? 0;
  }
  return getBuildingMaxLevelAtTH(name, th) ?? 0;
}

export function getBuildingCurrentLevel(name: string, buildingLevels: Record<string, number>): number {
  return buildingLevels[name] ?? 0;
}
