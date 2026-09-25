// Zapquaker — pure reference data + combination math for the Lightning/EQ calculator.
// Game constants come exclusively from the clash-of-clans-data package; nothing is
// hardcoded here so balance changes are picked up on the next package release.

import { home } from 'clash-of-clans-data';
import type { ClashPlayer } from '../types/clash';

export interface ZapquakeSpellLevel {
  level: number;
  damage?: number;
  buildingDamagePercent?: number;
  townHallRequired?: number;
  spellFactoryLevelRequired?: number;
}

export interface ZapquakeRefs {
  lightningHousing: number;
  lightningLevels: ZapquakeSpellLevel[];
  eqHousing: number;
  eqLevels: ZapquakeSpellLevel[];
  fireballLevels: { level: number; damage: number }[];
  giantArrowLevels: { level: number; damage: number }[];
  spellFactoryLevels: { level: number; capacity: number; townHallRequired: number }[];
  darkSpellFactoryLevels: { level: number; capacity: number; townHallRequired: number }[];
}

export interface ZapquakeTargetLevel {
  level: number;
  hitpoints: number;
}

export interface ZapquakeTarget {
  name: string;
  category: 'Defenses' | 'Crafted Defenses' | 'Town Hall' | 'Resources' | 'Heroes';
  levels: ZapquakeTargetLevel[];
}

export interface SpellCapacityInfo {
  capacity: number;
  sfLevel: number;
  sfCapacity: number;
  dsfLevel: number;
  dsfCapacity: number;
  /** True when the capacity was derived from the Town Hall (no import data). */
  derived: boolean;
}

export interface ZapquakeCombo {
  fireball: number;
  giantArrow: number;
  lightning: number;
  eq: number;
  housing: number;
  fireballDamage: number;
  giantArrowDamage: number;
  lightningDamage: number;
  eqDamage: number;
  totalDamage: number;
  remaining: number;
  overkillPercent: number;
}

/** Which spell/equipment types are allowed in the searched combos. */
export interface ZapquakeComboEnabled {
  lightning: boolean;
  eq: boolean;
  fireball: boolean;
  giantArrow: boolean;
}

// --- Lazy package loading (same degrade-gracefully pattern as buildingData/armyData) ---

function safeLoad<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

let refsCache: ZapquakeRefs | null = null;

/** Full reference lookup tables for Lightning / Earthquake / Fireball / Spell Factories. */
export function getZapquakeRefs(): ZapquakeRefs {
  if (refsCache) return refsCache;
  const h = home();
  const lightning = safeLoad(() => h.spells().lightningSpell().first(), undefined) as any;
  const earthquake = safeLoad(() => h.spells().earthquakeSpell().first(), undefined) as any;
  const spellFactory = safeLoad(() => h.armyBuildings().spellFactory().first(), undefined) as any;
  const darkSpellFactory = safeLoad(() => h.armyBuildings().darkSpellFactory().first(), undefined) as any;
  const fireball = safeLoad(
    () => (h.heroEquipment().get() as any[]).find((x) => x.name === 'Fireball'),
    undefined,
  ) as any;
  const giantArrow = safeLoad(
    () => (h.heroEquipment().get() as any[]).find((x) => x.name === 'Giant Arrow'),
    undefined,
  ) as any;

  refsCache = {
    lightningHousing: lightning?.housingSpace ?? 1,
    lightningLevels: (lightning?.levels ?? []).map((l: any) => ({
      level: l.level,
      damage: l.damage,
      townHallRequired: l.townHallRequired,
    })),
    eqHousing: earthquake?.housingSpace ?? 1,
    eqLevels: (earthquake?.levels ?? []).map((l: any) => ({
      level: l.level,
      buildingDamagePercent: l.buildingDamagePercent,
      spellFactoryLevelRequired: l.spellFactoryLevelRequired,
      townHallRequired: l.townHallRequired,
    })),
    fireballLevels: (fireball?.levels ?? []).map((l: any) => ({
      level: l.level,
      damage: l.stats?.projectileDamage,
    })),
    giantArrowLevels: (giantArrow?.levels ?? []).map((l: any) => ({
      level: l.level,
      damage: l.stats?.projectileDamage,
    })),
    spellFactoryLevels: (spellFactory?.levels ?? []).map((l: any) => ({
      level: l.level,
      capacity: l.spellStorageCapacity,
      townHallRequired: l.townHallRequired,
    })),
    darkSpellFactoryLevels: (darkSpellFactory?.levels ?? []).map((l: any) => ({
      level: l.level,
      capacity: l.spellStorageCapacity,
      townHallRequired: l.townHallRequired,
    })),
  };
  return refsCache;
}

function maxLevelAtTH(levels: { level: number; townHallRequired?: number }[], th: number): number {
  let max = 0;
  for (const l of levels) {
    if ((l.townHallRequired == null || l.townHallRequired <= th) && l.level > max) max = l.level;
  }
  return max;
}

export function clampLevel(level: number, maxLevel: number): number {
  return Math.max(1, Math.min(level, Math.max(1, maxLevel)));
}

/** The player's spell level, preferring the profile value, falling back to the
 * highest level researchable at their Town Hall. */
export function getDefaultSpellLevel(
  player: ClashPlayer | null,
  spellName: string,
  th: number,
  levels: ZapquakeSpellLevel[],
): number {
  const fromProfile = player?.spells?.find((s) => s.name === spellName);
  const fallback = maxLevelAtTH(levels, th);
  const level = fromProfile?.level ?? fallback;
  return clampLevel(level, levels.length);
}

const DEFAULT_FIREBALL_LEVEL = 15;
const DEFAULT_GIANT_ARROW_LEVEL = 15;

/** Default Fireball level: the player's equipped level if imported, else a realistic mid level. */
export function getDefaultFireballLevel(player: ClashPlayer | null, refs: ZapquakeRefs): number {
  const fromProfile = player?.heroEquipment?.find((e) => e.name === 'Fireball');
  return clampLevel(fromProfile?.level ?? DEFAULT_FIREBALL_LEVEL, refs.fireballLevels.length);
}

/** Default Giant Arrow level: the player's equipped level if imported, else a realistic mid level. */
export function getDefaultGiantArrowLevel(player: ClashPlayer | null, refs: ZapquakeRefs): number {
  const fromProfile = player?.heroEquipment?.find((e) => e.name === 'Giant Arrow');
  return clampLevel(fromProfile?.level ?? DEFAULT_GIANT_ARROW_LEVEL, refs.giantArrowLevels.length);
}

/** Total spell capacity from the player's recorded Spell Factory / Dark Spell
 * Factory levels (when imported), defaulting to the current Town Hall's best. */
export function getSpellCapacity(
  player: ClashPlayer | null,
  th: number,
  refs: ZapquakeRefs,
): SpellCapacityInfo {
  const buildingLevels = player?.buildingLevels;
  const sfLevels = refs.spellFactoryLevels;
  const dsfLevels = refs.darkSpellFactoryLevels;

  const sfKnown = typeof buildingLevels?.['Spell Factory'] === 'number';
  const sfLevel = sfKnown
    ? Math.max(0, Math.min(buildingLevels!['Spell Factory'], sfLevels.length))
    : (th >= 5 ? maxLevelAtTH(sfLevels, th) : 0);
  const sfCapacity = sfLevel > 0 ? (sfLevels[sfLevel - 1]?.capacity ?? 0) : 0;

  const dsfKnown = typeof buildingLevels?.['Dark Spell Factory'] === 'number';
  const dsfLevel = dsfKnown
    ? Math.max(0, Math.min(buildingLevels!['Dark Spell Factory'], dsfLevels.length))
    : (th >= 8 ? maxLevelAtTH(dsfLevels, th) : 0);
  const dsfCapacity = dsfLevel > 0 ? (dsfLevels[dsfLevel - 1]?.capacity ?? 0) : 0;

  return {
    capacity: sfCapacity + dsfCapacity,
    sfLevel,
    sfCapacity,
    dsfLevel,
    dsfCapacity,
    derived: !sfKnown && !dsfKnown,
  };
}

// --- Target buildings ---

const EQ_IMMUNE = new Set(['Gold Storage', 'Elixir Storage', 'Dark Elixir Storage']);
const ZAP_IMMUNE = new Set(['Town Hall', 'Clan Castle']);

/** Buildings a zapquake can be aimed at (storages resist EQ; TH/CC can't be zapped). */
export function getZapquakeTargets(): ZapquakeTarget[] {
  const h = home();
  const raw: { item: any; category: ZapquakeTarget['category'] }[] = [
    ...safeLoad(() => h.defenses().get(), []).map((i: any) => ({ item: i, category: 'Defenses' as const })),
    ...safeLoad(() => h.craftedDefenses().get(), []).map((i: any) => ({ item: i, category: 'Crafted Defenses' as const })),
    ...safeLoad(() => h.townHall().get(), []).map((i: any) => ({ item: i, category: 'Town Hall' as const })),
    ...safeLoad(() => h.resourceBuildings().get(), []).map((i: any) => ({ item: i, category: 'Resources' as const })),
    ...safeLoad(() => h.resourceBuildings().clanCastle().get(), []).map((i: any) => ({ item: i, category: 'Resources' as const })),
    ...safeLoad(() => h.heroes().get(), [])
      .filter((i: any) => i.name === 'Archer Queen' || i.name === 'Minion Prince')
      .map((i: any) => ({ item: i, category: 'Heroes' as const })),
  ];

  const targets: ZapquakeTarget[] = [];
  for (const { item, category } of raw) {
    if (EQ_IMMUNE.has(item.name) || ZAP_IMMUNE.has(item.name)) continue;
    const levels = (item.levels ?? [])
      .filter((l: any) => typeof l.hitpoints === 'number' && !l.supercharge)
      .map((l: any) => ({ level: l.level, hitpoints: l.hitpoints }))
      .sort((a: any, b: any) => a.level - b.level);
    if (levels.length === 0) continue;
    targets.push({ name: item.name, category, levels });
  }

  const order: Record<ZapquakeTarget['category'], number> = {
    Defenses: 0,
    'Crafted Defenses': 1,
    'Town Hall': 2,
    Resources: 3,
    Heroes: 4,
  };
  targets.sort((a, b) => order[a.category] - order[b.category] || a.name.localeCompare(b.name));
  return targets;
}

/** Default building level for a target: the player's recorded level (import) if
 * known, else the highest level reachable at their Town Hall. */
export function getDefaultTargetLevel(
  player: ClashPlayer | null,
  target: ZapquakeTarget,
  th: number,
  maxLevelAtTheirTH: (name: string, th: number) => number | null,
): number {
  let level: number | undefined;
  if (target.category === 'Heroes' && player?.heroes) {
    const hero = player.heroes.find((x) => x.name === target.name);
    if (hero && typeof hero.level === 'number') level = hero.level;
  }
  if (level == null && player?.buildingLevels && typeof player.buildingLevels[toStoreKey(target.name)] === 'number') {
    level = player.buildingLevels[toStoreKey(target.name)];
  }
  if (level == null) {
    if (target.category === 'Heroes') {
      level = target.levels[target.levels.length - 1]?.level ?? 1;
    } else {
      const atTH = maxLevelAtTheirTH(target.name, th);
      level = atTH != null && atTH > 0 ? atTH : target.levels.length;
    }
  }
  return clampLevel(Math.round(level), target.levels.length);
}

function toStoreKey(name: string): string {
  return name === "Builder's Hut" ? 'Builder Hut' : name;
}

// --- Combination math ---

/** Cumulative damage fraction of m Earthquake Spells: the 1st does D%, the k-th
 * (k>=2) does D/(2k-1) of max HP, so the sequence is 1, 1/3, 1/5, 1/7... */
export function eqCumulativeFraction(m: number): number {
  let sum = 0;
  for (let k = 1; k <= m; k++) sum += 1 / (2 * k - 1);
  return sum;
}

export function computeZapquakeCombos(opts: {
  hp: number;
  lightningLevel: number;
  eqLevel: number;
  capacity: number;
  fireballDamage: number;
  giantArrowDamage: number;
  /** Damage multiplier applied to the Giant Arrow. The only pairing in the game:
   * ×2 vs Air Defenses. Defaults to 1. */
  giantArrowMultiplier?: number;
  enabled: ZapquakeComboEnabled;
  refs: ZapquakeRefs;
}): ZapquakeCombo[] {
  const { hp, capacity, refs, enabled } = opts;
  const lightningDamagePer = refs.lightningLevels[opts.lightningLevel - 1]?.damage ?? 0;
  const eqPercent = refs.eqLevels[opts.eqLevel - 1]?.buildingDamagePercent ?? 0;
  const lh = refs.lightningHousing;
  const eh = refs.eqHousing;

  // Equipment is optional: enumerate all usable configurations so combos can use
  // Fireball alone, Giant Arrow alone, both, or none (spells only).
  const fbRaw = Math.max(0, opts.fireballDamage || 0);
  const gaRaw = Math.max(0, opts.giantArrowDamage || 0) * (opts.giantArrowMultiplier ?? 1);
  const equipMasks = [{ fireball: 0, giantArrow: 0 }];
  if (enabled.fireball && fbRaw > 0) {
    equipMasks.push({ fireball: 1, giantArrow: 0 });
    if (enabled.giantArrow && gaRaw > 0) {
      equipMasks.push({ fireball: 0, giantArrow: 1 });
      equipMasks.push({ fireball: 1, giantArrow: 1 });
    }
  } else if (enabled.giantArrow && gaRaw > 0) {
    equipMasks.push({ fireball: 0, giantArrow: 1 });
  }
  if (hp <= 0 || capacity <= 0) return [];
  if (!enabled.lightning && !enabled.eq && equipMasks.length === 1) return [];

  const combos: ZapquakeCombo[] = [];
  const maxN = enabled.lightning ? Math.floor(capacity / lh) : 0;
  for (const equip of equipMasks) {
    const fireballDamage = equip.fireball ? fbRaw : 0;
    const giantArrowDamage = equip.giantArrow ? gaRaw : 0;
    const bonus = fireballDamage + giantArrowDamage;
    for (let n = 0; n <= maxN; n++) {
      const budget = capacity - n * lh;
      const maxM = enabled.eq ? Math.floor(budget / eh) : 0;
      for (let m = 0; m <= maxM; m++) {
        if (n === 0 && m === 0 && bonus === 0) continue;
        const lightningDamage = n * lightningDamagePer;
        const eqDamage = (hp * eqPercent * eqCumulativeFraction(m)) / 100;
        const totalDamage = lightningDamage + eqDamage + bonus;
        if (totalDamage < hp - 1e-6) continue;
        const remaining = Math.max(0, hp - totalDamage);
        combos.push({
          fireball: equip.fireball,
          giantArrow: equip.giantArrow,
          lightning: n,
          eq: m,
          housing: n * lh + m * eh,
          fireballDamage,
          giantArrowDamage,
          lightningDamage,
          eqDamage,
          totalDamage,
          remaining,
          overkillPercent: hp > 0 ? ((totalDamage - hp) / hp) * 100 : 0,
        });
      }
    }
  }

  combos.sort(
    (a, b) =>
      a.housing - b.housing ||
      a.lightning + a.eq - (b.lightning + b.eq) ||
      a.fireball + a.giantArrow - (b.fireball + b.giantArrow) ||
      a.lightning - b.lightning ||
      b.eq - a.eq,
  );
  return combos;
}