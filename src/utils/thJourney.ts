import type { ClashPlayer } from '../types/clash';
import type { TroopDetail } from '../api/troopDetail';
import { getBuildingCategories, HOME_CATEGORIES, getBuildingItemImage, getMaxTownHall } from './buildingData';
import { getBuildingCopies, getCountAtTH } from './buildingCopies';
import { getAllItemsAtTH, getArmyItemImage } from './armyData';
import { getBuildingEffectiveMax } from './buildingImages';
import {
  remainingBuildingCosts,
  remainingArmyCosts,
  formatTimeShort,
  formatCostBreakdown,
} from './upgradeCosts';

export interface ThJourneyItem {
  name: string;
  copies: number;
  maxLevel: number;
  timeSec: number;
  cost: number;
  byResource: Record<string, number>;
  iconSource?: number;
  type: 'building' | 'hero' | 'troop' | 'spell' | 'pet' | 'siege' | 'equipment';
}

export interface ThJourneyLevelUp {
  name: string;
  copies: number;
  levelDelta: number;
  timeSec: number;
  cost: number;
  byResource: Record<string, number>;
}

export interface ThJourneySummary {
  totalBuildTimeSec: number;
  totalResearchTimeSec: number;
  totalBuildCost: number;
  totalResearchCost: number;
  totalOreCost: Record<string, number>;
  newBuildingsCount: number;
  newHeroesCount: number;
  newTroopsSpellsCount: number;
  newPetsCount: number;
  newSiegesCount: number;
  newEquipmentCount: number;
  buildingLevelUps: number;
  armyLevelUps: number;
}

export interface ThJourneyDetail {
  newBuildings: ThJourneyItem[];
  newHeroes: ThJourneyItem[];
  newTroops: ThJourneyItem[];
  newSpells: ThJourneyItem[];
  newPets: ThJourneyItem[];
  newSieges: ThJourneyItem[];
  newEquipment: ThJourneyItem[];
  buildingLevelUps: ThJourneyLevelUp[];
  armyLevelUps: ThJourneyLevelUp[];
}

export interface ThJourneyCumulative {
  buildTimeSec: number;
  researchTimeSec: number;
  buildCost: number;
  researchCost: number;
}

export interface ThJourneyStep {
  th: number;
  isCurrent: boolean;
  isMax: boolean;
  summary: ThJourneySummary;
  detail: ThJourneyDetail;
  cumulative: ThJourneyCumulative;
}

function computeBuildingItems(
  th: number,
  prevTh: number,
  player?: ClashPlayer
): { newItems: ThJourneyItem[]; levelUps: ThJourneyLevelUp[]; buildTimeSec: number; buildCost: number; byResource: Record<string, number> } {
  const newItems: ThJourneyItem[] = [];
  const levelUps: ThJourneyLevelUp[] = [];
  let totalBuildTimeSec = 0;
  let totalBuildCost = 0;
  const totalByResource: Record<string, number> = {};

  const prevCats = getBuildingCategories(prevTh);
  const currCats = getBuildingCategories(th);

  for (const [cat, names] of Object.entries(HOME_CATEGORIES)) {
    for (const display of names) {
      const prevEntry = prevCats[cat]?.[display]?.[String(prevTh)];
      const currEntry = currCats[cat]?.[display]?.[String(th)];
      const prevLevel = prevEntry?.level ?? 0;
      const currLevel = currEntry?.level ?? 0;

      if (currLevel <= 0) continue;

      const count = getCountAtTH(display, th);
      const effectiveMax = getBuildingEffectiveMax(display, th);
      if (effectiveMax <= 0) continue;

      const copies = getBuildingCopies(
        display,
        player?.buildingLevels,
        player?.buildings,
        effectiveMax,
        count,
        player?.lastMaxedTH ?? 0,
        th
      );

      const iconSource = getBuildingItemImage(display, 1) ?? undefined;

      if (prevLevel <= 0 && currLevel > 0) {
        const ct = remainingBuildingCosts(display, Array(count).fill(0), effectiveMax);
        if (ct.time > 0 || ct.cost > 0) {
          newItems.push({
            name: display,
            copies: count,
            maxLevel: effectiveMax,
            timeSec: ct.time,
            cost: ct.cost,
            byResource: ct.byResource ?? {},
            iconSource,
            type: 'building',
          });
          totalBuildTimeSec += ct.time;
          totalBuildCost += ct.cost;
          for (const [res, val] of Object.entries(ct.byResource ?? {})) {
            totalByResource[res] = (totalByResource[res] ?? 0) + val;
          }
        }
      } else if (currLevel > prevLevel) {
        const levelDelta = currLevel - prevLevel;
        const ct = remainingBuildingCosts(display, copies.levels.map(l => Math.min(l, prevLevel)), effectiveMax);
        if (ct.time > 0 || ct.cost > 0) {
          levelUps.push({
            name: display,
            copies: count,
            levelDelta,
            timeSec: ct.time,
            cost: ct.cost,
            byResource: ct.byResource ?? {},
          });
          totalBuildTimeSec += ct.time;
          totalBuildCost += ct.cost;
          for (const [res, val] of Object.entries(ct.byResource ?? {})) {
            totalByResource[res] = (totalByResource[res] ?? 0) + val;
          }
        }
      }
    }
  }

  return { newItems, levelUps, buildTimeSec: totalBuildTimeSec, buildCost: totalBuildCost, byResource: totalByResource };
}

function computeArmyItems(
  th: number,
  prevTh: number,
  armyDetails: Record<string, TroopDetail | null>
): { newItems: ThJourneyItem[]; levelUps: ThJourneyLevelUp[]; researchTimeSec: number; researchCost: number; byResource: Record<string, number>; oreCost: Record<string, number> } {
  const newItems: ThJourneyItem[] = [];
  const levelUps: ThJourneyLevelUp[] = [];
  let totalResearchTimeSec = 0;
  let totalResearchCost = 0;
  const totalByResource: Record<string, number> = {};
  const totalOreCost: Record<string, number> = {};

  const prevItems = getAllItemsAtTH(prevTh);
  const currItems = getAllItemsAtTH(th);

  const prevMap = new Map(prevItems.map(i => [`${i.type}:${i.name}`, i] as const));
  const currMap = new Map(currItems.map(i => [`${i.type}:${i.name}`, i] as const));

  for (const [key, curr] of currMap) {
    const [type, name] = key.split(':');
    const prev = prevMap.get(key);
    const prevMax = prev?.maxLevel ?? 0;
    const currMax = curr.maxLevel ?? 0;

    if (currMax <= 0) continue;

    const detail = armyDetails[name];
    const iconSource = getArmyItemImage(name) ?? undefined;
    let itemType: ThJourneyItem['type'] = 'troop';
    if (type === 'hero') itemType = 'hero';
    else if (type === 'spell') itemType = 'spell';
    else if (type === 'pet') itemType = 'pet';
    else if (type === 'siege') itemType = 'siege';
    else if (type === 'equipment') itemType = 'equipment';

    if (prevMax <= 0 && currMax > 0) {
      if (itemType === 'equipment') {
        const item = detail;
        if (!item) continue;
        let maxLevel = 0;
        for (const lvl of item.levels) {
          const req = lvl.labLevel ?? 0;
          if (req <= currMax && lvl.level > maxLevel) maxLevel = lvl.level;
        }
        if (maxLevel <= 0) continue;
        const byResource: Record<string, number> = {};
        let cost = 0;
        for (const lvl of item.levels) {
          if (lvl.level > 0 && lvl.level <= maxLevel) {
            for (const c of lvl.costs ?? []) {
              if (c.amount > 0) {
                byResource[c.resource] = (byResource[c.resource] ?? 0) + c.amount;
                totalOreCost[c.resource] = (totalOreCost[c.resource] ?? 0) + c.amount;
                cost += c.amount;
              }
            }
          }
        }
        if (cost > 0) {
          newItems.push({ name, copies: 1, maxLevel, timeSec: 0, cost, byResource, iconSource, type: itemType });
          totalResearchCost += cost;
        }
      } else {
        const ct = remainingArmyCosts(detail, 0, currMax);
        if (ct.time > 0 || ct.cost > 0) {
          newItems.push({ name, copies: 1, maxLevel: currMax, timeSec: ct.time, cost: ct.cost, byResource: ct.byResource ?? {}, iconSource, type: itemType });
          totalResearchTimeSec += ct.time;
          totalResearchCost += ct.cost;
          for (const [res, val] of Object.entries(ct.byResource ?? {})) {
            totalByResource[res] = (totalByResource[res] ?? 0) + val;
          }
        }
      }
    } else if (currMax > prevMax) {
      const levelDelta = currMax - prevMax;
      if (itemType === 'equipment') {
        const item = detail;
        if (!item) continue;
        const byResource: Record<string, number> = {};
        let cost = 0;
        for (const lvl of item.levels) {
          if (lvl.level > prevMax && lvl.level <= currMax) {
            for (const c of lvl.costs ?? []) {
              if (c.amount > 0) {
                byResource[c.resource] = (byResource[c.resource] ?? 0) + c.amount;
                totalOreCost[c.resource] = (totalOreCost[c.resource] ?? 0) + c.amount;
                cost += c.amount;
              }
            }
          }
        }
        if (cost > 0) {
          levelUps.push({ name, copies: 1, levelDelta, timeSec: 0, cost, byResource });
          totalResearchCost += cost;
        }
      } else {
        const ct = remainingArmyCosts(detail, prevMax, currMax);
        if (ct.time > 0 || ct.cost > 0) {
          levelUps.push({ name, copies: 1, levelDelta, timeSec: ct.time, cost: ct.cost, byResource: ct.byResource ?? {} });
          totalResearchTimeSec += ct.time;
          totalResearchCost += ct.cost;
          for (const [res, val] of Object.entries(ct.byResource ?? {})) {
            totalByResource[res] = (totalByResource[res] ?? 0) + val;
          }
        }
      }
    }
  }

  return { newItems, levelUps, researchTimeSec: totalResearchTimeSec, researchCost: totalResearchCost, byResource: totalByResource, oreCost: totalOreCost };
}

export function computeThJourney(
  currentTh: number,
  player?: ClashPlayer,
  builderCount: number = 5,
  armyDetails: Record<string, TroopDetail | null> = {}
): ThJourneyStep[] {
  const maxTh = getMaxTownHall();
  const steps: ThJourneyStep[] = [];
  let cumulative: ThJourneyCumulative = { buildTimeSec: 0, researchTimeSec: 0, buildCost: 0, researchCost: 0 };

  for (let th = currentTh; th <= maxTh; th++) {
    const prevTh = th === 1 ? 1 : th - 1;
    const isCurrent = th === currentTh;
    const isMax = th === maxTh;

    const buildingResult = computeBuildingItems(th, prevTh, player);
    const armyResult = computeArmyItems(th, prevTh, armyDetails);

    const summary: ThJourneySummary = {
      totalBuildTimeSec: buildingResult.buildTimeSec,
      totalResearchTimeSec: armyResult.researchTimeSec,
      totalBuildCost: buildingResult.buildCost,
      totalResearchCost: armyResult.researchCost,
      totalOreCost: armyResult.oreCost,
      newBuildingsCount: buildingResult.newItems.length,
      newHeroesCount: buildingResult.newItems.filter(i => i.type === 'hero').length + armyResult.newItems.filter(i => i.type === 'hero').length,
      newTroopsSpellsCount: armyResult.newItems.filter(i => i.type === 'troop' || i.type === 'spell').length,
      newPetsCount: armyResult.newItems.filter(i => i.type === 'pet').length,
      newSiegesCount: armyResult.newItems.filter(i => i.type === 'siege').length,
      newEquipmentCount: armyResult.newItems.filter(i => i.type === 'equipment').length,
      buildingLevelUps: buildingResult.levelUps.length,
      armyLevelUps: armyResult.levelUps.length,
    };

    const detail: ThJourneyDetail = {
      newBuildings: buildingResult.newItems.filter(i => i.type === 'building'),
      newHeroes: [...buildingResult.newItems.filter(i => i.type === 'hero'), ...armyResult.newItems.filter(i => i.type === 'hero')],
      newTroops: armyResult.newItems.filter(i => i.type === 'troop'),
      newSpells: armyResult.newItems.filter(i => i.type === 'spell'),
      newPets: armyResult.newItems.filter(i => i.type === 'pet'),
      newSieges: armyResult.newItems.filter(i => i.type === 'siege'),
      newEquipment: armyResult.newItems.filter(i => i.type === 'equipment'),
      buildingLevelUps: buildingResult.levelUps,
      armyLevelUps: armyResult.levelUps,
    };

    const stepCumulative: ThJourneyCumulative = {
      buildTimeSec: cumulative.buildTimeSec + buildingResult.buildTimeSec,
      researchTimeSec: cumulative.researchTimeSec + armyResult.researchTimeSec,
      buildCost: cumulative.buildCost + buildingResult.buildCost,
      researchCost: cumulative.researchCost + armyResult.researchCost,
    };

    steps.push({
      th,
      isCurrent,
      isMax,
      summary,
      detail,
      cumulative: stepCumulative,
    });

    cumulative = stepCumulative;
  }

  return steps;
}

export function formatJourneyTime(buildSec: number, researchSec: number): string {
  const parts: string[] = [];
  if (buildSec > 0) parts.push(`${formatTimeShort(buildSec)} build`);
  if (researchSec > 0) parts.push(`${formatTimeShort(researchSec)} research`);
  return parts.join(' · ') || '—';
}

export function formatJourneyCost(buildCost: number, researchCost: number, oreCost: Record<string, number>): string {
  const parts: string[] = [];
  if (buildCost > 0) parts.push(formatCostBreakdown({ Gold: buildCost }));
  if (researchCost > 0) parts.push(formatCostBreakdown({ Elixir: researchCost }));
  for (const [ore, val] of Object.entries(oreCost)) {
    if (val > 0) parts.push(`${formatCostBreakdown({ [ore]: val })} ${ore}`);
  }
  return parts.join(' · ') || '—';
}