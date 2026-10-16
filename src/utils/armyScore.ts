import type { ClashArmy, EquipmentDef, PetDef, UnitDef } from '../types/armies';
import type { ClashPlayer } from '../types/clash';
import { isSuperTroop } from '../types/clash';
import {
  getArmyItem,
  getClanCastleCapacity,
  getMaxLevelAtTH,
  looseNameKey,
  resolveArmyItemName,
  type ClanCastleCapacity,
} from './armyData';

export type ArmyItemCategory = 'hero' | 'equipment' | 'pet' | 'siege' | 'spell' | 'troop';

/**
 * Weights inside the army camp leg. Each category contributes one percentage
 * (the mean progress of its items) rather than every item contributing separately,
 * so a long troop list can't swamp the spells and siege that actually decide an
 * attack.
 */
const CAMP_WEIGHTS: Record<ArmyItemCategory, number> = {
  troop: 1.0,
  spell: 1.0,
  siege: 1.5,
  hero: 0,
  equipment: 0,
  pet: 0,
};

/**
 * Weights inside the hero leg. Heroes dominate: they take the longest to max and
 * gate the most power, with their equipment and pets counting for less.
 */
const HERO_WEIGHTS: Record<ArmyItemCategory, number> = {
  hero: 2.5,
  equipment: 1.5,
  pet: 1.0,
  troop: 0,
  spell: 0,
  siege: 0,
};

/**
 * Weights across the three legs for the single overall figure. Heroes are roughly
 * half the score on their own.
 */
const LEG_WEIGHTS = { troops: 1.0, heroes: 2.5, castle: 1.5 };

/** Loose name key so "L.A.S.S.I" and "Lassi" match each other. */
const nameKey = looseNameKey;

/**
 * ClashArmies equipment names with no counterpart in the bundled package under
 * any plausible spelling. Kept as an explicit list rather than a fuzzy match:
 * guessing between similarly named game items would silently score the wrong
 * piece. Everything else resolves through resolveArmyItemName.
 */
const EQUIPMENT_ALIASES: Record<string, string> = {
  'Hog Rider Doll': 'Hog Rider Puppet',
};

export interface ArmyScoreItem {
  /** Display name, as the army lists it. */
  name: string;
  category: ArmyItemCategory;
  /** The player's current level, 0 when they don't have the item at all. */
  current: number;
  /** Highest level reachable at the player's Town Hall. */
  max: number;
}

export interface ArmyCastleScore {
  /**
   * How much of what the castle leg needs fits in the player's castle, or null
   * when the leg is empty or their castle level is unknown. Capped at 100 - an
   * over-capacity leg reads as "doesn't fit" via `over`, not as a percentage over
   * a hundred.
   */
  pct: number | null;
  needed: ClanCastleCapacity;
  available: ClanCastleCapacity | null;
  /** Capacity types the player's castle is too small for, e.g. ['troop']. */
  over: (keyof ClanCastleCapacity)[];
}

export interface ArmyScore {
  /** 0-100 across the three legs. */
  score: number;
  /** Army camp leg by level, or null when the army has no camp units. */
  troops: number | null;
  /** Heroes plus equipment and pets by level, or null when the army has no heroes. */
  heroes: number | null;
  /** Clan castle leg by capacity rather than level. */
  castle: ArmyCastleScore;
  /** Every level-scored item, for detail rows. */
  items: ArmyScoreItem[];
  /** Biggest shortfalls, worst first. */
  gaps: ArmyScoreItem[];
  /** Items the army wants that cannot exist at this Town Hall at all. */
  unavailable: string[];
  /** Items with no bundled data - left out of the score instead of counted as zero. */
  unknown: string[];
}

export interface ArmyScoreDefs {
  unitsById: Map<number, UnitDef>;
  equipmentById: Map<number, EquipmentDef>;
  petsById: Map<number, PetDef>;
}

interface OwnedLevels {
  /** Troops, spells, siege and heroes all resolve by display name. */
  units: Map<string, number>;
  /** Keyed `hero|equipment` because the player's equipment hangs off the hero. */
  equipment: Map<string, number>;
  pets: Map<string, number>;
}

function equipmentKey(hero: string, equipment: string): string {
  return `${nameKey(hero)}|${nameKey(equipment)}`;
}

/**
 * The player's own levels, keyed for lookup. Home village only, and super troops
 * are excluded because the Clash API reports them at level 1 regardless of the
 * Workshop level that actually gates them - counting them would report a fully
 * upgraded super troop as untouched.
 */
function collectOwnedLevels(player: ClashPlayer | null | undefined): OwnedLevels {
  const owned: OwnedLevels = { units: new Map(), equipment: new Map(), pets: new Map() };
  if (!player) return owned;
  // Siege machines arrive inside `troops`, so that one loop covers troops and
  // sieges; spells have their own list and heroes their own.
  for (const t of player.troops ?? []) {
    if (t.village !== 'home' || isSuperTroop(t.name)) continue;
    owned.units.set(nameKey(t.name), t.level);
  }
  for (const s of player.spells ?? []) {
    if (s.village !== 'home') continue;
    owned.units.set(nameKey(s.name), s.level);
  }
  for (const h of player.heroes ?? []) {
    if (h.village !== 'home') continue;
    owned.units.set(nameKey(h.name), h.level);
    for (const e of h.equipment ?? []) {
      owned.equipment.set(equipmentKey(h.name, e.name), e.level);
    }
  }
  // Equipment is also published as a flat list; take whichever is populated, and
  // never let a second copy of the same piece overwrite the first.
  for (const e of player.heroEquipment ?? []) {
    const key = equipmentKey(e.name, e.name);
    if (!owned.equipment.has(key)) owned.equipment.set(key, e.level);
  }
  for (const p of player.pets ?? []) {
    if (p.village !== 'home') continue;
    owned.pets.set(nameKey(p.name), p.level);
  }
  return owned;
}

/** The player's current Clan Castle level, from either building representation. */
function playerCastleLevel(player: ClashPlayer): number {
  const byName = player.buildingLevels?.['Clan Castle'];
  if (byName != null && byName > 0) return byName;
  return player.buildings?.find((b) => b.name === 'Clan Castle')?.level ?? 0;
}

/**
 * The army's heroes. They are never listed as units - a pure-hero army has an
 * empty unit list - so the only record of them is the hero field on each piece of
 * equipment and on each pet entry. Note the pet's hero comes from the army's pet
 * entry, not the pet definition, which only carries a name.
 */
function armyHeroes(
  army: ClashArmy,
  equipmentById: Map<number, EquipmentDef>,
  petsById: Map<number, PetDef>,
): string[] {
  const heroes = new Set<string>();
  for (const eq of army.equipment) {
    const def = equipmentById.get(eq.equipmentId);
    if (def?.hero) heroes.add(def.hero);
  }
  for (const p of army.pets) {
    if (petsById.has(p.petId) && p.hero) heroes.add(p.hero);
  }
  return [...heroes];
}

/** Housing space for a unit, preferring the army's own figure and falling back to the package. */
function unitHousing(def: UnitDef | undefined, pkgName: string | null): number {
  if (def?.housingSpace) return def.housingSpace;
  return pkgName ? getArmyItem(pkgName)?.housingSpace ?? 0 : 0;
}

/** Mean progress per category, then a weighted mean across the categories present. */
function weightedProgress(items: ArmyScoreItem[], weights: Record<ArmyItemCategory, number>): number | null {
  const byCategory = new Map<ArmyItemCategory, { sum: number; count: number }>();
  for (const it of items) {
    const entry = byCategory.get(it.category) ?? { sum: 0, count: 0 };
    entry.sum += Math.min(it.current, it.max) / it.max;
    entry.count += 1;
    byCategory.set(it.category, entry);
  }
  let weighted = 0;
  let weightSum = 0;
  for (const [category, { sum, count }] of byCategory) {
    const w = weights[category] ?? 0;
    if (w <= 0) continue;
    weighted += (sum / count) * w;
    weightSum += w;
  }
  if (weightSum <= 0) return null;
  return Math.round((weighted / weightSum) * 100);
}

/** Shortfall, used to rank the gaps. */
function shortfall(item: ArmyScoreItem): number {
  return item.max - item.current;
}

/**
 * How maxed the player is for the items this army uses, against their own Town
 * Hall. Deliberately *not* "how maxed this army is": the ClashArmies payload
 * carries no per-unit levels, so the army's own state is unknowable. What can be
 * measured is the player's distance from a fully maxed, fully fitting version.
 *
 * The three legs are judged differently, because they fail differently. Army camp
 * and hero levels are judged by how close each item is to its Town Hall cap. The
 * clan castle leg is judged by *capacity* instead: a higher hall hands you bigger
 * spell and troop caps than the army's author could assume, so a castle leg that
 * fits someone else's castle is not a level problem - it's whether your castle can
 * hold it at all.
 *
 * Items the Town Hall can't provide at all are reported in `unavailable` instead
 * of being scored as zero - an army needing a TH17 troop isn't "20% maxed", it
 * simply isn't for you yet. Items the package has never heard of go to `unknown`,
 * so a data gap never masquerades as an unmaxed item.
 */
export function scoreArmyForPlayer(
  army: ClashArmy,
  defs: ArmyScoreDefs,
  player: ClashPlayer | null | undefined,
  thLevel: number,
): ArmyScore | null {
  if (!player) return null;
  const owned = collectOwnedLevels(player);
  const { unitsById, equipmentById, petsById } = defs;

  const campItems: ArmyScoreItem[] = [];
  const heroItems: ArmyScoreItem[] = [];
  const unknown: string[] = [];
  const unavailable: string[] = [];
  const needed: ClanCastleCapacity = { troop: 0, spell: 0, siege: 0 };
  // The same spell can sit in both the army camp and the clan castle leg, and the
  // score is a mean over items - counting it twice would quietly inflate the
  // category. First sighting wins.
  const seen = new Set<string>();

  /** Scored on the canonical package name, listed under the name the army uses. */
  const addItem = (
    into: ArmyScoreItem[],
    displayName: string,
    category: ArmyItemCategory,
    lookupName: string,
    current: number,
  ) => {
    const pkgName = resolveArmyItemName(lookupName);
    if (!pkgName) {
      unknown.push(displayName);
      return;
    }
    const key = `${category}|${pkgName}`;
    if (seen.has(key)) return;
    seen.add(key);
    const max = getMaxLevelAtTH(pkgName, thLevel);
    if (max == null || max <= 0) {
      unavailable.push(displayName);
      return;
    }
    into.push({ name: displayName, category, current: Math.min(current, max), max });
  };

  for (const u of army.units) {
    const def = unitsById.get(u.unitId);
    if (!def) {
      unknown.push(`#${u.unitId}`);
      continue;
    }
    const category: ArmyItemCategory =
      def.type === 'Spell' ? 'spell' : def.type === 'Siege' ? 'siege' : 'troop';
    const pkgName = resolveArmyItemName(def.name);
    // Look the player's level up on the package name too, so "Rage" on the army
    // and "Rage Spell" on the player resolve to the same entry.
    const ownedLevel = owned.units.get(nameKey(pkgName ?? def.name)) ?? 0;

    if (u.home === 'clanCastle') {
      // Capacity, not level: the castle either has room or it doesn't.
      if (pkgName) {
        needed[category === 'spell' ? 'spell' : category === 'siege' ? 'siege' : 'troop'] +=
          unitHousing(def, pkgName) * u.amount;
      }
      continue;
    }
    addItem(campItems, def.name, category, pkgName ?? def.name, ownedLevel);
  }

  for (const hero of armyHeroes(army, equipmentById, petsById)) {
    const pkgName = resolveArmyItemName(hero) ?? hero;
    addItem(heroItems, hero, 'hero', pkgName, owned.units.get(nameKey(pkgName)) ?? 0);
  }

  for (const eq of army.equipment) {
    const def = equipmentById.get(eq.equipmentId);
    if (!def) {
      unknown.push(`#${eq.equipmentId}`);
      continue;
    }
    const lookup = EQUIPMENT_ALIASES[def.name] ?? def.name;
    addItem(heroItems, def.name, 'equipment', lookup, owned.equipment.get(equipmentKey(def.hero, lookup)) ?? 0);
  }

  for (const p of army.pets) {
    const def = petsById.get(p.petId);
    if (!def) {
      unknown.push(`#${p.petId}`);
      continue;
    }
    const pkgName = resolveArmyItemName(def.name) ?? def.name;
    addItem(heroItems, def.name, 'pet', pkgName, owned.pets.get(nameKey(pkgName)) ?? 0);
  }

  const troops = weightedProgress(campItems, CAMP_WEIGHTS);
  const heroes = weightedProgress(heroItems, HERO_WEIGHTS);

  // Castle capacity: only categories the castle actually has room for count, and
  // an empty leg has no score rather than a perfect one. The ratio is measured as
  // "how much of what this leg needs can my castle actually hold", so a leg that
  // doesn't fit lands below 100% instead of being clamped to a misleading perfect
  // score. Anything the castle is short for is recorded in `over` too.
  const available = getClanCastleCapacity(playerCastleLevel(player));
  const hasCastleLeg = needed.troop > 0 || needed.spell > 0 || needed.siege > 0;
  const over: (keyof ClanCastleCapacity)[] = [];
  let castlePct: number | null = null;
  if (hasCastleLeg && available) {
    const ratios: number[] = [];
    for (const key of ['troop', 'spell', 'siege'] as const) {
      if (available[key] <= 0 || needed[key] <= 0) continue;
      if (needed[key] > available[key]) over.push(key);
      ratios.push(Math.min(1, available[key] / needed[key]));
    }
    castlePct = ratios.length > 0 ? Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100) : 100;
  }

  let overall = 0;
  let overallWeight = 0;
  const legs: { value: number | null; weight: number }[] = [
    { value: troops, weight: LEG_WEIGHTS.troops },
    { value: heroes, weight: LEG_WEIGHTS.heroes },
    { value: castlePct, weight: LEG_WEIGHTS.castle },
  ];
  for (const leg of legs) {
    if (leg.value == null) continue;
    overall += leg.value * leg.weight;
    overallWeight += leg.weight;
  }

  const items = [...campItems, ...heroItems];
  return {
    score: overallWeight > 0 ? Math.round(overall / overallWeight) : 0,
    troops,
    heroes,
    castle: { pct: castlePct, needed, available, over },
    items,
    gaps: items.filter((it) => it.current < it.max).sort((a, b) => shortfall(b) - shortfall(a)).slice(0, 3),
    unavailable,
    unknown,
  };
}