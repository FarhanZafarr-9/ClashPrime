import type { RankedProjection } from './rankedLeagueProjection';

/** A disclosed stress scenario, not a calibrated prediction of matchmaking. */
export function rankedMatchupScenario(projection: RankedProjection, trophies: number | null, toughAttacks: number, toughScore: number) {
  const left = projection.attacksLeft;
  const average = projection.attackAverage;
  if (!projection.supported || trophies == null || !Number.isFinite(trophies) || trophies < 0 || left == null || !Number.isInteger(toughAttacks) || toughAttacks < 0 || !Number.isFinite(toughScore) || toughScore < 0 || toughScore > 40) return null;
  const count = Math.min(left, toughAttacks);
  // A tough matchup cannot improve an already lower observed average.
  const score = average == null ? null : Math.min(average, toughScore);
  const rawGain = left === 0 ? 0 : average == null || score == null ? null : (left - count) * average + count * score;
  const gain = rawGain == null ? null : Math.round(rawGain);
  const defense = projection.expectedDefenseGain == null ? null : Math.round(projection.expectedDefenseGain);
  const total = gain == null || defense == null ? null : Math.round(trophies + gain + defense);
  return {
    toughAttacks: count, toughScore: score, attackGain: gain,
    average: rawGain == null || left === 0 ? null : rawGain / left,
    total,
    cutoffMargin: total == null || projection.cutoff == null ? null : total - (projection.cutoff.max + 1),
  };
}
