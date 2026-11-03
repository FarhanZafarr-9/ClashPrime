import type { RankedLeagueGroup, RankedLeagueStats } from '../types/rankedLeague';

const numberOrNull = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const tagKey = (tag: string) => tag.replace(/^#/, '').toUpperCase();

/** Use group counters, never the legacy player-profile PvP fields. */
export function rankedLeagueStats(group: RankedLeagueGroup, playerTag: string): RankedLeagueStats | null {
  const members = group.members ?? [];
  const member = members.find(item => typeof item.playerTag === 'string' && tagKey(item.playerTag) === tagKey(playerTag));
  if (!member) return null;
  const trophies = numberOrNull(member.leagueTrophies);
  const suppliedRank = numberOrNull(member.rank) ?? numberOrNull(member.placement);
  const official = suppliedRank != null && suppliedRank > 0 ? suppliedRank : null;
  // Missing scores make a derived standing unreliable. Trophies cannot resolve tie-breaks.
  const canCompare = trophies != null && members.every(item => numberOrNull(item.leagueTrophies) != null);
  return {
    members,
    attackLogs: Array.isArray(group.attackLogs) ? group.attackLogs : null,
    defenseLogs: Array.isArray(group.defenseLogs) ? group.defenseLogs : null,
    trophies,
    position: official ?? (canCompare ? 1 + members.filter(item => item.leagueTrophies! > trophies!).length : null),
    positionIsOfficial: official != null,
    tied: canCompare && members.some(item => item !== member && item.leagueTrophies === trophies),
    groupSize: members.length,
    attackWins: numberOrNull(member.attackWinCount),
    attackLosses: numberOrNull(member.attackLoseCount),
    defenseWins: numberOrNull(member.defenseWinCount),
    defenseLosses: numberOrNull(member.defenseLoseCount),
  };
}
