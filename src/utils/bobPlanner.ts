import { home, builder } from 'clash-of-clans-data';
import type { PlayerBuilding } from '../types/clash';
import { getBuildingCopies, getCountAtBH } from './buildingCopies';
import { getBuildingMaxLevelAtBH, BB_CATEGORIES, isBuilderName } from './buildingData';
import {
  buildingUpgradeCosts,
  buildingUpgradeChainTimes,
  scheduleChainsDetailed,
  formatCost,
} from './upgradeCosts';
import { getAllBuilderItemsAtBH } from './armyData';

export type BobMachine = 'bb-builder' | 'star-lab';

const MACHINE_LABEL: Record<BobMachine, string> = {
  'bb-builder': 'Builder',
  'star-lab': 'Star Lab',
};

export interface BobStep {
  key: string;
  label: string;
  machine: BobMachine;
  timeSec: number;
  cost: number;
  byResource: Record<string, number>;
}

export interface BobRequirement {
  id: string;
  label: string;
  sub: string;
  icon: string;
  done: boolean;
  manual?: boolean;
  current: number;
  target: number;
  steps: BobStep[];
  etaSec: number;
  cost: number;
  callouts: string[];
}

export interface BobChain {
  label: string;
  timeSec: number;
  cost: number;
  byResource: Record<string, number>;
  startSec?: number;
  worker?: number;
}

export interface BobMachinePlan {
  id: BobMachine;
  label: string;
  timeSec: number;
  chains: BobChain[];
}

export interface BobPlan {
  ok: boolean;
  bh: number;
  bbBuilders: number;
  requirements: BobRequirement[];
  machines: BobMachinePlan[];
  bbScheduleSec: number;
  starLabSec: number;
  totalEtaSec: number;
  resources: Record<string, number>;
  clockTower: { level: number; maxLevel: number; saveSec: number } | null;
  blocking: string[];
  notes: string[];
}

export interface BobInput {
  bh: number;
  bbBuilders: number;
  buildingLevels?: Record<string, number>;
  buildings?: PlayerBuilding[];
  heroLevels: Record<string, number>;
  troopLevels: Record<string, number>;
  gearUpsDone: Record<string, boolean>;
  homeLevels: Record<string, number>;
  clockTowerLevel: number;
}

const DEFENCE_TARGET = 9;
const TROOP_TARGET = 18;
const HERO_COMBINED_TARGET = 45;
const HERO_IDEAL_BM = 23;
const HERO_IDEAL_COP = 22;
const BOB_CONTROL_TARGET = 5;
const OPTIMAL_CLOCK_TOWER = 6;
const CLOCK_CYCLE_MINUTES = 24 * 60;
const MAX_BH = 10;

interface GearUpSpec {
  key: string;
  homeName: string;
  requiresHomeLevel: number;
  bbBuilding: string;
  requiresBBLevel: number;
  cost: number;
  timeSec: number;
}

interface RawLevel {
  level: number;
  cost: number;
  resource: string;
  timeSec: number;
}

function buildTimeToSec(t?: { days?: number; hours?: number; minutes?: number; seconds?: number }): number {
  if (!t) return 0;
  return (t.days ?? 0) * 86400 + (t.hours ?? 0) * 3600 + (t.minutes ?? 0) * 60 + (t.seconds ?? 0);
}

function loadGearUpSpecs(): GearUpSpec[] {
  try {
    const list = (home().defenses().get() ?? []) as {
      name: string;
      gearUp?: {
        cost: number;
        time?: { days?: number; hours?: number; minutes?: number; seconds?: number };
        requiresLevel: number;
        requiresBuilderBuilding?: string;
        requiresBuilderBuildingLevel?: number;
      };
    }[];
    const specs: GearUpSpec[] = [];
    for (const d of list) {
      if (!d.gearUp || !d.gearUp.requiresBuilderBuilding) continue;
      const bb = d.gearUp.requiresBuilderBuilding;
      const bbStore = isBuilderName(bb) ? bb : `BB ${bb}`;
      specs.push({
        key: d.name.toLowerCase().replace(/\s+/g, '-'),
        homeName: d.name,
        requiresHomeLevel: d.gearUp.requiresLevel,
        bbBuilding: bbStore,
        requiresBBLevel: d.gearUp.requiresBuilderBuildingLevel ?? 1,
        cost: d.gearUp.cost,
        timeSec: buildTimeToSec(d.gearUp.time),
      });
    }
    return specs;
  } catch {
    return [];
  }
}

function builderItemLevels(
  kind: 'troops' | 'heroes',
  name: string,
): RawLevel[] {
  try {
    const items = (builder()[kind]().get() ?? []) as {
      name: string;
      levels: {
        level: number;
        researchCost?: number;
        upgradeCost?: number;
        researchCostResource?: string;
        upgradeCostResource?: string;
        researchTime?: { days?: number; hours?: number; minutes?: number; seconds?: number };
        upgradeTime?: { days?: number; hours?: number; minutes?: number; seconds?: number };
        builderHallLevelRequired?: number;
        starLabRequired?: number;
      }[];
    }[];
    const item = items.find((i) => i.name === name);
    if (!item) return [];
    return item.levels.map((l) => ({
      level: l.level,
      cost: l.researchCost ?? l.upgradeCost ?? 0,
      resource: l.researchCostResource ?? l.upgradeCostResource ?? 'Builder Elixir',
      timeSec: buildTimeToSec(l.researchTime ?? l.upgradeTime),
      builderHallLevelRequired: l.builderHallLevelRequired,
      starLabRequired: l.starLabRequired,
    })) as RawLevel[];
  } catch {
    return [];
  }
}

function builderHeroLevels(name: string): RawLevel[] {
  return builderItemLevels('heroes', name);
}

function builderTroopLevels(name: string): RawLevel[] {
  return builderItemLevels('troops', name);
}

interface RawLevelWith extends RawLevel {
  builderHallLevelRequired?: number;
  starLabRequired?: number;
}

function heroMaxAt(name: string, bh: number): number {
  let max = 0;
  for (const l of builderHeroLevels(name) as RawLevelWith[]) {
    if ((l.builderHallLevelRequired ?? 0) <= bh && l.level > max) max = l.level;
  }
  return max;
}

function minBHallFor(name: string, targetLevel: number): number {
  for (let bh = 1; bh <= MAX_BH; bh++) {
    const max = getBuildingMaxLevelAtBH(name, bh);
    if (max != null && max >= targetLevel) return bh;
  }
  return MAX_BH + 1;
}

function residentLevel(name: string, input: BobInput, minLevel: number, atBh?: number): { from: number; reachable: number; neededBh: number } {
  const bh = atBh ?? input.bh;
  const maxAtBh = getBuildingMaxLevelAtBH(name, bh) ?? 0;
  const count = getCountAtBH(name, bh);
  const sources = getBuildingCopies(name, input.buildingLevels, input.buildings, Math.max(maxAtBh, minLevel), count, undefined);
  const from = Math.max(0, ...sources.levels);
  const neededBh = from >= minLevel ? 0 : minBHallFor(name, minLevel);
  return { from, reachable: maxAtBh, neededBh };
}

function buildingStep(name: string, from: number, to: number, machine: BobMachine): BobStep {
  const timeSec = buildingUpgradeChainTimes(name, [Math.max(1, from)], to)[0] ?? 0;
  const ct = buildingUpgradeCosts(name, [Math.max(1, from)], to);
  const byResource: Record<string, number> = {};
  const cost = ct.cost;
  for (const [res, v] of Object.entries(ct.byResource ?? {})) {
    if (res !== 'Unknown') byResource[res] = (byResource[res] ?? 0) + v;
  }
  if (cost > 0 && Object.keys(byResource).length === 0) byResource['Builder Gold'] = cost;
  return {
    key: `${machine}|${name}|${from}|${to}`,
    label: `${name} Lv ${from} → ${to}`,
    machine,
    timeSec,
    cost,
    byResource,
  };
}

function clockTowerLevels(): { level: number; timeGainedMinutes: number }[] {
  try {
    const items = (builder().otherBuildings().get() ?? []) as {
      id: string;
      levels: { level: number; timeGainedMinutes: number }[];
    }[];
    const ct = items.find((i) => i.id === 'clock-tower');
    if (!ct) return [];
    return ct.levels.filter((l) => l.timeGainedMinutes > 0);
  } catch {
    return [];
  }
}

function bbCapacityTable(kind: 'gold-storage' | 'elixir-storage'): { level: number; capacity: number }[] {
  try {
    const items = (builder().resourceBuildings().get() ?? []) as {
      id: string;
      levels: { level: number; capacity: number }[];
    }[];
    const store = items.find((i) => i.id === kind);
    if (!store) return [];
    return store.levels
      .filter((l) => l.capacity > 0)
      .map((l) => ({ level: l.level, capacity: l.capacity }));
  } catch {
    return [];
  }
}

function storageCapacityAt(table: { level: number; capacity: number }[], level: number): number {
  let best = 0;
  for (const row of table) {
    if (row.level <= level && row.capacity > best) best = row.capacity;
  }
  return best;
}

function heroSteps(name: string, fromLevel: number, toLevel: number): BobStep[] {
  const steps: BobStep[] = [];
  for (const l of builderHeroLevels(name) as RawLevelWith[]) {
    if (l.level <= fromLevel || l.level > toLevel) continue;
    steps.push({
      key: `bb-builder|${name}|${l.level - 1}|${l.level}`,
      label: `${name} Lv ${l.level - 1} → ${l.level}`,
      machine: 'bb-builder',
      timeSec: l.timeSec,
      cost: l.cost,
      byResource: l.cost > 0 ? { [l.resource]: l.cost } : { 'Builder Elixir': 0 },
    });
  }
  return steps;
}

function allocateCombinedLevels(
  bm: number,
  cop: number,
  bmMax: number,
  copMax: number,
  target: number,
): { bmTo: number; copTo: number } {
  const bmIdeal = Math.min(HERO_IDEAL_BM, bmMax);
  const copIdeal = Math.min(HERO_IDEAL_COP, copMax);
  let bmTo = Math.max(bm, bmIdeal);
  let copTo = Math.max(cop, copIdeal);
  let sum = bmTo + copTo;
  if (sum > target) {
    while (sum > target) {
      const bmAbove = bmTo - bmIdeal;
      const copAbove = copTo - copIdeal;
      if (copAbove > 0 && copTo - 1 >= cop && (copAbove >= bmAbove || bmTo - 1 < bm)) {
        copTo--;
      } else if (bmAbove > 0 && bmTo - 1 >= bm) {
        bmTo--;
      } else {
        break;
      }
      sum = bmTo + copTo;
    }
    return { bmTo, copTo };
  }
  const bmLevels = (builderHeroLevels('Battle Machine') as RawLevelWith[])
    .filter((l) => l.level > bmTo && l.level <= bmMax);
  const copLevels = (builderHeroLevels('Battle Copter') as RawLevelWith[])
    .filter((l) => l.level > copTo && l.level <= copMax);
  let bi = 0;
  let ci = 0;
  let guard = 0;
  while (sum < target && guard < 200) {
    guard++;
    const bn = bmLevels[bi];
    const cn = copLevels[ci];
    if (bn && cn) {
      if (cn.timeSec < bn.timeSec) {
        copTo = cn.level;
        ci++;
      } else {
        bmTo = bn.level;
        bi++;
      }
    } else if (bn) {
      bmTo = bn.level;
      bi++;
    } else if (cn) {
      copTo = cn.level;
      ci++;
    } else {
      break;
    }
    sum = bmTo + copTo;
  }
  return { bmTo, copTo };
}

function homeDefenceMaxLevel(name: string, input: BobInput): number {
  const lower = name.toLowerCase();
  let max = 0;
  for (const b of input.buildings ?? []) {
    if (b.name.toLowerCase() === lower && b.level > max) max = b.level;
  }
  if (max > 0) return max;
  return input.homeLevels[name] ?? 0;
}

export function computeBobPlan(input: BobInput): BobPlan {
  const bh = Math.max(1, input.bh);
  const notes: string[] = [];
  const blocking: string[] = [];
  const requirements: BobRequirement[] = [];

  const gearSpecs = loadGearUpSpecs();
  for (const spec of gearSpecs) {
    const done = !!input.gearUpsDone[spec.key];
    const homeLvl = homeDefenceMaxLevel(spec.homeName, input);
    const callouts: string[] = [];
    const steps: BobStep[] = [];
    if (!done) {
      if (homeLvl < spec.requiresHomeLevel) {
        callouts.push(`${spec.homeName} needs Lv ${spec.requiresHomeLevel} in the Home Village to gear up (highest copy is Lv ${homeLvl})`);
      }
      const bb = residentLevel(spec.bbBuilding, input, spec.requiresBBLevel);
      if (bb.from < spec.requiresBBLevel) {
        const pre = buildingStep(spec.bbBuilding, bb.from, spec.requiresBBLevel, 'bb-builder');
        steps.push(pre);
      }
      if (spec.timeSec > 0) {
        steps.push({
          key: `gearup|${spec.key}`,
          label: `Gear up ${spec.homeName} (Lv ${spec.requiresHomeLevel})`,
          machine: 'bb-builder',
          timeSec: spec.timeSec,
          cost: spec.cost,
          byResource: spec.cost > 0 ? { Gold: spec.cost } : {},
        });
      }
    }
    requirements.push({
      id: spec.key,
      label: `Gear up ${spec.homeName}`,
      sub: done
        ? 'Done'
        : `${spec.homeName} Lv ${homeLvl} → gear-up · ${formatCost(spec.cost)} Gold`,
      icon: 'hammer-outline',
      done,
      manual: true,
      current: done ? 1 : 0,
      target: 1,
      steps,
      etaSec: steps.reduce((s, x) => s + x.timeSec, 0),
      cost: steps.reduce((s, x) => s + x.cost, 0),
      callouts,
    });
  }

  const defenseCandidates = BB_CATEGORIES.Defenses.filter((n) => n !== 'Builder Hall');
  const pendingGearLift = (name: string): number =>
    Math.max(0, ...gearSpecs.filter((s) => !input.gearUpsDone[s.key] && s.bbBuilding === name).map((s) => s.requiresBBLevel));
  const projectedBh = Math.max(bh, ...defenseCandidates.map((name) => minBHallFor(name, DEFENCE_TARGET)));
  let anyDefence9 = false;
  let defence: BobRequirement | null = null;
  {
    let chosen: { name: string; from: number; timeSec: number; cost: number; neededBh: number; remaining: number } | null = null;
    for (const name of defenseCandidates) {
      if (!getCountAtBH(name, projectedBh)) continue;
      const r = residentLevel(name, input, DEFENCE_TARGET, projectedBh);
      if (r.from >= DEFENCE_TARGET) {
        anyDefence9 = true;
        break;
      }
      const lift = Math.max(1, r.from, pendingGearLift(name));
      const timeSec = r.reachable >= DEFENCE_TARGET
        ? (buildingUpgradeChainTimes(name, [Math.max(1, lift)], DEFENCE_TARGET)[0] ?? 0)
        : Infinity;
      const cost = r.reachable >= DEFENCE_TARGET
        ? buildingUpgradeCosts(name, [Math.max(1, lift)], DEFENCE_TARGET).cost
        : 0;
      const remaining = DEFENCE_TARGET - lift;
      // Prefer the defence a pending gear-up already lifts closest to Lv 9
      // (e.g. Multi Mortar → 8 feeds the Mortar gear-up), so only the tail of
      // the climb stays in the builders list.
      if (!chosen || remaining < chosen.remaining || (remaining === chosen.remaining && timeSec < chosen.timeSec)) {
        chosen = { name, from: lift, timeSec, cost, neededBh: minBHallFor(name, DEFENCE_TARGET), remaining };
      }
    }
    if (anyDefence9) {
      defence = {
        id: 'defence-9',
        label: 'Defence to level 9',
        sub: 'Done',
        icon: 'shield-outline',
        done: true,
        current: 1,
        target: 1,
        steps: [],
        etaSec: 0,
        cost: 0,
        callouts: [],
      };
    } else if (chosen && isFinite(chosen.timeSec)) {
      const step = buildingStep(chosen.name, chosen.from, DEFENCE_TARGET, 'bb-builder');
      defence = {
        id: 'defence-9',
        label: 'Defence to level 9',
        sub: `${chosen.name} Lv ${chosen.from} → 9`,
        icon: 'shield-outline',
        done: false,
        current: 0,
        target: 1,
        steps: [step],
        etaSec: step.timeSec,
        cost: step.cost,
        callouts: [],
      };
    } else {
      defence = {
        id: 'defence-9',
        label: 'Defence to level 9',
        sub: 'No defence can reach Lv 9 yet',
        icon: 'shield-outline',
        done: false,
        current: 0,
        target: 1,
        steps: [],
        etaSec: 0,
        cost: 0,
        callouts: [],
      };
      if (chosen && chosen.neededBh > bh) {
        blocking.push(`A defence to Lv 9 wants Builder Hall ${Math.max(chosen.neededBh, 9)}`);
      }
    }
    if (defence) requirements.push(defence);
  }

  const starLab = residentLevel('Star Laboratory', input, 1);
  const bhItems = getAllBuilderItemsAtBH(Math.max(bh, 10));
  let troop18 = false;
  let troopDoneName = '';
  let chosenTroop: { name: string; from: number; timeSec: number; cost: number; resource: string; neededStarLab: number } | null = null;
  for (const candidate of bhItems) {
    if (candidate.type !== 'troop' || candidate.maxLevel < TROOP_TARGET) continue;
    const from = input.troopLevels[candidate.name] ?? 0;
    let timeSec = 0;
    let cost = 0;
    let neededStarLab = 0;
    let resource = 'Builder Elixir';
    for (const l of builderTroopLevels(candidate.name) as RawLevelWith[]) {
      if (l.level <= from || l.level > TROOP_TARGET) continue;
      timeSec += l.timeSec;
      cost += l.cost;
      resource = l.resource || resource;
      neededStarLab = Math.max(neededStarLab, l.starLabRequired ?? 0);
    }
    if (from >= TROOP_TARGET) {
      troop18 = true;
      troopDoneName = candidate.name;
      continue;
    }
    if (timeSec <= 0) continue;
    if (
      !chosenTroop ||
      from > chosenTroop.from ||
      (from === chosenTroop.from && timeSec < chosenTroop.timeSec)
    ) {
      chosenTroop = { name: candidate.name, from, timeSec, cost, resource, neededStarLab };
    }
  }
  const troopSteps: BobStep[] = [];
  if (!troop18 && chosenTroop) {
    troopSteps.push({
      key: `research|${chosenTroop.name}|${TROOP_TARGET}`,
      label: `${chosenTroop.name} Lv ${chosenTroop.from} → ${TROOP_TARGET}`,
      machine: 'star-lab',
      timeSec: chosenTroop.timeSec,
      cost: chosenTroop.cost,
      byResource: chosenTroop.cost > 0 ? { [chosenTroop.resource]: chosenTroop.cost } : {},
    });
    if (chosenTroop.neededStarLab > starLab.from) {
      troopSteps.push(buildingStep('Star Laboratory', starLab.from, chosenTroop.neededStarLab, 'bb-builder'));
    }
  }
  requirements.push({
    id: 'troop-18',
    label: 'Any troop to level 18',
    sub: troop18
      ? `Done (${troopDoneName || 'a troop'} at Lv 18+)`
      : chosenTroop
        ? `${chosenTroop.name} Lv ${chosenTroop.from} → ${TROOP_TARGET}`
        : 'No troop can reach Lv 18 yet',
    icon: 'flame-outline',
    done: troop18,
    current: troop18 ? 1 : 0,
    target: 1,
    steps: troopSteps,
    etaSec: troopSteps.reduce((s, x) => s + x.timeSec, 0),
    cost: troopSteps.reduce((s, x) => s + x.cost, 0),
    callouts: [],
  });

  const bmLevel = input.heroLevels['Battle Machine'] ?? 0;
  const copterLevel = input.heroLevels['Battle Copter'] ?? 0;
  const heroSum = bmLevel + copterLevel;
  const heroDone = heroSum >= HERO_COMBINED_TARGET;
  if (heroDone) {
    requirements.push({
      id: 'heroes-45',
      label: 'Battle Machine + Battle Copter = 45',
      sub: `BM ${bmLevel} + Copter ${copterLevel} = ${heroSum}`,
      icon: 'flash-outline',
      done: true,
      current: HERO_COMBINED_TARGET,
      target: HERO_COMBINED_TARGET,
      steps: [],
      etaSec: 0,
      cost: 0,
      callouts: [],
    });
  } else {
    const alloc = allocateCombinedLevels(bmLevel, copterLevel, heroMaxAt('Battle Machine', bh), heroMaxAt('Battle Copter', bh), HERO_COMBINED_TARGET);
    const steps = [...heroSteps('Battle Machine', bmLevel, alloc.bmTo), ...heroSteps('Battle Copter', copterLevel, alloc.copTo)];
    const canReach = alloc.bmTo + alloc.copTo >= HERO_COMBINED_TARGET;
    if (!canReach) {
      blocking.push(`Battle Machine + Battle Copter max out at ${alloc.bmTo + alloc.copTo} combined Lv — Builder Hall ${bh} caps them short of 45`);
    }
    requirements.push({
      id: 'heroes-45',
      label: 'Battle Machine + Battle Copter = 45',
      sub: canReach
        ? `BM ${bmLevel}→${alloc.bmTo} · Copter ${copterLevel}→${alloc.copTo}`
        : `BM ${bmLevel} + Copter ${copterLevel} = ${heroSum} — maxes out short of 45 at Builder Hall ${bh}`,
      icon: 'flash-outline',
      done: false,
      current: heroSum,
      target: HERO_COMBINED_TARGET,
      steps,
      etaSec: steps.reduce((s, x) => s + x.timeSec, 0),
      cost: steps.reduce((s, x) => s + x.cost, 0),
      callouts: [],
    });
    }

  const bobControl = residentLevel('B.O.B Control', input, BOB_CONTROL_TARGET);
  const bobDone = bobControl.from >= BOB_CONTROL_TARGET;
  const bobSteps: BobStep[] = [];
  if (!bobDone) {
    if (bobControl.reachable >= BOB_CONTROL_TARGET) {
      bobSteps.push(buildingStep('B.O.B Control', bobControl.from, BOB_CONTROL_TARGET, 'bb-builder'));
    } else {
      blocking.push('B.O.B Control needs Builder Hall 9 before it can reach Lv 5');
    }
  }
  requirements.push({
    id: 'bob-control-5',
    label: 'B.O.B Control to level 5',
    sub: bobDone ? `Lv ${bobControl.from}` : `Lv ${bobControl.from} → 5`,
    icon: 'construct-outline',
    done: bobDone,
    current: bobControl.from,
    target: BOB_CONTROL_TARGET,
    steps: bobSteps,
    etaSec: bobSteps.reduce((s, x) => s + x.timeSec, 0),
    cost: bobSteps.reduce((s, x) => s + x.cost, 0),
    callouts: [],
  });

  const bbChains: BobChain[] = [];
  const starLabChains: BobChain[] = [];
  const resources: Record<string, number> = {};
  const seenSteps = new Set<string>();

  const addChain = (chain: BobChain, isResearch: boolean) => {
    if (chain.timeSec <= 0) return;
    if (isResearch) starLabChains.push(chain);
    else bbChains.push(chain);
    for (const [res, v] of Object.entries(chain.byResource)) resources[res] = (resources[res] ?? 0) + v;
  };

  for (const req of requirements) {
    for (const step of req.steps) {
      const isResearch = step.key.startsWith('research|');
      const match = /(.+?) Lv (\d+) → (\d+)(?: ×(\d+))?$/.exec(step.label);
      if (!match || step.key.startsWith('gearup|')) {
        addChain({ label: step.label, timeSec: step.timeSec, cost: step.cost, byResource: step.byResource }, isResearch);
        continue;
      }
      const name = match[1];
      const from = Number(match[2]);
      const to = Number(match[3]);
      const mult = Number(match[4] ?? 1);
      if (to - from <= 1) {
        addChain({ label: step.label, timeSec: step.timeSec, cost: step.cost, byResource: step.byResource }, isResearch);
        continue;
      }
      for (let lv = from + 1; lv <= to; lv++) {
        let timeSec = 0;
        let cost = 0;
        let byResource: Record<string, number> = {};
        if (isResearch) {
          const row = builderItemLevels('troops', name).find((r) => r.level === lv);
          timeSec = row?.timeSec ?? 0;
          cost = row?.cost ?? 0;
          if (cost > 0) byResource = { [row?.resource ?? 'Builder Elixir']: cost };
        } else {
          const stepKey = `${name}|${lv - 1}|${lv}`;
          if (seenSteps.has(stepKey)) continue;
          seenSteps.add(stepKey);
          timeSec = buildingUpgradeChainTimes(name, [Math.max(1, lv - 1)], lv)[0] ?? 0;
          const ct = buildingUpgradeCosts(name, [Math.max(1, lv - 1)], lv);
          cost = ct.cost;
          for (const [res, v] of Object.entries(ct.byResource ?? {})) {
            if (res !== 'Unknown' && v > 0) byResource[res] = (byResource[res] ?? 0) + v;
          }
          if (cost > 0 && Object.keys(byResource).length === 0) byResource['Builder Gold'] = cost;
        }
        const scaledByResource: Record<string, number> = {};
        for (const [res, v] of Object.entries(byResource)) scaledByResource[res] = v * mult;
        addChain(
          {
            label: `${lv - 1 <= 0 ? 'Build' : 'Upgrade'} ${name} Lv ${lv - 1} → ${lv}${mult > 1 ? ` ×${mult}` : ''}`,
            timeSec: timeSec * mult,
            cost: cost * mult,
            byResource: scaledByResource,
          },
          isResearch,
        );
      }
    }
  }

  // --- Resource-feasibility: storage upgrades (BB gold/elixir) ---
  // Every currency's total cost must fit inside its storages. Upgrading a
  // storage costs the OTHER currency, so storages are raised iteratively until
  // the whole plan is affordable; a raised BH demand feeds back into the same
  // fixpoint (storage caps grow with the Builder Hall).
  const BB_GOLD_STORAGE = 'BB Gold Storage';
  const BB_ELIXIR_STORAGE = 'BB Elixir Storage';
  const capacityTables: Record<string, { level: number; capacity: number }[]> = {
    'Builder Gold': bbCapacityTable('gold-storage'),
    'Builder Elixir': bbCapacityTable('elixir-storage'),
  };

  let effectiveBh = bh;
  interface StoragePass { res: string; storage: string; payRes: string; rep: number; count: number; maxAtBh: number; }

  const makePasses = (): StoragePass[] =>
    (['Builder Gold', 'Builder Elixir'] as const).map((res) => {
      const isGold = res === 'Builder Gold';
      const storage = isGold ? BB_GOLD_STORAGE : BB_ELIXIR_STORAGE;
      const maxAtBh = getBuildingMaxLevelAtBH(storage, effectiveBh) ?? 0;
      const count = getCountAtBH(storage, effectiveBh);
      const sources = getBuildingCopies(storage, input.buildingLevels, input.buildings, maxAtBh, count, undefined);
      return {
        res,
        storage,
        payRes: isGold ? 'Builder Elixir' : 'Builder Gold',
        rep: Math.max(1, ...sources.levels),
        count,
        maxAtBh,
      };
    });

  let passes = makePasses();
  const capForLevel = (p: StoragePass, level: number) => storageCapacityAt(capacityTables[p.res], level) * p.count;
  const passTotalCap = (p: StoragePass) => capForLevel(p, p.rep);
  const passGap = (p: StoragePass) => Math.max(0, (resources[p.res] ?? 0) - passTotalCap(p));

  const baseDemand = Math.max(
    0,
    ...requirements
      .flatMap((r) => r.steps)
      .filter((s) => !s.key.startsWith('gearup|') && !s.key.startsWith('research|'))
      .map((s) => {
        const m = /Lv (\d+) → (\d+)/.exec(s.label);
        if (!m) return 0;
        const name = s.label.slice(0, s.label.lastIndexOf(' Lv '));
        if (getBuildingMaxLevelAtBH(name, 1) == null) return 0;
        return minBHallFor(name, Number(m[2]));
      }),
  );

  const storageBhDemand = (): number => {
    let demand = 0;
    for (const p of passes) {
      if (p.count <= 0 || capacityTables[p.res].length === 0) continue;
      const need = resources[p.res] ?? 0;
      let needBh = 0;
      for (const row of capacityTables[p.res]) {
        if (capForLevel(p, row.level) >= need) {
          needBh = minBHallFor(p.storage, row.level);
          break;
        }
      }
      demand = Math.max(demand, needBh);
    }
    return demand;
  };

  const storageNotes = new Map<string, { to: number; count: number; payRes: string }>();
  for (let round = 0; round < 12; round++) {
    let demand = Math.max(baseDemand, storageBhDemand());
    let advanced = false;
    while (demand > effectiveBh && effectiveBh < MAX_BH) {
      const step = buildingStep('Builder Hall', effectiveBh, effectiveBh + 1, 'bb-builder');
      if (step.timeSec <= 0) break;
      bbChains.push({
        label: `Builder Hall Lv ${effectiveBh} → ${effectiveBh + 1}`,
        timeSec: step.timeSec,
        cost: step.cost,
        byResource: step.byResource,
      });
      for (const [res, v] of Object.entries(step.byResource)) resources[res] = (resources[res] ?? 0) + v;
      notes.push(`Builder Hall Lv ${effectiveBh} → ${effectiveBh + 1} added (gates the next tier)`);
      effectiveBh += 1;
      passes = makePasses();
      demand = Math.max(baseDemand, storageBhDemand());
      advanced = true;
    }

    for (const p of passes) {
      if (p.rep < p.maxAtBh && passGap(p) > 0) {
        const step = buildingStep(p.storage, p.rep, p.rep + 1, 'bb-builder');
        if (step.timeSec <= 0) continue;
        for (let i = 1; i <= p.count; i++) {
          bbChains.push({
            label: `${p.storage} Lv ${p.rep} → ${p.rep + 1} (copy ${i})`,
            timeSec: step.timeSec,
            cost: step.cost,
            byResource: { [p.payRes]: step.cost },
          });
        }
        resources[p.payRes] = (resources[p.payRes] ?? 0) + step.cost * p.count;
        p.rep += 1;
        storageNotes.set(p.storage, { to: p.rep, count: p.count, payRes: p.payRes });
        advanced = true;
      }
    }
    if (!advanced) break;
  }
  for (const [storage, s] of storageNotes) {
    notes.push(`${storage} raised to Lv ${s.to} ×${s.count} for capacity (costs ${s.payRes})`);
  }

  for (const p of passes) {
    const gap = passGap(p);
    if (gap <= 0) continue;
    if (p.maxAtBh <= 0) {
      blocking.push(`Builder Base ${p.res} storages aren't unlocked yet at Builder Hall ${effectiveBh}`);
    } else if (p.rep >= p.maxAtBh) {
      blocking.push(
        `${p.res} total (${formatCost(resources[p.res] ?? 0)}) exceeds the ${formatCost(passTotalCap(p))} capacity your storages can hold at Builder Hall ${effectiveBh}`,
      );
    }
  }
  if (capacityTables['Builder Gold'].length === 0 || capacityTables['Builder Elixir'].length === 0) {
    notes.push('Builder Base storage caps unavailable from the data package — resource callouts may be incomplete');
  }
  if ((resources['Gold'] ?? 0) > 0) {
    notes.push(`Gear-ups consume ${formatCost(resources['Gold'])} Home Village Gold — make sure your Gold storages hold the peak`);
  }

  const chainNameOf = (label: string): string =>
    label
      .replace(/^(Upgrade|Build) /, '')
      .replace(/ Lv \d+ → \d+(?: ×\d+)?(?: \(copy \d+\))?$/, '');
  const chainFromOf = (label: string): number => {
    const m = /Lv (\d+) →/.exec(label);
    return m ? Number(m[1]) : 0;
  };
  const copyNumOf = (label: string): number => {
    const m = / \(copy (\d+)\)$/.exec(label);
    return m ? Number(m[1]) : 0;
  };

  const aggregateDuplicateJumps = (chains: BobChain[]): BobChain[] => {
    const byKey = new Map<string, BobChain>();
    for (const c of chains) {
      const key = `${chainNameOf(c.label)}|${chainFromOf(c.label)}|${copyNumOf(c.label)}`;
      const prev = byKey.get(key);
      if (prev) {
        prev.timeSec += c.timeSec;
        prev.cost += c.cost;
        const byR: Record<string, number> = {};
        for (const r of new Set([...Object.keys(prev.byResource), ...Object.keys(c.byResource)])) {
          byR[r] = (prev.byResource[r] ?? 0) + (c.byResource[r] ?? 0);
        }
        prev.byResource = byR;
      } else {
        byKey.set(key, { ...c, byResource: { ...c.byResource } });
      }
    }
    return [...byKey.values()];
  };

  const scheduleByPath = (chains: BobChain[], workers: number): { chains: BobChain[]; makespan: number } => {
    if (chains.length === 0) return { chains, makespan: 0 };
    const groups = new Map<string, BobChain[]>();
    for (const c of chains) {
      const name = `${chainNameOf(c.label)}|${copyNumOf(c.label)}`;
      const list = groups.get(name);
      if (list) list.push(c);
      else groups.set(name, [c]);
    }
    const paths: { name: string; chains: BobChain[]; total: number }[] = [];
    for (const [name, list] of groups) {
      list.sort((a, b) => chainFromOf(a.label) - chainFromOf(b.label));
      paths.push({ name, chains: list, total: list.reduce((s, c) => s + c.timeSec, 0) });
    }
    const pack = scheduleChainsDetailed(paths.map((p) => p.total), workers);
    for (const item of pack.items) {
      const path = paths[item.index];
      let cur = item.start;
      for (const c of path.chains) {
        c.worker = item.worker;
        c.startSec = cur;
        cur += c.timeSec;
      }
    }
    const ordered = chains.slice().sort((a, b) => (a.startSec ?? 0) - (b.startSec ?? 0) || (a.worker ?? 0) - (b.worker ?? 0));
    return { chains: ordered, makespan: pack.makespan };
  };

  // Capacity-aware ordering: an upgrade that costs more than the current
  // storage can hold must wait for the storage raise that unlocks that
  // capacity, so expensive chains never run before the raises that fund them.
  // Work is also staged by Builder Hall tier: every upgrade reachable at the
  // current BH runs before the BH is raised, then the next tier, etc.
  const scheduleBuilderChains = (chains: BobChain[], workers: number): { chains: BobChain[]; makespan: number } => {
    if (chains.length === 0 || workers <= 0) return { chains, makespan: 0 };
    interface Job {
      label: string;
      name: string;
      from: number;
      to: number;
      mult: number;
      timeSec: number;
      pay: Record<string, number>;
      deps: Job[];
      depMaxEnd: number;
      worker: number;
      startSec: number;
      priority: number;
    }
    const jobs: Job[] = [];
    const storageRaiseTo = new Map<string, Map<number, Job[]>>();
    const bhStage = (name: string, to: number): number => {
      const bh = minBHallFor(name, to);
      if (bh <= MAX_BH) return bh;
      const hero = (builderHeroLevels(name) as RawLevelWith[]).find((l) => l.level === to);
      if (hero?.builderHallLevelRequired) return hero.builderHallLevelRequired;
      return Math.max(1, input.bh);
    };
    for (const c of chains) {
      const name = chainNameOf(c.label);
      const from = chainFromOf(c.label);
      const toM = /Lv \d+ → (\d+)/.exec(c.label);
      const to = toM ? Number(toM[1]) : from + 1;
      const multM = /×(\d+)/.exec(c.label);
      const mult = multM ? Number(multM[1]) : 1;
      const isGear = name.startsWith('Gear up ');
      const priority = isGear
        ? 1_000_000_000
        : bhStage(name, to) * 100 + (name === 'Builder Hall' ? 0 : name === 'Star Laboratory' ? 20 : 60);
      const job: Job = {
        label: c.label,
        name,
        from,
        to,
        mult,
        timeSec: c.timeSec,
        pay: { ...c.byResource },
        deps: [],
        depMaxEnd: 0,
        worker: 0,
        startSec: 0,
        priority,
      };
      jobs.push(job);
      if (name === BB_GOLD_STORAGE || name === BB_ELIXIR_STORAGE) {
        const res = name === BB_GOLD_STORAGE ? 'Builder Gold' : 'Builder Elixir';
        let m = storageRaiseTo.get(res);
        if (!m) storageRaiseTo.set(res, (m = new Map()));
        const list = m.get(to);
        if (list) list.push(job);
        else m.set(to, [job]);
      }
    }

    const gearRequirements = new Map<string, { bbBuilding: string; requiresBBLevel: number }>();
    for (const spec of gearSpecs) {
      gearRequirements.set(`Gear up ${spec.homeName} (Lv ${spec.requiresHomeLevel})`, {
        bbBuilding: spec.bbBuilding,
        requiresBBLevel: spec.requiresBBLevel,
      });
    }
    for (const job of jobs) {
      const req = gearRequirements.get(job.label);
      if (!req) continue;
      const target = jobs.find((j) => j.name === req.bbBuilding && j.to >= req.requiresBBLevel && j.from < req.requiresBBLevel);
      if (target && target !== job) job.deps.push(target);
    }

    for (const job of jobs) {
      if (job.name === 'Builder Hall') continue;
      const bhReq = bhStage(job.name, job.to);
      if (bhReq > MAX_BH) continue;
      const gate = jobs.find((j) => j.name === 'Builder Hall' && j.to === bhReq);
      if (gate && gate !== job) job.deps.push(gate);
    }

    const byPath = new Map<string, Job[]>();
    for (const job of jobs) {
      const key = `${job.name}|${job.label.includes(' (copy ') ? copyNumOf(job.label) : 0}`;
      const list = byPath.get(key);
      if (list) list.push(job);
      else byPath.set(key, [job]);
    }
    for (const list of byPath.values()) {
      list.sort((a, b) => a.from - b.from);
      for (let i = 1; i < list.length; i++) list[i].deps.push(list[i - 1]);
    }

    const storageCounts: Record<string, number> = {
      'Builder Gold': getCountAtBH(BB_GOLD_STORAGE, effectiveBh),
      'Builder Elixir': getCountAtBH(BB_ELIXIR_STORAGE, effectiveBh),
    };
    const startLevelOf: Record<string, number> = {};
    for (const res of ['Builder Gold', 'Builder Elixir'] as const) {
      const raises = storageRaiseTo.get(res);
      startLevelOf[res] = raises && raises.size > 0 ? Math.min(...raises.keys()) - 1 : 1;
    }
    const capacityAt = (res: string, level: number): number => {
      const table = capacityTables[res];
      if (!table) return 0;
      let best = 0;
      for (const row of table) {
        if (row.level <= level && row.capacity > best) best = row.capacity;
      }
      return best * (storageCounts[res] ?? 1);
    };

    const builderRes = new Set(['Builder Gold', 'Builder Elixir']);
    for (const job of jobs) {
      if (job.name === BB_GOLD_STORAGE || job.name === BB_ELIXIR_STORAGE || job.name === 'Builder Hall') continue;
      for (const [res, total] of Object.entries(job.pay)) {
        if (!builderRes.has(res)) continue;
        const perCopy = total / Math.max(1, job.mult);
        if (perCopy <= 0) continue;
        const raises = storageRaiseTo.get(res);
        if (!raises) continue;
        let need = 0;
        for (let level = startLevelOf[res]; level <= 10; level++) {
          if (capacityAt(res, level) >= perCopy) {
            need = level;
            break;
          }
        }
        if (need === 0 || need <= startLevelOf[res]) continue;
        for (const raiseJob of raises.get(need) ?? []) {
          if (raiseJob !== job) job.deps.push(raiseJob);
        }
      }
    }

    const pending = new Map<Job, number>(jobs.map((j) => [j, j.deps.length]));
    const dependents = new Map<Job, Job[]>();
    for (const job of jobs) {
      for (const dep of job.deps) {
        const list = dependents.get(dep);
        if (list) list.push(job);
        else dependents.set(dep, [job]);
      }
    }
    const finish: number[] = new Array(workers).fill(0);
    const scheduled: Job[] = [];
    const ready: Job[] = jobs.filter((j) => (pending.get(j) ?? 0) === 0);
    const isStorageJob = (j: Job) => j.name === BB_GOLD_STORAGE || j.name === BB_ELIXIR_STORAGE;
    while (scheduled.length < jobs.length) {
      if (ready.length === 0) {
        let fallback: Job | null = null;
        for (const job of jobs) if (!scheduled.includes(job)) fallback = job;
        if (!fallback) break;
        ready.push(fallback);
      }
      ready.sort(
        (a, b) =>
          a.priority - b.priority ||
          (isStorageJob(b) ? 1 : 0) - (isStorageJob(a) ? 1 : 0) ||
          b.timeSec - a.timeSec ||
          a.from - b.from,
      );
      const job = ready.shift()!;
      let wi = 0;
      for (let i = 1; i < finish.length; i++) if (finish[i] < finish[wi]) wi = i;
      const start = Math.max(finish[wi], job.depMaxEnd);
      job.worker = wi;
      job.startSec = start;
      finish[wi] = start + job.timeSec;
      scheduled.push(job);
      for (const dep of dependents.get(job) ?? []) {
        dep.depMaxEnd = Math.max(dep.depMaxEnd, finish[wi]);
        const remain = (pending.get(dep) ?? 1) - 1;
        pending.set(dep, remain);
        if (remain === 0) ready.push(dep);
      }
    }

    for (const job of scheduled) {
      const chain = chains.find((c) => c.label === job.label);
      if (chain) {
        chain.worker = job.worker;
        chain.startSec = job.startSec;
      }
    }
    const ordered = chains.slice().sort((a, b) => (a.startSec ?? 0) - (b.startSec ?? 0) || (a.worker ?? 0) - (b.worker ?? 0));
    return { chains: ordered, makespan: Math.max(...finish) };
  };

  const bbChainList = aggregateDuplicateJumps(bbChains);
  const starChainList = aggregateDuplicateJumps(starLabChains);
  const bbRes = scheduleBuilderChains(bbChainList, Math.max(1, input.bbBuilders));
  const starRes = scheduleByPath(starChainList, 1);
  const bbChainsFinal = bbRes.chains;
  const starLabChainsFinal = starRes.chains;
  const bbScheduleSec = bbRes.makespan;
  const starLabSec = starRes.makespan;

  const machines: BobMachinePlan[] = [
    {
      id: 'bb-builder',
      label: MACHINE_LABEL['bb-builder'],
      timeSec: bbScheduleSec,
      chains: bbChainsFinal,
    },
    {
      id: 'star-lab',
      label: MACHINE_LABEL['star-lab'],
      timeSec: starLabSec,
      chains: starLabChainsFinal,
    },
  ];

  const totalEtaSec = Math.max(bbScheduleSec, starLabSec);

  const clockTower = (() => {
    const clock = clockTowerLevels();
    if (clock.length === 0) return null;
    const reachableMax = Math.max(...clock.filter((c) => c.level <= effectiveBh).map((c) => c.level));
    const maxAtBh = Math.min(OPTIMAL_CLOCK_TOWER, reachableMax);
    const eff = (level: number) => {
      const row = clock.find((c) => c.level === Math.min(level, maxAtBh));
      return row ? row.timeGainedMinutes / CLOCK_CYCLE_MINUTES : 0;
    };
    const base = machines[0].timeSec + machines[1].timeSec;
    const saveSec = Math.round(base * Math.max(0, eff(maxAtBh) - eff(input.clockTowerLevel)));
    if (reachableMax > OPTIMAL_CLOCK_TOWER && input.clockTowerLevel < OPTIMAL_CLOCK_TOWER) {
      notes.push(`Clock Tower is worth raising up to Lv ${OPTIMAL_CLOCK_TOWER} for this plan — higher levels add little before B.O.B`);
    }
    return { level: Math.min(input.clockTowerLevel, maxAtBh), maxLevel: maxAtBh, saveSec };
  })();

  for (const req of requirements) {
    for (const c of req.callouts) blocking.push(c);
  }

  if (input.bbBuilders < 3) {
    notes.push(`Builder Base has ${input.bbBuilders} builder${input.bbBuilders === 1 ? '' : 's'} (max 3) — more builders shorten the schedule`);
  }
  notes.push('Schedules are greedy estimates; requirement list per the in-app plan — verify against the current game version');

  return {
    ok: true,
    bh: effectiveBh,
    bbBuilders: input.bbBuilders,
    requirements,
    machines,
    bbScheduleSec: machines[0].timeSec,
    starLabSec: machines[1].timeSec,
    totalEtaSec,
    resources,
    clockTower,
    blocking: [...new Set(blocking)],
    notes: [...new Set(notes)],
  };
}