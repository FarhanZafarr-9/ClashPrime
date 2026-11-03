import type { ClashPlayer } from '../types/clash';
import type { CocImportResult } from './cocExport';
import { getBuildingCopies, getCountAtTH } from './buildingCopies';
import { getBuildingEffectiveMax } from './buildingImages';
import { isBuilderName } from './buildingData';

type CraftedLevels = NonNullable<ClashPlayer['craftedLevels']>;

/** Merge per module so an old export cannot undo completed upgrades or omit saved modules. */
export function preserveCraftedLevels(current: CraftedLevels = {}, imported: CraftedLevels): CraftedLevels {
  const merged: CraftedLevels = {};
  for (const [name, modules] of Object.entries(imported)) {
    merged[name] = { ...current[name] };
    for (const [module, level] of Object.entries(modules)) merged[name][module] = Math.max(current[name]?.[module] ?? 0, level);
  }
  return merged;
}

export function preservedImportLevels(result: CocImportResult, player: ClashPlayer): { buildings: number; modules: number } {
  let buildings = 0, modules = 0;
  for (const item of result.resolved) {
    const builder = isBuilderName(item.storeName);
    const cap = builder ? player.builderHallLevel ?? 1 : player.townHallLevel;
    const max = getBuildingEffectiveMax(item.storeName, cap);
    if (max <= 0) continue;
    const saved = getBuildingCopies(item.storeName, player.buildingLevels, player.buildings, max, getCountAtTH(item.storeName, cap), player.lastMaxedTH, builder ? undefined : cap).levels.sort((a, b) => b - a);
    const imported = [...item.levels].map(level => Math.min(level, max)).sort((a, b) => b - a);
    for (let i = 0; i < imported.length && i < saved.length; i++) if (saved[i] > imported[i]) buildings++;
  }
  for (const defense of result.crafted ?? []) {
    for (const module of defense.modules) if ((player.craftedLevels?.[defense.displayName]?.[module.name] ?? 0) > module.level) modules++;
  }
  return { buildings, modules };
}

/** Recheck proposed copy levels against the destination immediately before writing. */
export function preserveBuildingCopyLevels(player: ClashPlayer, proposed: { name: string; levels: number[]; maxLevel: number }[]) {
  return proposed.map(item => {
    const builder = isBuilderName(item.name);
    const cap = builder ? player.builderHallLevel ?? 1 : player.townHallLevel;
    const maxLevel = getBuildingEffectiveMax(item.name, cap);
    const current = getBuildingCopies(item.name, player.buildingLevels, player.buildings, maxLevel, getCountAtTH(item.name, cap), player.lastMaxedTH, builder ? undefined : cap).levels.sort((a, b) => b - a);
    const imported = [...item.levels].sort((a, b) => b - a);
    return { name: item.name, maxLevel, levels: current.map((level, index) => Math.max(level, Math.min(imported[index] ?? level, maxLevel))) };
  });
}
