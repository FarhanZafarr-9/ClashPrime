import { Ionicons } from '@expo/vector-icons';
import { Achievement, Village } from '../types/clash';

export type AchievementGroup = 'almost' | 'progress' | 'notStarted' | 'complete';

export function getAchievementProgress(a: Achievement): number {
  if (a.stars === 3) return 1;
  if (a.target <= 0) return 0;
  return Math.min(1, a.value / a.target);
}

export function getAchievementGroup(a: Achievement): AchievementGroup {
  if (a.stars === 3) return 'complete';
  const progress = getAchievementProgress(a);
  if (progress >= 0.8 && a.stars < 3) return 'almost';
  if (a.stars > 0) return 'progress';
  return 'notStarted';
}

const GROUP_ORDER: AchievementGroup[] = ['almost', 'progress', 'notStarted', 'complete'];

const GROUP_LABELS: Record<AchievementGroup, string> = {
  almost: 'Almost There',
  progress: 'In Progress',
  notStarted: 'Not Started',
  complete: 'Completed',
};

export function groupAchievements(achievements: Achievement[]): { group: AchievementGroup; label: string; items: Achievement[] }[] {
  const buckets: Record<AchievementGroup, Achievement[]> = {
    almost: [],
    progress: [],
    notStarted: [],
    complete: [],
  };
  for (const a of achievements) {
    buckets[getAchievementGroup(a)].push(a);
  }
  return GROUP_ORDER
    .filter((g) => buckets[g].length > 0)
    .map((g) => ({
      group: g,
      label: GROUP_LABELS[g],
      items: buckets[g].sort((a, b) => getAchievementProgress(b) - getAchievementProgress(a)),
    }));
}

export function getTotalStars(achievements: Achievement[]): { earned: number; max: number } {
  const earned = achievements.reduce((sum, a) => sum + a.stars, 0);
  return { earned, max: achievements.length * 3 };
}

export function getAchievementIcon(name: string): keyof typeof Ionicons.glyphMap {
  const lower = name.toLowerCase();
  if (lower.includes('donat') || lower.includes('friend')) return 'hand-left-outline';
  if (lower.includes('builder') || lower.includes('build')) return 'hammer-outline';
  if (lower.includes('gold') || lower.includes('loot') || lower.includes('elixir') || lower.includes('collect')) return 'wallet-outline';
  if (lower.includes('war') || lower.includes('attack') || lower.includes('destroy') || lower.includes('conquer')) return 'flash-outline';
  if (lower.includes('clan') || lower.includes('capital')) return 'people-outline';
  if (lower.includes('trophy') || lower.includes('league')) return 'trophy-outline';
  if (lower.includes('spell')) return 'sparkles-outline';
  if (lower.includes('hero')) return 'shield-outline';
  return 'ribbon-outline';
}

export function getVillageLabel(village: Village): string {
  switch (village) {
    case 'home': return 'Home';
    case 'builderBase': return 'Builder';
    case 'clanCapital': return 'Capital';
    default: return village;
  }
}

export function formatAchievementValue(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}K`;
  return n.toLocaleString();
}
