// Army max levels per Town Hall, backed by the clash-of-clans-data package
// (via armyData.ts). No legacy th-levels.json.

import {
  getMaxLevelAtTH as getArmyMaxLevelAtTH,
  getAllItemsAtTH as getAllArmyItemsAtTH,
  getArmyItem,
} from './armyData';

export type UnlockableType = 'troop' | 'spell' | 'hero' | 'equipment';

export function getMaxLevelAtTH(itemName: string, thLevel: number): number | null {
  return getArmyMaxLevelAtTH(itemName, thLevel);
}

export function isMaxedAtTH(itemName: string, currentLevel: number, thLevel: number): boolean {
  const maxAtTH = getMaxLevelAtTH(itemName, thLevel);
  if (maxAtTH === null) return false;
  return currentLevel >= maxAtTH;
}

export function getThMaxInfo(
  itemName: string,
  thLevel: number,
): { maxLevel: number | null; isMaxAtTh: boolean; isGlobalMax: boolean } {
  const maxAtTH = getMaxLevelAtTH(itemName, thLevel);
  let globalMax = 0;
  const item = getArmyItem(itemName);
  if (item?.levels?.length) globalMax = Math.max(...item.levels.map((l) => l.level));
  return { maxLevel: maxAtTH, isMaxAtTh: false, isGlobalMax: globalMax > 0 };
}

export function getTroopsAtTH(thLevel: number): Record<string, number> {
  return itemsAtTH(thLevel, 'troop');
}

export function getSpellsAtTH(thLevel: number): Record<string, number> {
  return itemsAtTH(thLevel, 'spell');
}

export function getHeroesAtTH(thLevel: number): Record<string, number> {
  return itemsAtTH(thLevel, 'hero');
}

function itemsAtTH(thLevel: number, type: UnlockableType): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of getAllArmyItemsAtTH(thLevel)) {
    if (item.type === type) result[item.name] = item.maxLevel;
  }
  return result;
}

// Unlock Town Hall of each package army item, computed once and cached. An item
// is "unlockable" at the first Town Hall where it has at least one reachable level.
const unlockThCache = new Map<string, number>();

function getUnlockTh(name: string): number {
  const cached = unlockThCache.get(name);
  if (cached !== undefined) return cached;
  let unlockTh = 0;
  for (let th = 1; th <= 18; th++) {
    if (getMaxLevelAtTH(name, th) != null) {
      unlockTh = th;
      break;
    }
  }
  unlockThCache.set(name, unlockTh);
  return unlockTh;
}

export function getUnlockableItems(
  th: number,
  ownedNames: Set<string>,
): { name: string; type: UnlockableType; unlockTh: number }[] {
  const result: { name: string; type: UnlockableType; unlockTh: number }[] = [];
  for (const item of getAllArmyItemsAtTH(18)) {
    const unlockTh = getUnlockTh(item.name);
    if (unlockTh > 0 && unlockTh <= th && !ownedNames.has(item.name.toLowerCase())) {
      result.push({ name: item.name, type: item.type, unlockTh });
    }
  }
  return result.sort((a, b) => a.unlockTh - b.unlockTh);
}

export function getAllItemsAtTH(
  th: number,
): { name: string; type: UnlockableType; maxLevel: number }[] {
  return getAllArmyItemsAtTH(th);
}
