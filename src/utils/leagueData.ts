// Ranked-battles league details (loot, star bonus, schedule, next league),
// sourced exclusively from the clash-of-clans-data package.

import { rankedBattles } from 'clash-of-clans-data';

export interface LeagueAmount {
  gold: number | null;
  dark: number | null;
}

export interface LeagueStarBonus extends LeagueAmount {
  shiny: number | null;
  glowy: number | null;
  starry: number | null;
}

export interface LeagueLootInfo {
  leagueId: string;
  leagueName: string;
  attacksPerWeek: number | null;
  percentPromoted: number | null;
  percentDemoted: number | null;
  /** True when this league sits below the player's Town Hall league floor. */
  underfloor: boolean;
  /** Max loot stealable from an opponent's base (null for Unranked / TH below 7). */
  loot: LeagueAmount | null;
  /** Max bonus earned from winning a battle in this league. */
  bonus: LeagueAmount | null;
  /** Weekly star bonus (8 stars). */
  star: LeagueStarBonus | null;
  /** The league immediately above the current one. */
  next: { name: string; star: LeagueAmount | null } | null;
  /** Minimum league the player cannot be demoted below at their Town Hall. */
  floor: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s*league\s*/g, ' ').replace(/\s+/g, ' ').trim();

export function getLeagueLootInfo(
  leagueName: string | null | undefined,
  townHallLevel: number,
): LeagueLootInfo | null {
  const th = Math.max(0, Math.floor(townHallLevel || 0));
  const all = rankedBattles().leagues().get();
  if (!all.length) return null;

  const target = norm(leagueName || '');
  const league = (() => {
    if (target) {
      const hit = all.find((l) => norm(l.name) === target);
      if (hit) return hit;
    }
    return all.find((l) => l.leagueGroup === leagueName) ?? null;
  })();
  if (!league) return null;

  let lootRows = th >= 7 ? rankedBattles().loot(th) : [];
  const entry = lootRows.find((l) => l.leagueId === league.id);

  const lowerBonus = th > 0 && th < 7
    ? rankedBattles().lowerThBonuses().find((b) => b.townHallLevel === th)
    : undefined;

  const nextIdx = all.findIndex((l) => l.id === league.id);
  const next = (() => {
    if (nextIdx < 0 || nextIdx >= all.length - 1) return null;
    const n = all[nextIdx + 1];
    const nEntry = lootRows.find((l) => l.leagueId === n.id);
    return {
      name: n.name,
      star: nEntry
        ? { gold: nEntry.starBonus.goldAndElixir, dark: nEntry.starBonus.darkElixir }
        : null,
    };
  })();

  const floorId = rankedBattles().floorForTownHall(th)?.leagueId ?? null;

  return {
    leagueId: league.id,
    leagueName: league.name,
    attacksPerWeek: league.attacksPerWeek,
    percentPromoted: league.percentPromoted,
    percentDemoted: league.percentDemoted,
    underfloor: entry ? entry.underfloor : false,
    loot: entry
      ? { gold: entry.maxAvailableLoot.goldAndElixir, dark: entry.maxAvailableLoot.darkElixir }
      : null,
    bonus: entry
      ? { gold: entry.maxLeagueBonus.goldAndElixir, dark: entry.maxLeagueBonus.darkElixir }
      : lowerBonus
        ? { gold: lowerBonus.maxLeagueBonus, dark: null }
        : null,
    star: entry
      ? {
          gold: entry.starBonus.goldAndElixir,
          dark: entry.starBonus.darkElixir,
          shiny: entry.starBonus.shinyOre,
          glowy: entry.starBonus.glowyOre,
          starry: entry.starBonus.starryOre,
        }
      : lowerBonus
        ? { gold: lowerBonus.starBonus, dark: null, shiny: null, glowy: null, starry: null }
        : null,
    next,
    floor: floorId ? all.find((l) => l.id === floorId)?.name ?? null : null,
  };
}
