import type { ScopeDiscount } from '../hooks/useDiscounts';

// Parse a time string like "5s", "30m", "2h", "1d 12h", "7d" into total seconds.
export function parseTimeToSeconds(timeStr: string): number | null {
  if (!timeStr || timeStr === '—') return null;
  const t = timeStr.trim().toLowerCase();
  let total = 0;
  const dayMatch = t.match(/(\d+)\s*d/);
  if (dayMatch) total += parseInt(dayMatch[1], 10) * 86400;
  const hourMatch = t.match(/(\d+)\s*h/);
  if (hourMatch) total += parseInt(hourMatch[1], 10) * 3600;
  const minMatch = t.match(/(\d+)\s*m(?!s)/);
  if (minMatch) total += parseInt(minMatch[1], 10) * 60;
  const secMatch = t.match(/(\d+)\s*s/);
  if (secMatch) total += parseInt(secMatch[1], 10);
  return total > 0 ? total : null;
}

// Format seconds back into a compact time string.
export function formatSecondsToTime(totalSec: number): string {
  if (totalSec <= 0) return '0s';
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  if (seconds > 0 && days === 0 && hours === 0) parts.push(`${seconds}s`);
  return parts.join(' ') || '0s';
}

// Parse a cost string like "1.5M" or "175K" into a full numeric value.
function parseCostToFullNumber(cost: string): number {
  const trimmed = (cost || '').trim();
  const num = parseFloat(trimmed.replace(/[^0-9.]/g, '')) || 0;
  if (/m/i.test(trimmed)) return num * 1_000_000;
  if (/k/i.test(trimmed)) return num * 1_000;
  return num;
}

// Apply a cost discount: cost is a raw number or a formatted string like "1.5M".
// Returns the discounted value as a formatted string preserving the original unit scale.
export function applyCostDiscount(cost: string | number, discounts: ScopeDiscount): string {
  if (discounts.costPercent <= 0) return String(cost);
  let fullValue: number;
  let hadUnit = false;
  if (typeof cost === 'number') {
    fullValue = cost;
  } else {
    const trimmed = (cost || '').trim();
    if (!trimmed || ['-', '—', 'none', 'free', 'n/a', 'na'].includes(trimmed.toLowerCase())) return trimmed || '—';
    hadUnit = /[km]/i.test(trimmed);
    fullValue = parseCostToFullNumber(trimmed);
  }
  if (fullValue <= 0) return String(cost);
  const multiplier = (100 - discounts.costPercent) / 100;
  const discounted = fullValue * multiplier;
  return hadUnit ? formatCostShort(discounted) : String(Math.round(discounted));
}

// Apply a time discount to a time string like "1d 12h". Returns discounted string.
export function applyTimeDiscount(timeStr: string, discounts: ScopeDiscount): string {
  if (discounts.timePercent <= 0) return timeStr;
  const seconds = parseTimeToSeconds(timeStr);
  if (seconds === null) return timeStr;
  const multiplier = (100 - discounts.timePercent) / 100;
  const discounted = Math.max(1, Math.round(seconds * multiplier));
  return formatSecondsToTime(discounted);
}

function formatCostShort(cost: number): string {
  if (cost >= 100000000) return (cost / 1000000).toFixed(0) + 'M';
  if (cost >= 1000000) return (cost / 1000000).toFixed(cost % 1000000 === 0 ? 0 : 1).replace('.0', '') + 'M';
  if (cost >= 1000) return (cost / 1000).toFixed(cost % 1000 === 0 ? 0 : 1).replace('.0', '') + 'K';
  return String(Math.round(cost));
}
