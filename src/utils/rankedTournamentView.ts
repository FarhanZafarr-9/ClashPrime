import type { RankedLeagueMember, RankedLeagueStats } from '../types/rankedLeague';
import type { CountRange, RankedProjection } from './rankedLeagueProjection';

export const rankedNumber = (value: number | null | undefined) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString([], { maximumFractionDigits: 1 });
export const rankedRange = (range: CountRange | null | undefined) => range == null ? '—' : range.min === range.max ? rankedNumber(range.min) : rankedNumber(range.min) + '–' + rankedNumber(range.max);
const tagKey = (tag: string) => tag.replace(/^#/, '').toUpperCase();
const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const officialRank = (member: RankedLeagueMember) => {
  const rank = member.rank ?? member.placement;
  return valid(rank) && rank > 0 ? rank : null;
};

export function tournamentStatus(projection: RankedProjection | null): string {
  if (!projection?.supported || projection.outlook === 'unavailable') return 'Tournament outlook unavailable';
  if (projection.outlook === 'secured') return 'Promotion secured';
  if (projection.outlook === 'out-of-reach') return 'Promotion out of reach';
  if (projection.currentZone === 'above-band') return 'Above the current promotion line';
  if (projection.currentZone === 'at-band') return 'At the current promotion band';
  return 'Promotion still open';
}

export interface TournamentStanding {
  member: RankedLeagueMember;
  index: number;
  position: number | null;
  tied: boolean;
  official: boolean;
  self: boolean;
  attacksLeft: number | null;
  zone: 'promotion' | 'uncertain' | 'demotion' | 'neutral';
}

export function tournamentStandings(stats: RankedLeagueStats, playerTag: string, battleLimit: number | null, promotion: CountRange | null, demotion: CountRange | null): TournamentStanding[] {
  const official = stats.members.length > 0 && stats.members.every(member => officialRank(member) != null);
  const sorted = stats.members.filter(member => typeof member.playerTag === 'string').slice().sort((a, b) => official ? officialRank(a)! - officialRank(b)! : (valid(b.leagueTrophies) ? b.leagueTrophies : -Infinity) - (valid(a.leagueTrophies) ? a.leagueTrophies : -Infinity));
  const completeScores = sorted.every(member => valid(member.leagueTrophies));
  return sorted.map((member, index) => {
    const scored = valid(member.leagueTrophies);
    const position = official ? officialRank(member) : scored && completeScores ? 1 + sorted.filter(other => valid(other.leagueTrophies) && other.leagueTrophies > member.leagueTrophies!).length : null;
    const tieCount = !official && scored ? sorted.filter(other => other.leagueTrophies === member.leagueTrophies).length : 1;
    const lastTiedPlace = position == null ? null : position + tieCount - 1;
    let zone: TournamentStanding['zone'] = 'neutral';
    if (position != null && lastTiedPlace != null) {
      if (promotion && promotion.min > 0 && lastTiedPlace <= promotion.min) zone = 'promotion';
      else if (promotion && position <= promotion.max) zone = 'uncertain';
      if (demotion && demotion.min > 0 && position > sorted.length - demotion.min) zone = 'demotion';
      else if (demotion && demotion.max > 0 && lastTiedPlace > sorted.length - demotion.max) zone = 'uncertain';
    }
    const used = valid(member.attackWinCount) && valid(member.attackLoseCount) && Number.isInteger(member.attackWinCount) && Number.isInteger(member.attackLoseCount) && member.attackWinCount >= 0 && member.attackLoseCount >= 0 ? member.attackWinCount + member.attackLoseCount : null;
    return { member, index, position, tied: tieCount > 1, official, self: tagKey(member.playerTag) === tagKey(playerTag), attacksLeft: battleLimit != null && used != null && used <= battleLimit ? battleLimit - used : null, zone };
  });
}

export function nearbyStandings(rows: TournamentStanding[], promotion: CountRange | null): TournamentStanding[] {
  const self = rows.findIndex(row => row.self);
  const center = self < 0 ? 0 : self;
  const indices = new Set([0]);
  for (let i = Math.max(0, center - 2); i <= Math.min(rows.length - 1, center + 2); i++) indices.add(i);
  if (promotion) { indices.add(promotion.min - 1); indices.add(promotion.max - 1); }
  return rows.filter((_, index) => indices.has(index));
}
