import type { ClashPlayer } from '../types/clash';
import type { ImportedUpgrade } from '../types/importedUpgrade';
import { getBuildingCopies, getCountAtTH, toJsonName } from './buildingCopies';
import { getBuildingEffectiveMax } from './buildingImages';
import { mergeBuildingCopies } from '../hooks/usePlayer';

/** Applying a confirmed completion must never regress an API-synced level. */
export function applyImportedCompletion(player: ClashPlayer, row: ImportedUpgrade, requiredCopies = 1): ClashPlayer {
  if (row.kind === 'buildings' && row.storeName) {
    if (row.name === 'Town Hall') return { ...player, townHallLevel: Math.max(player.townHallLevel, row.targetLevel) };
    if (row.name === 'Builder Hall') return { ...player, builderHallLevel: Math.max(player.builderHallLevel ?? 0, row.targetLevel) };
    const cap = row.village === 'builderBase' ? player.builderHallLevel ?? 1 : player.townHallLevel;
    const max = getBuildingEffectiveMax(row.storeName, cap);
    if (max < row.targetLevel) return player;
    const copies = getBuildingCopies(row.storeName, player.buildingLevels, player.buildings, max, getCountAtTH(row.storeName, cap), player.lastMaxedTH, row.village === 'home' ? cap : undefined);
    const levels = [...copies.levels];
    if (levels.filter(l => l >= row.targetLevel).length >= requiredCopies) return player;
    const index = levels.findIndex(l => l === row.level);
    if (index < 0) return player;
    levels[index] = row.targetLevel;
    return {
      ...player,
      buildingLevels: { ...player.buildingLevels, [row.storeName]: Math.max(...levels) },
      buildings: mergeBuildingCopies(player.buildings, [{ name: row.storeName, levels, maxLevel: max }]),
    };
  }
  if (row.kind === 'other') return player;
  if (row.kind === 'buildings') return player;
  const units = player[row.kind] ?? [];
  return { ...player, [row.kind]: units.map(unit => unit.name === row.name && unit.village === row.village ? { ...unit, level: Math.min(unit.maxLevel, Math.max(unit.level, row.targetLevel)) } : unit) };
}

export function isImportedCompletionSynced(player: ClashPlayer, row: ImportedUpgrade, requiredCopies: number): boolean {
  if (row.kind === 'other') return false;
  if (row.kind === 'buildings') {
    if (row.name === 'Town Hall') return player.townHallLevel >= row.targetLevel;
    if (row.name === 'Builder Hall') return (player.builderHallLevel ?? 0) >= row.targetLevel;
    const name = toJsonName(row.storeName ?? row.name);
    return (player.buildings ?? []).filter(b => b.name === name && b.level >= row.targetLevel).length >= requiredCopies;
  }
  return (player[row.kind] ?? []).some(unit => unit.name === row.name && unit.village === row.village && unit.level >= row.targetLevel);
}
