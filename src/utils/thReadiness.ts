import type { ClashPlayer } from '../types/clash';
import { getBuildingCategories, HOME_CATEGORIES } from './buildingData';
import { getBuildingCopies, getCountAtTH } from './buildingCopies';
import { getAllItemsAtTH, getPetNames, getMaxLevelAtTH, getSuperTroopNames } from './armyData';
import { isArmyExcluded, isBuildingExcluded, isPipelineGated } from './exclusions';

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
  excludedBuildings?: ReadonlySet<string>,
): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const name of names) {
    if (isBuildingExcluded(excludedBuildings, name)) continue;
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

/**
 * TH upgrade readiness: per-category and per-pipeline progress, a weighted
 * score and what TH+1 would add. Excluded buildings, army items and gated
 * pipelines drop out of every category and of the TH+1 preview.
 */
export function computeThReadiness(player: ClashPlayer, th: number, excludedBuildings?: ReadonlySet<string>): ThReadiness {
  const nextTh = th + 1;
  const cats: CategoryReadiness[] = [];

  const categories = getBuildingCategories(th);
  for (const [key, names] of Object.entries(HOME_CATEGORIES)) {
    if (key === 'Resources') {
      for (const rc of RESOURCE_CATS) {
        const namesAtTh = rc.names.filter((n) => categories[key]?.[n]?.[String(th)]?.level != null);
        const { done, total } = buildingCategory(key, namesAtTh, th, player, excludedBuildings);
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
    const { done, total } = buildingCategory(key, namesAtTh, th, player, excludedBuildings);
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

  // A gating building (Laboratory, Hero Hall, Pet House) excludes the whole
  // pipeline that runs inside it, and individual items can be excluded too — the
  // same keys the Time to Max screen writes.
  const superTroops = new Set(getSuperTroopNames());
  const labGated = isPipelineGated(excludedBuildings, 'lab');
  const heroesGated = isPipelineGated(excludedBuildings, 'heroes');
  const petsGated = isPipelineGated(excludedBuildings, 'pets');
  const skipItem = (name: string) => isArmyExcluded(excludedBuildings, name);
  const heroItems = getAllItemsAtTH(th).filter(
    (i) => i.type === 'hero' && !heroesGated && !skipItem(i.name),
  );
  const troopItems = getAllItemsAtTH(th).filter(
    (i) => i.type === 'troop' && !labGated && !superTroops.has(i.name) && !skipItem(i.name),
  );
  const spellItems = getAllItemsAtTH(th).filter(
    (i) => i.type === 'spell' && !labGated && !superTroops.has(i.name) && !skipItem(i.name),
  );
  const siegeItems = getAllItemsAtTH(th).filter(
    (i) => i.type === 'siege' && !labGated && !skipItem(i.name),
  );
  const petItems = petsGated
    ? []
    : getPetNames()
        .filter((name) => !skipItem(name))
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

  // Overall readiness = weighted average across all pipelines (the categories are already weighted).
  let weighted = 0;
  let weightSum = 0;
  for (const c of cats) {
    weighted += c.pct * c.weight;
    weightSum += c.weight;
  }
  const criticalReadiness = weightSum > 0 ? weighted / weightSum : 100;

  // Identify critical pipeline from the precomputed pipeline weighted averages
  let criticalPipelineKey: 'lab' | 'builders' | 'pets' = 'lab';
  let criticalPipelinePct = 100;
  let criticalPipelineTimeSec = 0;
  for (const p of pipelines) {
    if (p.pct < criticalPipelinePct) {
      criticalPipelineKey = p.key;
      criticalPipelinePct = p.pct;
    }
  }
  // Approximate time for critical pipeline using its categories' remaining time
  // (not strictly needed for score, kept for UI compatibility)
  const score = criticalReadiness;

  const gaps = cats
    .map((c) => ({ label: c.label, pct: c.pct, gap: c.weight * (100 - c.pct) }))
    .sort((a, b) => b.gap - a.gap);
  const weakestLabel =
    gaps.length > 0 ? `${gaps[0].label} (${Math.round(gaps[0].pct)}%)` : 'nothing';

  const verdict: ThReadiness['verdict'] = score >= 85 ? 'ready' : score >= 60 ? 'almost' : 'not-ready';
  const verdictLabel = verdict === 'ready' ? 'Safe to upgrade' : verdict === 'almost' ? 'Nearly there' : 'Not yet';

  // What TH+1 would add on top of the current debt. Items behind an exclusion
  // (or a gated pipeline) are not part of the plan, so they are left out too.
  const typeGated = (type: string) =>
    type === 'hero' ? heroesGated : type === 'pet' ? petsGated : labGated;
  const inPlan = (i: { name: string; type: string }) =>
    !typeGated(i.type) && !isArmyExcluded(excludedBuildings, i.name);
  const currentItems = getAllItemsAtTH(th);
  const nextItems = getAllItemsAtTH(nextTh);
  const newItems = nextItems.filter(
    (n) => !currentItems.some((c) => c.name === n.name && c.type === n.type) && inPlan(n),
  );
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

  // Army level increases (existing items that get higher max levels at TH+1)
  const armyLevelDetails: { name: string; count: number; levels: number; nextMax: number }[] = [];
  const armyTypes = ['troop', 'spell', 'siege', 'hero'] as const;
  for (const type of armyTypes) {
    if (typeGated(type)) continue;
    const currentTypeItems = currentItems.filter(i => i.type === type);
    for (const cur of currentTypeItems) {
      if (isArmyExcluded(excludedBuildings, cur.name)) continue;
      const next = nextItems.find(n => n.name === cur.name && n.type === type);
      if (next && next.maxLevel > cur.maxLevel) {
        armyLevelDetails.push({
          name: cur.name,
          count: type === 'hero' ? 1 : 1, // heroes have 1 copy, troops/spells typically 1 research
          levels: next.maxLevel - cur.maxLevel,
          nextMax: next.maxLevel,
        });
      }
    }
  }

  const catsNext = getBuildingCategories(nextTh);
  const catsNow = getBuildingCategories(th);
  let newBuildings = 0;
  let extraLevels = 0;
  const newBuildingDetails: { name: string; count: number; levels: number; nextMax: number }[] = [];
  const extraLevelDetails: { name: string; count: number; levels: number; nextMax: number }[] = [];
  for (const [cat, buildings] of Object.entries(catsNext)) {
    for (const [name, thData] of Object.entries(buildings)) {
      if (isBuildingExcluded(excludedBuildings, name)) continue;
      const nextMax = thData[String(nextTh)]?.level ?? 0;
      const curMax = catsNow[cat]?.[name]?.[String(th)]?.level ?? 0;
      const count = getCountAtTH(name, nextTh);
      if (nextMax <= 0) continue;
      if (curMax <= 0) {
        newBuildings += count;
        if (count > 0) newBuildingDetails.push({ name, count, levels: nextMax - 1, nextMax });
      } else if (nextMax > curMax) {
        const levelDelta = nextMax - curMax;
        extraLevels += count * levelDelta;
        extraLevelDetails.push({ name, count, levels: levelDelta, nextMax });
      }
    }
  }
  if (newBuildings > 0) nextUnlocks.push({ label: 'buildings', value: `+${newBuildings} building`, details: newBuildingDetails } as const);
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
  if (armyLevelDetails.length > 0) {
    const totalArmyLevels = armyLevelDetails.reduce((s, d) => s + d.levels * d.count, 0);
    nextUnlocks.push({ label: 'levels', value: `+${totalArmyLevels} army level`, details: armyLevelDetails } as const);
  }

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