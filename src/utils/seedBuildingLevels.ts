import buildingLevelsData from '../data/building-levels.json';
import { getMaxLevelAtTH } from './thMaxLevels';
import type { ClashPlayer } from '../types/clash';
import { isSuperTroop } from '../types/clash';

const NAME_REV: Record<string, string> = {
  "Builder's Hut": 'Builder Hut',
  'Laboratory': 'Lab',
  'Wall': 'Walls',
};

const BB_SUPPLEMENT: Record<string, Record<number, number>> = {
  'Builder Hall':         { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  'BB Cannon':            { 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  'Double Cannon':        { 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  'Guard Post':           { 6: 1, 7: 2, 8: 3, 9: 4, 10: 5 },
  "O.T.T.O's Outpost":    { 10: 3 },
  'Mega Tesla':           { 9: 1, 10: 3 },
  'Push Trap':            { 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  'Gem Mine':             { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 7, 10: 9 },
  'Builder Barracks':     { 2: 2, 3: 4, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 12 },
  'Star Laboratory':      { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7 },
  'Battle Machine Altar': { 5: 1, 6: 5, 7: 10, 8: 15, 9: 20, 10: 25 },
  'Reinforcement Camp':   { 8: 1, 9: 2, 10: 3 },
  'Healing Hut':          { 8: 1, 9: 2, 10: 3 },
  'Battle Copter Altar':  { 9: 1, 10: 10 },
  'Clock Tower':          { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7 },
  "B.O.T.O's Shack":      { 10: 1 },
  'Elixir Cart':          { 1: 1 },
};

export function seedBuildingLevelsForTH(
  player: ClashPlayer | null | undefined,
  selectedTh: number,
  opts: { currentTh?: number } = {},
): Record<string, number> {
  const currentTh = opts.currentTh ?? player?.townHallLevel ?? selectedTh;
  const currentBh = player?.builderHallLevel ?? 1;
  const levels: Record<string, number> = {};
  const known = (buildingLevelsData as any[]) || [];

  for (const b of known) {
    if (b.village === 'builderBase') continue;
    const storeName = NAME_REV[b.name] || b.name;
    const unlockTh = b.levels?.[0]?.['Town Hall Level'] ?? 99;
    const globalMax = b.maxLevel || (b.levels ? b.levels.length : 0);
    const thMax = getMaxLevelAtTH(storeName, selectedTh);
    const effectiveMax = thMax != null ? Math.min(globalMax, thMax) : globalMax;

    if (unlockTh <= selectedTh) {
      levels[storeName] = effectiveMax > 0 ? effectiveMax : 1;
    } else if (unlockTh <= currentTh) {
      levels[storeName] = 1;
    } else {
      levels[storeName] = 0;
    }
  }

  if (player) {
    const homeTroops = (player.troops || []).filter((t: any) => t.village === 'home' && !isSuperTroop(t.name));
    const homeSpells = (player.spells || []).filter((s: any) => s.village === 'home');
    const heroes = player.heroes || [];
    const equipment = player.heroEquipment || [];

    function inferLevel(buildingName: string, column: string, items: { name: string }[]): number {
      const b = known.find((x: any) => x.name === buildingName);
      if (!b) return 0;
      let level = 0;
      for (const lev of b.levels || []) {
        const val: string = lev[column] || '';
        if (!val) continue;
        if (items.some((i) => val === i.name || val.includes(i.name) || i.name.includes(val))) {
          level = Math.max(level, lev.Level);
        }
      }
      return level;
    }

    const setIf = (jsonName: string, lvl: number) => { if (lvl > 0) levels[NAME_REV[jsonName] || jsonName] = lvl; };

    setIf('Barracks', inferLevel('Barracks', 'Unlocked Unit', homeTroops));
    setIf('Dark Barracks', inferLevel('Dark Barracks', 'Unlocked Unit', homeTroops));
    setIf('Spell Factory', inferLevel('Spell Factory', 'Spell(s) Unlocked', homeSpells));
    setIf('Dark Spell Factory', inferLevel('Dark Spell Factory', 'Spell(s) Unlocked', homeSpells));
    setIf('Blacksmith', inferLevel('Blacksmith', 'Equipment Unlocked', equipment));
    setIf('Hero Hall', inferLevel('Hero Hall', 'Unlocked Hero', heroes));
  }

  const bbKnown = known.filter((b: any) => b.village === 'builderBase');
  for (const b of bbKnown) {
    const storeName = NAME_REV[b.name] || b.name;
    const unlockBh = b.levels?.[0]?.['Town Hall Level'] ?? 99;
    const globalMax = b.maxLevel || (b.levels ? b.levels.length : 0);
    const bhLevels = b.levels.filter((l: any) => (l['Town Hall Level'] ?? 99) <= currentBh);
    const effectiveMax = bhLevels.length > 0 ? Math.max(...bhLevels.map((l: any) => l.Level)) : 0;

    if (unlockBh <= currentBh) {
      levels[storeName] = effectiveMax > 0 ? effectiveMax : 1;
    } else {
      levels[storeName] = 0;
    }
  }

  for (const [name, bhs] of Object.entries(BB_SUPPLEMENT)) {
    const maxInRange = Math.max(...Object.entries(bhs).filter(([bh]) => Number(bh) <= currentBh).map(([, lvl]) => lvl), 0);
    if (maxInRange > 0) levels[name] = maxInRange;
  }

  return levels;
}
