import { rankedBattles } from 'clash-of-clans-data';

export interface PercentRange { min: number; max: number }
export interface RankedProjectionRules {
  name: string;
  mode: 'weekly' | 'legend-daily' | 'unsupported';
  battles: number | null;
  minGroupSize: number;
  promotion: PercentRange | null;
  demotion: PercentRange | null;
  fixedPromotionSlots?: number;
  packageDiffers: boolean;
}

// The bundled 0.19.1 dataset predates these changes. Keep current corrections
// separate from generated package data; do not silently use known-stale limits.
// https://supercell.com/en/games/clashofclans/blog/release-notes/the-sound-of-clash-update/
// https://support.supercell.com/clash-of-clans/en/articles/ranked-leagues-4.html
const CURRENT: Record<string, [number, number, number, number, number, number]> = {
  skeleton: [6, 50, 50, 0, 5, 15],
  barbarian: [6, 50, 50, 5, 5, 15],
  archer: [8, 40, 50, 5, 5, 20],
  wizard: [8, 35, 50, 10, 10, 20],
  valkyrie: [10, 35, 50, 10, 10, 25],
  witch: [10, 35, 50, 10, 10, 25],
  golem: [12, 35, 50, 10, 10, 30],
  pekka: [12, 30, 50, 15, 15, 30],
  titan: [12, 30, 50, 15, 15, 30],
  dragon: [14, 25, 30, 15, 15, 40],
  electro: [18, 15, 20, 15, 15, 50],
};
const normalized = (name: string) => name.toLowerCase().replace(/league|[^a-z0-9]/g, '');

export function getRankedProjectionRules(name: string | null | undefined): RankedProjectionRules | null {
  if (!name) return null;
  const key = normalized(name);
  if (key === 'legendiii' || key === 'legend3' || key === 'legendii' || key === 'legend2') {
    const third = key === 'legendiii' || key === 'legend3';
    return { name, mode: 'weekly', battles: third ? 24 : 30, minGroupSize: 100, promotion: { min: third ? 5 : 3, max: third ? 5 : 3 }, demotion: { min: 15, max: 15 }, fixedPromotionSlots: third ? 5 : 3, packageDiffers: true };
  }
  if (key === 'legendi' || key === 'legend1') return { name, mode: 'legend-daily', battles: 8, minGroupSize: 0, promotion: null, demotion: null, packageDiffers: true };
  const packaged = rankedBattles().leagues().get().find(league => normalized(league.name) === key);
  const group = packaged?.leagueGroup.toLowerCase().replace(/[^a-z]/g, '');
  const row = group ? CURRENT[group] : undefined;
  if (!packaged || !row) return null;
  const [battles, promotionMin, promotionMax, demotionMin, demotionMax, minGroupSize] = row;
  return {
    name: packaged.name, mode: 'weekly', battles, minGroupSize,
    promotion: { min: promotionMin, max: promotionMax },
    demotion: { min: demotionMin, max: demotionMax },
    packageDiffers: packaged.attacksPerWeek !== battles || packaged.percentPromoted !== promotionMin || promotionMin !== promotionMax || packaged.percentDemoted !== demotionMin || demotionMin !== demotionMax,
  };
}
