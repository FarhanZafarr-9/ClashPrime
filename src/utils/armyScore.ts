import type { ClashArmy, EquipmentDef, PetDef, UnitDef } from '../types/armies';
import type { ClashPlayer } from '../types/clash';
import { isSuperTroop } from '../types/clash';
import { getMaxLevelAtTH, looseNameKey, resolveArmyItemName } from './armyData';

export type ArmyItemCategory = 'hero' | 'equipment' | 'pet' | 'siege' | 'spell' | 'troop';

/**
 * Weights for "how maxed am I for this army". Each category contributes one
 * percentage (the mean progress of its items) rather than each item contributing
 * separately - an army carries 8-16 troops but only 4 heroes, so per-item scoring
 * would let troops swamp the heroes that actually decide an attack. Heroes are
 * weighted heaviest: they take the longest to max and gate the most power, so
 * heroes plus their equipment land at roughly half the score.
 */
const CATEGORY_WEIGHTS: Record<ArmyItemCategory, number> = {
  hero: 2.5,
  equipment: 1.5,
  siege: 1.5,
  pet: 1.0,
  spell: 1.0,
  troop: 0.7,
};

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

export interface ArmyScore {
  /** 0-100 weighted progress of the player's own levels for this army's items. */
  score: number;
  /** Every scored item, for detail rows. */
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
  for (const p of player.pets ?? []) {
    if (p.village !== 'home') continue;
    owned.pets.set(nameKey(p.name), p.level);
  }
  return owned;
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
    // A pet with an unknown definition still names its hero, so don't require the
    // lookup to succeed here.
    if (petsById.has(p.petId) && p.hero) heroes.add(p.hero);
  }
  return [...heroes];
}

/** Shortfall, used to rank the gaps. */
function shortfall(item: ArmyScoreItem): number {
  return item.max - item.current;
}

/**
 * How maxed the player is for the items this army uses, against their own Town
 * Hall caps. Deliberately *not* "how maxed this army is": the ClashArmies payload
 * carries no per-unit levels, so the army's own state is unknowable. What can be
 * measured is the player's distance from a fully maxed version of it.
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

  const items: ArmyScoreItem[] = [];
  const unknown: string[] = [];
  const unavailable: string[] = [];
  // The same spell can sit in both the army camp and the clan castle leg, and the
  // score is a mean over items - counting it twice would quietly inflate the
  // spell category. First sighting wins.
  const seen = new Set<string>();

  // Scored on the canonical package name, listed under the name the army uses.
  const addItem = (displayName: string, category: ArmyItemCategory, lookupName: string, current: number) => {
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
    items.push({ name: displayName, category, current: Math.min(current, max), max });
  };

  // Army camp and clan castle legs are both ordinary units - the clan castle leg
  // is NOT a hero list (it carries Rocket Balloon, Root Rider, Troop Launcher),
  // so the category comes from the unit definition alone.
  for (const u of army.units) {
    const def = unitsById.get(u.unitId);
    if (!def) {
      unknown.push(`#${u.unitId}`);
      continue;
    }
    const category: ArmyItemCategory =
      def.type === 'Spell' ? 'spell' : def.type === 'Siege' ? 'siege' : 'troop';
    // Look the player's level up on the package name too, so "Rage" on the army
    // and "Rage Spell" on the player resolve to the same entry.
    const pkgName = resolveArmyItemName(def.name) ?? def.name;
    addItem(def.name, category, pkgName, owned.units.get(nameKey(pkgName)) ?? 0);
  }

  for (const hero of armyHeroes(army, equipmentById, petsById)) {
    const pkgName = resolveArmyItemName(hero) ?? hero;
    addItem(hero, 'hero', pkgName, owned.units.get(nameKey(pkgName)) ?? 0);
  }

  for (const eq of army.equipment) {
    const def = equipmentById.get(eq.equipmentId);
    if (!def) {
      unknown.push(`#${eq.equipmentId}`);
      continue;
    }
    const lookup = EQUIPMENT_ALIASES[def.name] ?? def.name;
    const current = owned.equipment.get(equipmentKey(def.hero, lookup)) ?? 0;
    addItem(def.name, 'equipment', lookup, current);
  }

  for (const p of army.pets) {
    const def = petsById.get(p.petId);
    if (!def) {
      unknown.push(`#${p.petId}`);
      continue;
    }
    const pkgName = resolveArmyItemName(def.name) ?? def.name;
    addItem(def.name, 'pet', pkgName, owned.pets.get(nameKey(pkgName)) ?? 0);
  }

  // Mean progress within each category, then a weighted mean across categories.
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
    const w = CATEGORY_WEIGHTS[category];
    weighted += (sum / count) * w;
    weightSum += w;
  }

  return {
    score: weightSum > 0 ? Math.round((weighted / weightSum) * 100) : 0,
    items,
    gaps: items.filter((it) => it.current < it.max).sort((a, b) => shortfall(b) - shortfall(a)).slice(0, 3),
    unavailable,
    unknown,
  };
}