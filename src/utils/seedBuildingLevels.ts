import type { ClashPlayer } from '../types/clash';
import { isSuperTroop } from '../types/clash';
import {
  BB_BUILDINGS,
  HOME_CATEGORIES,
  getBuildingDetail,
  getBuildingItem,
  getBuildingMaxLevelAtBH,
  getBuildingMaxLevelAtTH,
} from './buildingData';

/**
 * Seed every building level as if the account only ever progressed to
 * `selectedTh`. Home Village buildings unlock at their TH and start maxed for
 * that TH (the app can measure them). Builder Base buildings are NOT measurable
 * by the API, so they are seeded at level 1 the moment they unlock — never at
 * their max (the Builder Hall itself always matches the Builder Hall level).
 */
export function seedBuildingLevelsForTH(
  player: ClashPlayer | null | undefined,
  selectedTh: number,
  opts: { currentTh?: number } = {},
): Record<string, number> {
  const currentTh = opts.currentTh ?? player?.townHallLevel ?? selectedTh;
  const currentBh = player?.builderHallLevel ?? 1;
  const levels: Record<string, number> = {};

  function homeUnlockTH(display: string): number {
    const item = getBuildingItem(display, false);
    const l1 = item?.levels?.find((l) => l.level === 1);
    return l1?.townHallRequired ?? 99;
  }

  for (const names of Object.values(HOME_CATEGORIES)) {
    for (const display of names) {
      if (display === 'Town Hall') {
        // The Town Hall's own level always equals the Town Hall level.
        levels[display] = selectedTh;
        continue;
      }
      const unlockTh = homeUnlockTH(display);
      const effectiveMax = getBuildingMaxLevelAtTH(display, selectedTh) ?? 0;

      if (unlockTh <= selectedTh) {
        levels[display] = effectiveMax > 0 ? effectiveMax : 1;
      } else if (unlockTh <= currentTh) {
        levels[display] = 1;
      } else {
        levels[display] = 0;
      }
    }
  }

  if (player) {
    const homeTroops = (player.troops || []).filter((t: any) => t.village === 'home' && !isSuperTroop(t.name));
    const homeSpells = (player.spells || []).filter((s: any) => s.village === 'home');
    const heroes = player.heroes || [];

    function inferLevel(display: string, column: string, items: { name: string }[]): number {
      const detail = getBuildingDetail(display, { builderBase: false });
      if (!detail) return 0;
      let level = 0;
      for (const lev of detail.levels) {
        const val: string = lev[column] || '';
        if (!val) continue;
        // Rows that unlock nothing come back as the placeholder '-', and the
        // `includes` test below would match any item name containing a hyphen
        // against every one of them, reporting the building as maxed.
        if (val === '-') continue;
        if (items.some((i) => val === i.name || val.includes(i.name) || i.name.includes(val))) {
          level = Math.max(level, lev.Level);
        }
      }
      return level;
    }

    const setIf = (name: string, lvl: number) => { if (lvl > 0) levels[name] = lvl; };

    setIf('Barracks', inferLevel('Barracks', 'Unlocked Unit', homeTroops));
    setIf('Dark Barracks', inferLevel('Dark Barracks', 'Unlocked Unit', homeTroops));
    setIf('Spell Factory', inferLevel('Spell Factory', 'Unlocked Spell', homeSpells));
    setIf('Dark Spell Factory', inferLevel('Dark Spell Factory', 'Unlocked Spell', homeSpells));
    setIf('Hero Hall', inferLevel('Hero Hall', 'Unlocked Hero', heroes));
    // The Blacksmith is deliberately NOT inferred from owned equipment. Each of
    // its levels unlocks exactly one piece, so the best item a player holds
    // reports only the Blacksmith level that piece unlocked at - a lower bound,
    // never their real Blacksmith. That lower bound is what the Army tab capped
    // equipment with, so a maxed Blacksmith holding mid-tier gear showed fully
    // upgraded equipment as not maxed, and flipped to maxed whenever the
    // inference missed and the seed's max-at-TH value survived. Equipment maxes
    // by Town Hall instead, matching getMaxLevelAtTH and armyScore.
  }

  for (const display of BB_BUILDINGS) {
    const unlocked = getBuildingMaxLevelAtBH(display, currentBh) != null;
    if (!unlocked) {
      levels[display] = 0;
      continue;
    }
    if (display === 'Builder Hall') {
      // The Builder Hall's own level always equals the Builder Hall level.
      levels[display] = getBuildingMaxLevelAtBH(display, currentBh) ?? 1;
    } else {
      levels[display] = 1;
    }
  }

  return levels;
}
