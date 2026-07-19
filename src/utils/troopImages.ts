import troopListData from '../data/troop-list.json';

const troops = troopListData.troops;

const nameToEntry = new Map(troops.map((t) => [t.name.toLowerCase(), t]));

export function getTroopImageUrl(name: string): string | null {
  const entry = nameToEntry.get(name.toLowerCase());
  return entry?.imageUrl ?? null;
}

export function getTroopSlug(name: string): string | null {
  const entry = nameToEntry.get(name.toLowerCase());
  return entry?.slug ?? null;
}

export function getTroopVillage(name: string): string | null {
  const entry = nameToEntry.get(name.toLowerCase());
  return entry?.village ?? null;
}

const HERO_SLUGS: Record<string, string> = {
  'Barbarian King': 'barbarian-king',
  'Archer Queen': 'archer-queen',
  'Grand Warden': 'grand-warden',
  'Royal Champion': 'royal-champion',
  'Minion Prince': 'minion-hero',
  'Battle Machine': 'warmachine',
  'Battle Copter': 'battle-copter',
};

const PET_SLUGS: Record<string, string> = {
  'Frosty': 'frosty',
  'Electro Owl': 'electrowl',
  'Mighty Yak': 'bulldozer',
  'Diggy': 'diggy',
  'Phoenix': 'phoenix',
  'Spirit Fox': 'phase-fennec',
  'Angry Jelly': 'angry-jelly',
  'Poison Lizard': 'poison-lizard',
  'L.A.S.S.I': 'barky',
  'Unicorn': 'unipony',
};

const EQUIPMENT_SLUGS: Record<string, string> = {
  'Vampstache': 'vampstache',
  'Giant Gauntlet': 'giant-gauntlet',
  'Rage Vial': 'angry-tome',
  'Archer Puppet': 'healer-jar',
  'Healer Puppet': 'healer-jar',
  'Frozen Arrow': 'frozen-arrow',
  'Invisibility Vial': 'royal-cloak',
  'Royal Cloak': 'royal-cloak',
  'Seeking Shield': 'seeking-shield',
  'Hog Rider Puppet': 'hog-rider-puppet',
  'Haste Vial': 'haste-vial',
  'Eternal Tome': 'eternal-tome',
  'Healing Tome': 'healing-tome',
  'Life Gem': 'life-gem',
  'Fireball': 'fire-in-a-can',
  'Earthquake Boots': 'earthquake-boots',
  'Iron Fist': 'iron-fist',
  'Barbarian Puppet': 'barbarian-crown',
  'Archer Puppet Crown': 'archer-crown',
  'Magic Mirror': 'magic-mirror',
  'Puppet': 'piercing-arrow',
  'Rocket Spear': 'rocket-spear',
  'Snake Armor': 'snake-armor',
  'Electro Boots': 'electro-boots',
  'Dark Orb': 'mp-dark-orb',
  'Minion Bros': 'mp-minion-bros',
  'Lavaloon Puppet': 'gw-lavaloon-puppet',
  'Noble Iron': 'protective-cloak',
};

function toSlug(name: string): string {
  return name.replace(/\s+/g, '-').toLowerCase();
}

export function getHeroImageUrl(name: string): string | null {
  const slug = HERO_SLUGS[name] ?? toSlug(name);
  if (!slug) return null;
  return `https://coc.guide/static/imgs/hero/${slug}.png`;
}

export function getHeroSlug(name: string): string | null {
  return HERO_SLUGS[name] ?? toSlug(name);
}

export function getPetImageUrl(name: string): string | null {
  const slug = PET_SLUGS[name] ?? toSlug(name);
  return `https://coc.guide/static/imgs/pet/${slug}.png`;
}

export function getPetSlug(name: string): string | null {
  return PET_SLUGS[name] ?? toSlug(name);
}

export function getEquipmentImageUrl(name: string): string | null {
  const slug = EQUIPMENT_SLUGS[name] ?? toSlug(name);
  return `https://coc.guide/static/imgs/equipment/${slug}.png`;
}

export function getEquipmentSlug(name: string): string | null {
  return EQUIPMENT_SLUGS[name] ?? toSlug(name);
}
