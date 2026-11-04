import type { RankedLeagueStats, RankedLeagueMember, RankedBattleLog } from '../types/rankedLeague';
import type { RankedProjectionRules } from './rankedLeagueRules';

export interface CountRange { min: number; max: number }
export interface RankedProjection {
  supported: boolean;
  attacksDone: number | null;
  defensesDone: number | null;
  attacksLeft: number | null;
  defensesLeft: number | null;
  attackAverage: number | null;
  defenseAverage: number | null;
  expectedDefenseGain: number | null;
  projectedTotal: number | null;
  threeStarTotal: number | null;
  maximumTotal: number | null;
  promotionSlots: CountRange | null;
  demotionSlots: CountRange | null;
  cutoff: CountRange | null;
  trophiesToClear: number | null;
  triplesToClear: number | null;
  bestPlace: number | null;
  worstPlace: number | null;
  outlook: 'secured' | 'out-of-reach' | 'open' | 'unavailable';
  currentZone: 'above-band' | 'at-band' | 'below-band' | null;
  notes: string[];
}

const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function completed(wins: unknown, losses: unknown, limit: number): number | null {
  if (!numeric(wins) || !numeric(losses) || !Number.isInteger(wins) || !Number.isInteger(losses) || wins < 0 || losses < 0 || wins + losses > limit) return null;
  return wins + losses;
}
function logTotal(logs: RankedBattleLog[] | null, count: number | null): number | null {
  if (count == null || !logs || logs.length !== count || !logs.every(log => numeric(log.trophies) && log.trophies >= 0 && log.trophies <= 40)) return null;
  return logs.reduce((sum, log) => sum + log.trophies!, 0);
}
function slots(size: number, percent: CountRange | null, fixed?: number): CountRange | null {
  if (fixed != null) return { min: Math.min(size, fixed), max: Math.min(size, fixed) };
  if (!percent) return null;
  // Published percentages do not specify fractional-player rounding; retain a band.
  return { min: Math.min(size, Math.floor(size * percent.min / 100)), max: Math.min(size, Math.ceil(size * percent.max / 100)) };
}
function memberMaximum(member: RankedLeagueMember, limit: number): number | null {
  const attacks = completed(member.attackWinCount, member.attackLoseCount, limit);
  const defenses = completed(member.defenseWinCount, member.defenseLoseCount, limit);
  if (attacks == null || defenses == null || !numeric(member.leagueTrophies) || member.leagueTrophies < 0) return null;
  return member.leagueTrophies + 40 * (2 * limit - attacks - defenses);
}

/** Weekly ranked scenarios. No fabricated percentage probabilities or unknown tie-breaks. */
export function projectRankedLeague(stats: RankedLeagueStats, rules: RankedProjectionRules | null, playerTag: string): RankedProjection {
  const result: RankedProjection = { supported: false, attacksDone: null, defensesDone: null, attacksLeft: null, defensesLeft: null, attackAverage: null, defenseAverage: null, expectedDefenseGain: null, projectedTotal: null, threeStarTotal: null, maximumTotal: null, promotionSlots: null, demotionSlots: null, cutoff: null, trophiesToClear: null, triplesToClear: null, bestPlace: null, worstPlace: null, outlook: 'unavailable', currentZone: null, notes: [] };
  if (!rules || rules.mode !== 'weekly' || rules.battles == null) {
    result.notes.push(rules?.mode === 'legend-daily' ? 'Legend I uses daily battles and negative defenses; weekly projections do not apply.' : 'Current tournament rules are unavailable for this league.');
    return result;
  }
  if ([...(stats.attackLogs ?? []), ...(stats.defenseLogs ?? [])].some(log => numeric(log.trophies) && (log.trophies < 0 || log.trophies > 40))) {
    result.notes.push('The battle log does not match the weekly 0–40 trophy rules; projections are unavailable.');
    return result;
  }
  result.supported = true;
  const limit = rules.battles;
  result.attacksDone = completed(stats.attackWins, stats.attackLosses, limit);
  result.defensesDone = completed(stats.defenseWins, stats.defenseLosses, limit);
  result.attacksLeft = result.attacksDone == null ? null : limit - result.attacksDone;
  result.defensesLeft = result.defensesDone == null ? null : limit - result.defensesDone;
  const attackTotal = logTotal(stats.attackLogs, result.attacksDone);
  const defenseTotal = logTotal(stats.defenseLogs, result.defensesDone);
  result.attackAverage = attackTotal == null || !result.attacksDone ? null : attackTotal / result.attacksDone;
  result.defenseAverage = defenseTotal == null || !result.defensesDone ? null : defenseTotal / result.defensesDone;
  const scoreValid = numeric(stats.trophies) && stats.trophies >= 0;
  // Do not add estimated defenses if the current score already includes points
  // outside the complete logs (for example, defenses that have already been filled).
  const completeLogs = attackTotal != null && defenseTotal != null;
  const consistentScore = completeLogs && scoreValid && Math.abs(stats.trophies! - attackTotal - defenseTotal) < 1.01;
  if (scoreValid && result.attacksLeft != null && result.defensesLeft != null) result.maximumTotal = stats.trophies! + 40 * (result.attacksLeft + result.defensesLeft);
  if (consistentScore && result.defensesLeft != null) {
    result.expectedDefenseGain = result.defensesLeft === 0 ? 0 : result.defenseAverage == null ? null : Math.round(result.defenseAverage * result.defensesLeft);
    const attackGain = result.attacksLeft === 0 ? 0 : result.attacksLeft == null || result.attackAverage == null ? null : Math.round(result.attackAverage * result.attacksLeft);
    if (result.expectedDefenseGain != null && attackGain != null) result.projectedTotal = stats.trophies! + attackGain + result.expectedDefenseGain;
    if (result.expectedDefenseGain != null && result.attacksLeft != null) result.threeStarTotal = stats.trophies! + 40 * result.attacksLeft + result.expectedDefenseGain;
  }
  if (!completeLogs) result.notes.push('Pace and defense estimates need complete battle logs; missing entries are not treated as zero.');
  else if (!consistentScore) result.notes.push('The score includes points outside the battle logs; extra defense points are not added again.');
  else if (result.defensesLeft! > 0 && result.defenseAverage == null) result.notes.push('No completed defenses yet; a defensive average cannot be estimated.');
  if (result.expectedDefenseGain != null && result.defensesLeft! > 0) result.notes.push('Defense fill estimate: your current defensive average × remaining defenses.');
  const members = stats.members;
  const uniqueMembers = new Set(members.filter(member => typeof member.playerTag === 'string').map(member => member.playerTag.replace(/^#/, '').toUpperCase())).size === members.length;
  const completeGroup = uniqueMembers && members.length >= rules.minGroupSize && members.length === stats.groupSize && members.every(member => typeof member.playerTag === 'string' && numeric(member.leagueTrophies) && member.leagueTrophies >= 0);
  if (!completeGroup) {
    result.notes.push('A complete group scoreboard is needed to calculate the promotion line.');
    return result;
  }
  result.promotionSlots = slots(members.length, rules.promotion, rules.fixedPromotionSlots);
  result.demotionSlots = slots(members.length, rules.demotion);
  const places = result.promotionSlots;
  if (!places || places.min < 1) return result;
  const scores = members.map(member => member.leagueTrophies!).sort((a, b) => b - a);
  result.cutoff = { min: scores[places.max - 1], max: scores[places.min - 1] };
  if (scoreValid) {
    result.trophiesToClear = Math.max(0, result.cutoff.max + 1 - stats.trophies!);
    result.currentZone = stats.trophies! > result.cutoff.max ? 'above-band' : stats.trophies! < result.cutoff.min ? 'below-band' : 'at-band';
    if (result.expectedDefenseGain != null && result.attacksLeft != null) {
      // Use the stricter end of the current promotion band and require exceeding ties.
      result.triplesToClear = Math.max(0, Math.ceil((result.cutoff.max + 1 - stats.trophies! - result.expectedDefenseGain) / 40));
    }
  }
  const sameTag = (tag: string) => tag.replace(/^#/, '').toUpperCase();
  const others = members.filter(member => sameTag(member.playerTag) !== sameTag(playerTag));
  if (others.length !== members.length - 1 || result.maximumTotal == null || !scoreValid) return result;
  result.bestPlace = 1 + others.filter(member => member.leagueTrophies! > result.maximumTotal!).length;
  const possibleMaxima = others.map(member => memberMaximum(member, limit));
  if (possibleMaxima.every(numeric)) result.worstPlace = 1 + possibleMaxima.filter(value => value! >= stats.trophies!).length;
  result.outlook = result.worstPlace != null && result.worstPlace <= places.min ? 'secured' : result.bestPlace > places.max ? 'out-of-reach' : 'open';
  result.notes.push('The cutoff is live and can rise as opponents play. Projections are scenarios, not promotion probabilities.');
  return result;
}
