import type { ClashPlayer } from '../types/clash';
import { getBuildingCategories, HOME_CATEGORIES } from './buildingData';
import { getBuildingCopies, getCountAtTH } from './buildingCopies';
import { getAllItemsAtTH, getPetNames, getMaxLevelAtTH, getSuperTroopNames } from './armyData';
import { computeMaxTime, type MaxTimeInput } from './maxTime';

export interface CategoryReadiness {
  key: string;
  label: string;
  pct: number;
  done: number;
  total: number;
  weight: number;
}

export interface PipelineReadiness {
  key: 'lab' | 'builders' | 'pets';
  pct: number;
  children: CategoryReadiness[];
}

export interface ThReadiness {
  th: number;
  nextTh: number;
  categories: CategoryReadiness[];
  pipelines: PipelineReadiness[];
  score: number;
  verdict: 'ready' | 'almost' | 'not-ready';
  verdictLabel: string;
  note: string;
  weakestLabel: string;
  nextUnlocks: {
    label: string;
    value: string;
    names?: string[];
    details?: { name: string; count: number; levels: number; nextMax: number }[];
  }[];
  criticalPipeline: 'lab' | 'builders' | 'pets';
  criticalPipelinePct: number;
  criticalPipelineTimeSec: number;
}

const BUILDING_WEIGHTS: Record<string, number> = {
  Defenses: 1.0,
  Army: 0.7,
  Storages: 0.6,
  Collectors: 0.3,
  Traps: 0.4,
  Walls: 0.3,
};

const ARMY_WEIGHTS = {
  Heroes: 1.5,
  Laboratory: 1.4,
  Pets: 0.7,
};

const RESOURCE_CATS: { key: string; names: string[] }[] = [
  { key: 'Storages', names: ['Gold Storage', 'Elixir Storage', 'Dark Elixir Storage'] },
  { key: 'Collectors', names: ['Gold Mine', 'Elixir Collector', 'Dark Elixir Drill', 'Helper Hut'] },
];

const PIPELINE_GROUPS: Record<PipelineReadiness['key'], string[]> = {
  lab: ['Troops', 'Spells', 'Sieges'],
  builders: ['Heroes', 'Defenses', 'Army', 'Storages', 'Collectors', 'Traps', 'Walls'],
  pets: ['Pets'],
};

function pctOf(done: number, total: number): number {
  return total > 0 ? (done / total) * 100 : 100;
}

function buildingCategory(
  key: string,
  names: string[],
  th: number,
  player: ClashPlayer,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const name of names) {
    const effectiveMax = getBuildingMaxLevelAtTHLocal(name, th);
    if (effectiveMax <= 0) continue;
    const count = getCountAtTH(name, th);
    const copies = getBuildingCopies(
      name,
      player.buildingLevels,
      player.buildings,
      effectiveMax,
      count,
      player.lastMaxedTH,
      th,
    );
    const actualTotal = count * effectiveMax;
    const doneLevels = copies.levels.reduce((s, l) => s + Math.min(l, effectiveMax), 0);
    done += Math.min(doneLevels, actualTotal);
    total += actualTotal;
  }
  return { done, total };
}

function armyCategory(
  items: { name: string; maxLevel: number }[],
  owned: Record<string, number>,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const it of items) {
    const lvl = Math.max(0, Math.min(owned[it.name] ?? 0, it.maxLevel));
    done += lvl;
    total += it.maxLevel;
  }
  return { done, total };
}

function getBuildingMaxLevelAtTHLocal(name: string, th: number): number {
  // Look up the per-TH cap straight from the category table (cached).
  const entry = getBuildingCategories(th);
  for (const buildings of Object.values(entry)) {
    const max = buildings[name]?.[String(th)]?.level;
    if (max != null && max > 0) return max;
  }
  return 0;
}

export function computeThReadiness(player: ClashPlayer, th: number): ThReadiness {
  const nextTh = th + 1;
  const cats: CategoryReadiness[] = [];

  const categories = getBuildingCategories(th);
  for (const [key, names] of Object.entries(HOME_CATEGORIES)) {
    if (key === 'Resources') {
      for (const rc of RESOURCE_CATS) {
        const namesAtTh = rc.names.filter((n) => categories[key]?.[n]?.[String(th)]?.level != null);
        const { done, total } = buildingCategory(key, namesAtTh, th, player);
        if (total <= 0) continue;
        cats.push({
          key: rc.key,
          label: rc.key,
          pct: pctOf(done, total),
          done,
          total,
          weight: BUILDING_WEIGHTS[rc.key] ?? 1,
        });
      }
      continue;
    }
    const namesAtTh = names.filter((n) => categories[key]?.[n]?.[String(th)]?.level != null);
    const { done, total } = buildingCategory(key, namesAtTh, th, player);
    if (total <= 0) continue;
    cats.push({
      key,
      label: key,
      pct: pctOf(done, total),
      done,
      total,
      weight: BUILDING_WEIGHTS[key] ?? 1,
    });
  }

  const superTroops = new Set(getSuperTroopNames());
  const heroItems = getAllItemsAtTH(th).filter((i) => i.type === 'hero');
  const troopItems = getAllItemsAtTH(th).filter(
    (i) => i.type === 'troop' && !superTroops.has(i.name),
  );
  const spellItems = getAllItemsAtTH(th).filter(
    (i) => i.type === 'spell' && !superTroops.has(i.name),
  );
  const siegeItems = getAllItemsAtTH(th).filter((i) => i.type === 'siege');
  const petItems = getPetNames()
    .map((name) => {
      const maxLevel = getMaxLevelAtTH(name, th) ?? 0;
      return maxLevel > 0 ? { name, maxLevel } : null;
    })
    .filter((x): x is { name: string; maxLevel: number } => x != null);

  const heroOwned: Record<string, number> = {};
  for (const h of player.heroes ?? []) heroOwned[h.name] = h.level;
  const troopOwned: Record<string, number> = {};
  for (const t of player.troops ?? []) troopOwned[t.name] = t.level;
  const spellOwned: Record<string, number> = {};
  for (const s of player.spells ?? []) spellOwned[s.name] = s.level;
  const siegeOwned: Record<string, number> = {};
  for (const t of player.troops ?? []) if (getAllItemsAtTH(th).find((i) => i.name === t.name && i.type === 'siege')) siegeOwned[t.name] = t.level;
  const petOwned: Record<string, number> = {};
  for (const p of player.pets ?? []) petOwned[p.name] = p.level;

  const groups: [string, { done: number; total: number }, number][] = [
    ['Heroes', armyCategory(heroItems, heroOwned), ARMY_WEIGHTS.Heroes],
    ['Troops', armyCategory(troopItems, troopOwned), ARMY_WEIGHTS.Laboratory],
    ['Spells', armyCategory(spellItems, spellOwned), ARMY_WEIGHTS.Laboratory],
    ['Sieges', armyCategory(siegeItems, siegeOwned), ARMY_WEIGHTS.Laboratory],
    ['Pets', armyCategory(petItems, petOwned), ARMY_WEIGHTS.Pets],
  ];
  for (const [key, agg, weight] of groups) {
    if (agg.total <= 0) continue;
    cats.push({ key, label: key, pct: pctOf(agg.done, agg.total), ...agg, weight });
  }

  cats.sort((a, b) => b.weight - a.weight || a.pct - b.pct);

  const pipelines: PipelineReadiness[] = (Object.keys(PIPELINE_GROUPS) as PipelineReadiness['key'][])
    .map((key) => {
      const children = cats.filter((c) => PIPELINE_GROUPS[key].includes(c.key));
      if (children.length === 0) return null;
      const weightSum = children.reduce((s, c) => s + c.weight, 0);
      const pct = weightSum > 0 ? children.reduce((s, c) => s + c.pct * c.weight, 0) / weightSum : 100;
      return { key, pct, children };
    })
    .filter((p): p is PipelineReadiness => p != null);

  // Overall readiness = critical path pipeline's readiness (the bottleneck).
  let criticalReadiness = 100;
  let criticalPipelineKey: 'lab' | 'builders' | 'pets' = 'lab';
  let criticalPipelineTimeSec = 0;
  try {
    // Use max builder count for from-scratch (best case), current builder count for current
    const maxBuilderCount = 5; // max possible
    const currentBuilderCount = Math.min(5, Math.max(2, 2)); // fallback

    // From-scratch: all items at level 0, max builders
    const fromScratchPlayer = {
      ...player,
      troops: getAllItemsAtTH(th).filter(i => i.type === 'troop').map(i => ({ name: i.name, level: 0, village: 'home' })),
      spells: getAllItemsAtTH(th).filter(i => i.type === 'spell').map(i => ({ name: i.name, level: 0, village: 'home' })),
      heroes: getAllItemsAtTH(th).filter(i => i.type === 'hero').map(i => ({ name: i.name, level: 0, village: 'home' })),
      pets: getAllItemsAtTH(th).filter(i => (i as any).type === 'pet').map(i => ({ name: i.name, level: 0, village: 'home' })),
      buildingLevels: [],
      buildings: [],
      lastMaxedTH: 0,
      builderCount: maxBuilderCount,
    } as any;
    const fromScratchInput: MaxTimeInput = {
      player: fromScratchPlayer,
      th,
      builderCount: maxBuilderCount,
      armyDetails: {},
    };
    const fromScratch = computeMaxTime(fromScratchInput);

    // Current: actual levels, actual builders
    const currentInput: MaxTimeInput = {
      player: { ...player, builderCount: currentBuilderCount } as any,
      th,
      builderCount: currentBuilderCount,
      armyDetails: {},
    };
    const current = computeMaxTime(currentInput);

    // Per-pipeline readiness
    const labReady = fromScratch.lab.timeSec > 0 ? Math.max(0, 100 - (current.lab.timeSec / fromScratch.lab.timeSec) * 100) : 100;
    const buildersReady = fromScratch.builders.timeSec > 0 ? Math.max(0, 100 - (current.builders.timeSec / fromScratch.builders.timeSec) * 100) : 100;
    const petsReady = fromScratch.pets.timeSec > 0 ? Math.max(0, 100 - (current.pets.timeSec / fromScratch.pets.timeSec) * 100) : 100;

    // Critical path = longest pipeline (lowest readiness)
    const pipelineReadiness = [
      { key: 'lab' as const, pct: labReady, timeSec: current.lab.timeSec },
      { key: 'builders' as const, pct: buildersReady, timeSec: current.builders.timeSec },
      { key: 'pets' as const, pct: petsReady, timeSec: current.pets.timeSec },
    ].sort((a, b) => a.pct - b.pct);

    criticalPipelineKey = pipelineReadiness[0].key;
    criticalReadiness = pipelineReadiness[0].pct;
    criticalPipelineTimeSec = pipelineReadiness[0].timeSec;
  } catch {
    // Fallback to weighted average if computeMaxTime fails
    let weighted = 0;
    let weightSum = 0;
    for (const c of cats) {
      weighted += c.pct * c.weight;
      weightSum += c.weight;
    }
    criticalReadiness = weightSum > 0 ? weighted / weightSum : 100;
  }

  const score = criticalReadiness;

  const gaps = cats
    .map((c) => ({ label: c.label, pct: c.pct, gap: c.weight * (100 - c.pct) }))
    .sort((a, b) => b.gap - a.gap);
  const weakestLabel =
    gaps.length > 0 ? `${gaps[0].label} (${Math.round(gaps[0].pct)}%)` : 'nothing';

  const verdict: ThReadiness['verdict'] = score >= 85 ? 'ready' : score >= 60 ? 'almost' : 'not-ready';
  const verdictLabel = verdict === 'ready' ? 'Safe to upgrade' : verdict === 'almost' ? 'Nearly there' : 'Not yet';

  // What TH+1 would add on top of the current debt.
  const currentItems = getAllItemsAtTH(th);
  const nextItems = getAllItemsAtTH(nextTh);
  const newItems = nextItems.filter((n) => !currentItems.some((c) => c.name === n.name && c.type === n.type));
  const nextUnlocks: {
    label: string;
    value: string;
    names?: string[];
    details?: { name: string; count: number; levels: number; nextMax: number }[];
  }[] = [];
  const newTroops = newItems.filter((i) => i.type === 'troop');
  const newSpells = newItems.filter((i) => i.type === 'spell');
  const newHeroes = newItems.filter((i) => i.type === 'hero');
  if (newTroops.length + newSpells.length > 0) {
    nextUnlocks.push({
      label: 'lab',
      value: `+${newTroops.length + newSpells.length} troop/spell`,
      names: [...newTroops, ...newSpells].map((i) => i.name),
    });
  }
  if (newHeroes.length > 0) {
    nextUnlocks.push({
      label: 'heroes',
      value: `+${newHeroes.length} hero`,
      names: newHeroes.map((i) => i.name),
    });
  }

  const catsNext = getBuildingCategories(nextTh);
  const catsNow = getBuildingCategories(th);
  let newBuildings = 0;
  let extraLevels = 0;
  const newBuildingNames: string[] = [];
  const extraLevelDetails: { name: string; count: number; levels: number; nextMax: number }[] = [];
  for (const [cat, buildings] of Object.entries(catsNext)) {
    for (const [name, thData] of Object.entries(buildings)) {
      const nextMax = thData[String(nextTh)]?.level ?? 0;
      const curMax = catsNow[cat]?.[name]?.[String(th)]?.level ?? 0;
      const count = getCountAtTH(name, nextTh);
      if (nextMax <= 0) continue;
      if (curMax <= 0) {
        newBuildings += count;
        if (count > 0) newBuildingNames.push(name);
      } else if (nextMax > curMax) {
        const levelDelta = nextMax - curMax;
        extraLevels += count * levelDelta;
        extraLevelDetails.push({ name, count, levels: levelDelta, nextMax });
      }
    }
  }
  if (newBuildings > 0) nextUnlocks.push({ label: 'buildings', value: `+${newBuildings} building`, names: newBuildingNames } as const);
  // Sort extra levels: Army buildings first, then others by category priority
  const ARMY_BUILDINGS = ['Army Camp', 'Barracks', 'Clan Castle', 'Lab', 'Hero Hall', 'Spell Factory', 'Dark Barracks', 'Dark Spell Factory', 'Blacksmith', 'Workshop', 'Pet House'];
  extraLevelDetails.sort((a, b) => {
    const aIsArmy = ARMY_BUILDINGS.includes(a.name);
    const bIsArmy = ARMY_BUILDINGS.includes(b.name);
    if (aIsArmy && !bIsArmy) return -1;
    if (!aIsArmy && bIsArmy) return 1;
    return 0;
  });
  if (extraLevels > 0) nextUnlocks.push({ label: 'levels', value: `+${extraLevels} building level`, details: extraLevelDetails } as const);

  const note =
    verdict === 'ready'
      ? 'Strong progress — remaining debt is light enough to carry into the next TH.'
      : `Biggest gaps: ${gaps
          .slice(0, 2)
          .map((g) => `${g.label} (${Math.round(g.pct)}%)`)
          .join(' · ')}. A few more levels there would pay off most before you move up.`;

  return {
    th,
    nextTh,
    categories: cats,
    pipelines,
    score,
    verdict,
    verdictLabel,
    note,
    weakestLabel,
    nextUnlocks,
    criticalPipeline: criticalPipelineKey,
    criticalPipelinePct: Math.round(criticalReadiness),
    criticalPipelineTimeSec,
  };
}