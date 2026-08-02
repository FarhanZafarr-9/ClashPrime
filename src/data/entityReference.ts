// clash.ninja entity reference — manual mapping (provided by user, Aug 2026)
// Image URL: https://www.clash.ninja/images/entities/{id}{levelSuffix ? `_${level}` : ''}.png
// levelSuffix = true: unit has per-level cosmetic sprites (troops, dark troops, siege machines, plus a few exceptions)
// levelSuffix = false: static image, level-independent

export type EntityCategory =
  | 'troops'
  | 'spells'
  | 'darkTroops'
  | 'siege'
  | 'heroes'
  | 'equipment'
  | 'pets';

export interface EntityRef {
  name: string;
  id: number;
  category: EntityCategory;
  levelSuffix: boolean;
  heroId?: number;
  builderBase?: boolean;
}

const e = (name: string, id: number, category: EntityCategory, levelSuffix: boolean, heroId?: number, builderBase?: boolean): EntityRef => ({
  name,
  id,
  category,
  levelSuffix,
  heroId,
  builderBase,
});

export const ENTITY_REFERENCE: EntityRef[] = [
  // Troops
  e('Barbarian', 31, 'troops', true),
  e('Archer', 32, 'troops', true),
  e('Giant', 33, 'troops', true),
  e('Goblin', 34, 'troops', true),
  e('Wall Breaker', 35, 'troops', true),
  e('Balloon', 36, 'troops', true),
  e('Wizard', 37, 'troops', true),
  e('Healer', 38, 'troops', true),
  e('Dragon', 39, 'troops', true),
  e('P.E.K.K.A', 40, 'troops', true),
  e('Baby Dragon', 41, 'troops', true),
  e('Miner', 42, 'troops', true),
  e('Electro Dragon', 103, 'troops', true),
  e('Yeti', 121, 'troops', true),
  e('Dragon Rider', 133, 'troops', true),
  e('Electro Titan', 138, 'troops', true),
  e('Root Rider', 156, 'troops', true),
  e('Thrower', 204, 'troops', true),
  e('Meteor Golem', 241, 'troops', true),

  // Spells
  e('Lightning Spell', 43, 'spells', false),
  e('Healing Spell', 44, 'spells', false),
  e('Rage Spell', 45, 'spells', false),
  e('Jump Spell', 46, 'spells', false),
  e('Freeze Spell', 47, 'spells', false),
  e('Clone Spell', 48, 'spells', false),
  e('Invisibility Spell', 124, 'spells', false),
  e('Recall Spell', 140, 'spells', false),
  e('Revive Spell', 205, 'spells', false),
  e('Totem Spell', 244, 'spells', false),
  e('Poison Spell', 49, 'spells', false),
  e('Earthquake Spell', 50, 'spells', false),
  e('Haste Spell', 51, 'spells', false),
  e('Skeleton Spell', 52, 'spells', false),
  e('Bat Spell', 110, 'spells', false),
  e('Overgrowth Spell', 175, 'spells', false),
  e('Ice Block Spell', 236, 'spells', false),
  e('Angry Spell', 281, 'spells', true),

  // Dark troops
  e('Minion', 53, 'darkTroops', true),
  e('Hog Rider', 54, 'darkTroops', true),
  e('Valkyrie', 55, 'darkTroops', true),
  e('Golem', 56, 'darkTroops', true),
  e('Witch', 57, 'darkTroops', true),
  e('Lava Hound', 58, 'darkTroops', true),
  e('Bowler', 59, 'darkTroops', true),
  e('Ice Golem', 111, 'darkTroops', true),
  e('Headhunter', 123, 'darkTroops', true),
  e('Apprentice Warden', 151, 'darkTroops', true),
  e('Druid', 197, 'darkTroops', true),
  e('Furnace', 218, 'darkTroops', true),
  e('Ruin Witch', 282, 'darkTroops', true),

  // Siege machines
  e('Wall Wrecker', 105, 'siege', true),
  e('Battle Blimp', 106, 'siege', true),
  e('Stone Slammer', 109, 'siege', true),
  e('Siege Barracks', 120, 'siege', true),
  e('Log Launcher', 125, 'siege', true),
  e('Flame Flinger', 134, 'siege', true),
  e('Battle Drill', 139, 'siege', true),
  e('Troop Launcher', 215, 'siege', true),
  e('Sky Wagon', 278, 'siege', true),

  // Heroes
  e('Barbarian King', 61, 'heroes', false),
  e('Archer Queen', 62, 'heroes', false),
  e('Minion Prince', 208, 'heroes', false),
  e('Grand Warden', 63, 'heroes', false),
  e('Royal Champion', 122, 'heroes', false),
  e('Dragon Duke', 260, 'heroes', false),

  // Hero equipment
  e('Barbarian Puppet', 157, 'equipment', false, 61),
  e('Rage Vial', 158, 'equipment', false, 61),
  e('Earthquake Boots', 159, 'equipment', false, 61),
  e('Vampstache', 160, 'equipment', false, 61),
  e('Giant Gauntlet', 171, 'equipment', false, 61),
  e('Spiky Ball', 194, 'equipment', false, 61),
  e('Snake Bracelet', 213, 'equipment', false, 61),
  e('Stick Horse', 258, 'equipment', false, 61),
  e('Archer Puppet', 161, 'equipment', false, 62),
  e('Invisibility Vial', 162, 'equipment', false, 62),
  e('Giant Arrow', 163, 'equipment', false, 62),
  e('Healer Puppet', 164, 'equipment', false, 62),
  e('Frozen Arrow', 172, 'equipment', false, 62),
  e('Action Figure', 220, 'equipment', false, 62),
  e('Monolith Arrow', 280, 'equipment', false, 62),
  e('Dark Orb', 209, 'equipment', false, 208),
  e('Henchmen Puppet', 210, 'equipment', false, 208),
  e('Metal Pants', 216, 'equipment', false, 208),
  e('Noble Iron', 219, 'equipment', false, 208),
  e('Dark Crown', 222, 'equipment', false, 208),
  e('Meteor Staff', 238, 'equipment', false, 208),
  e('Eternal Tome', 165, 'equipment', false, 63),
  e('Life Gem', 166, 'equipment', false, 63),
  e('Rage Gem', 168, 'equipment', false, 63),
  e('Healing Tome', 167, 'equipment', false, 63),
  e('Fireball', 176, 'equipment', false, 63),
  e('Lavaloon Puppet', 199, 'equipment', false, 63),
  e('Heroic Torch', 237, 'equipment', false, 63),
  e('Royal Gem', 169, 'equipment', false, 122),
  e('Seeking Shield', 170, 'equipment', false, 122),
  e('Hog Rider Puppet', 173, 'equipment', false, 122),
  e('Haste Vial', 174, 'equipment', false, 122),
  e('Rocket Spear', 195, 'equipment', false, 122),
  e('Electro Boots', 211, 'equipment', false, 122),
  e('Frost Flake', 257, 'equipment', false, 122),
  e('Fire Heart', 261, 'equipment', false, 260),
  e('Flame Blower', 262, 'equipment', false, 260),
  e('Stun Blaster', 263, 'equipment', false, 260),
  e('Electro Fangs', 279, 'equipment', true, 260),
  e('Rocket Backpack', 276, 'equipment', false, 260),

  // Pets
  e('L.A.S.S.I', 129, 'pets', false),
  e('Electro Owl', 130, 'pets', false),
  e('Mighty Yak', 131, 'pets', false),
  e('Unicorn', 132, 'pets', false),
  e('Frosty', 141, 'pets', false),
  e('Diggy', 142, 'pets', false),
  e('Poison Lizard', 143, 'pets', false),
  e('Phoenix', 144, 'pets', false),
  e('Spirit Fox', 155, 'pets', false),
  e('Angry Jelly', 193, 'pets', false),
  e('Sneezy', 217, 'pets', false),
  e('Greedy Raven', 259, 'pets', false),

  // Builder Base troops
  e('Raged Barbarian', 90, 'troops', true, undefined, true),
  e('Sneaky Archer', 91, 'troops', true, undefined, true),
  e('Boxer Giant', 92, 'troops', true, undefined, true),
  e('Beta Minion', 93, 'troops', true, undefined, true),
  e('Bomber', 94, 'troops', true, undefined, true),
  e('Baby Dragon (Builder Base)', 95, 'troops', true, undefined, true),
  e('Cannon Cart', 96, 'troops', true, undefined, true),
  e('Night Witch', 97, 'troops', true, undefined, true),
  e('Drop Ship', 98, 'troops', true, undefined, true),
  e('Power P.E.K.K.A', 101, 'troops', true, undefined, true),
  e('Hog Glider', 113, 'troops', true, undefined, true),
  e('Electrofire Wizard', 150, 'troops', true, undefined, true),

  // Builder Base heroes
  e('Battle Machine', 100, 'heroes', false, undefined, true),
  e('Battle Copter', 148, 'heroes', false, undefined, true),
];

const byName = new Map<string, EntityRef>(ENTITY_REFERENCE.map((ref) => [ref.name, ref]));

export function entityImageUrl(name: string, level?: number): string | null {
  const ref = byName.get(name);
  if (!ref) return null;
  const suffix = ref.levelSuffix && level ? `_${level}` : '';
  return `https://www.clash.ninja/images/entities/${ref.id}${suffix}.png`;
}

export function entityRef(name: string): EntityRef | undefined {
  return byName.get(name);
}
