// Shared semantics for the Time to Max "Strategic Exclusions" list, so the
// screen, the pipeline math and TH readiness all agree on what a key means.
//
// Two kinds of entry live in one persisted set (AsyncStorage, one global list
// like the builder count):
//
//   • Building — keyed by its display name ("Lab", "Walls", "BB Cannon"). Every
//     copy of the building is skipped. A few of them also *gate* a pipeline:
//     excluding the Laboratory drops troop/spell research entirely, the Hero
//     Hall drops hero upgrades, and so on — see GATED_PIPELINES.
//   • Army item — a troop, spell, siege, hero, pet or piece of equipment, so a
//     single item can be left out of a pipeline without dropping the rest.
//     Namespaced with ARMY_PREFIX so an item name can never shadow a building
//     name (Home and Builder Base display names are otherwise disjoint).

/** Namespaces an army item name inside the exclusion set. */
const ARMY_PREFIX = 'army:';

/** Exclusion key for one army item (troop, spell, siege, hero, pet, equipment). */
export function armyKey(name: string): string {
  return ARMY_PREFIX + name;
}

/** True when a stored exclusion key refers to an army item rather than a building. */
export function isArmyKey(key: string): boolean {
  return key.startsWith(ARMY_PREFIX);
}

/** Army item name behind an exclusion key, or null for a building key. */
export function armyNameFromKey(key: string): string | null {
  return isArmyKey(key) ? key.slice(ARMY_PREFIX.length) : null;
}

/** True when the army item `name` is excluded. */
export function isArmyExcluded(excluded: ReadonlySet<string> | undefined, name: string): boolean {
  return excluded?.has(armyKey(name)) === true;
}

/** True when the building `name` is excluded. */
export function isBuildingExcluded(excluded: ReadonlySet<string> | undefined, name: string): boolean {
  return excluded?.has(name) === true;
}

/** The army pipelines an item can belong to, each gated by one building. */
export type ArmyPipeline = 'lab' | 'heroes' | 'pets' | 'equipment' | 'bb-lab' | 'bb-heroes';

/**
 * Buildings that gate a pipeline rather than only their own upgrade chain:
 * excluding the gate drops every upgrade that runs inside it. Names are the
 * display names used by the exclusion list, and by buildingData's categories.
 */
export const PIPELINE_GATES: Record<ArmyPipeline, string> = {
  lab: 'Lab',
  heroes: 'Hero Hall',
  pets: 'Pet House',
  equipment: 'Blacksmith',
  'bb-lab': 'Star Laboratory',
  'bb-heroes': 'Builder Barracks',
};

/** True when the building gating this pipeline is excluded. */
export function isPipelineGated(excluded: ReadonlySet<string> | undefined, pipeline: ArmyPipeline): boolean {
  return isBuildingExcluded(excluded, PIPELINE_GATES[pipeline]);
}

/** Human labels for the exclusion groups, keyed by pipeline. */
export const PIPELINE_LABELS: Record<ArmyPipeline, string> = {
  lab: 'Laboratory',
  heroes: 'Heroes',
  pets: 'Pet House',
  equipment: 'Equipment',
  'bb-lab': 'Star Laboratory',
  'bb-heroes': 'Heroes',
};
