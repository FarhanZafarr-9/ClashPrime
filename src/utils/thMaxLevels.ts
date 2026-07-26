import staticData from '../data/th-levels.json';

const categories = (staticData as any).categories as Record<string, Record<string, Record<string, { level: number | null; isMaxLevel: boolean }>>>;

export function getMaxLevelAtTH(itemName: string, thLevel: number): number | null {
  for (const catName of Object.keys(categories)) {
    const cat = categories[catName];
    if (cat[itemName]) {
      const entry = cat[itemName][String(thLevel)];
      if (entry && entry.level !== null) return entry.level;
      return null;
    }
  }
  return null;
}

export function isMaxedAtTH(itemName: string, currentLevel: number, thLevel: number): boolean {
  const maxAtTH = getMaxLevelAtTH(itemName, thLevel);
  if (maxAtTH === null) return false;
  return currentLevel >= maxAtTH;
}

export function getThMaxInfo(itemName: string, thLevel: number): { maxLevel: number | null; isMaxAtTh: boolean; isGlobalMax: boolean } {
  let maxAtTH: number | null = null;
  let globalMax = 0;

  for (const catName of Object.keys(categories)) {
    const cat = categories[catName];
    if (cat[itemName]) {
      const thEntry = cat[itemName][String(thLevel)];
      if (thEntry && thEntry.level !== null) maxAtTH = thEntry.level;

      for (const key of Object.keys(cat[itemName])) {
        const e = (cat[itemName] as any)[key];
        if (e.level !== null && e.level > globalMax) globalMax = e.level;
      }
      break;
    }
  }

  return {
    maxLevel: maxAtTH,
    isMaxAtTh: false,
    isGlobalMax: globalMax > 0,
  };
}

export function getTroopsAtTH(thLevel: number): Record<string, number> {
  const result: Record<string, number> = {};
  for (const catName of ['Troops', 'Dark Troops']) {
    const cat = categories[catName];
    if (!cat) continue;
    for (const [name, levels] of Object.entries(cat)) {
      const entry = levels[String(thLevel)];
      if (entry && entry.level !== null) result[name] = entry.level;
    }
  }
  return result;
}

export function getSpellsAtTH(thLevel: number): Record<string, number> {
  const cat = categories['Spells'];
  if (!cat) return {};
  const result: Record<string, number> = {};
  for (const [name, levels] of Object.entries(cat)) {
    const entry = levels[String(thLevel)];
    if (entry && entry.level !== null) result[name] = entry.level;
  }
  return result;
}

export function getHeroesAtTH(thLevel: number): Record<string, number> {
  const cat = categories['Heroes'];
  if (!cat) return {};
  const result: Record<string, number> = {};
  for (const [name, levels] of Object.entries(cat)) {
    const entry = levels[String(thLevel)];
    if (entry && entry.level !== null) result[name] = entry.level;
  }
  return result;
}

export function getUnlockableItems(
  th: number,
  ownedNames: Set<string>,
): { name: string; type: 'troop' | 'spell'; unlockTh: number }[] {
  const result: { name: string; type: 'troop' | 'spell'; unlockTh: number }[] = [];
  const catKeys: [string, 'troop' | 'spell'][] = [['Troops', 'troop'], ['Dark Troops', 'troop'], ['Spells', 'spell']];

  for (const [catName, type] of catKeys) {
    const cat = (staticData as any).categories?.[catName];
    if (!cat) continue;
    for (const [itemName, levels] of Object.entries(cat)) {
      let unlockTh = Infinity;
      for (const [thKey, entry] of Object.entries(levels as any)) {
        if (entry && (entry as any).level !== null) {
          unlockTh = Math.min(unlockTh, parseInt(thKey, 10));
        }
      }
      if (unlockTh <= th && !ownedNames.has(itemName.toLowerCase())) {
        result.push({ name: itemName, type, unlockTh });
      }
    }
  }

  return result.sort((a, b) => a.unlockTh - b.unlockTh);
}
