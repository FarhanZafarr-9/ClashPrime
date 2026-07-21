const FANDOM_BASE = 'https://clashofclans.fandom.com';

const imageUrlOverrides = new Map<string, string>();

export function setTroopImageOverride(name: string, imageUrl: string) {
  if (name && imageUrl) imageUrlOverrides.set(name.toLowerCase(), imageUrl);
}

const FANDOM_IMAGE_OVERRIDES: Record<string, string> = {
  'Super Barbarian': 'Super_Barbarian_info_2.png',
  'P.E.K.K.A': 'P.E.K.K.A_info.png',
  'L.A.S.S.I': 'L.A.S.S.I._info.png',
  'Power P.E.K.K.A': 'Power_P.E.K.K.A_info.png',
  'Super P.E.K.K.A': 'Power_P.E.K.K.A_info.png',
  'Night Witch': 'Night_Witch_info.png',
  'Drop Ship': 'Drop_Ship_info.png',
  'Hog Glider': 'Hog_Glider_info.png',
  'Electrofire Wizard': 'Electrofire_Wizard_info.png',
};

export function getTroopImageUrl(name: string): string | null {
  const key = name.toLowerCase();
  const override = imageUrlOverrides.get(key);
  if (override) return override;
  return getFandomDirectUrl(
    FANDOM_IMAGE_OVERRIDES[name] ?? toFandomFilename(name),
  );
}

const HERO_FILENAMES: Record<string, string> = {
  'Barbarian King': 'Barbarian_King_info.png',
  'Archer Queen': 'Archer_Queen_info.png',
  'Grand Warden': 'Grand_Warden_info.png',
  'Royal Champion': 'Royal_Champion_info.png',
  'Minion Prince': 'Minion_Prince_info.png',
  'Battle Machine': 'Battle_Machine_info.png',
  'Battle Copter': 'Battle_Copter_info.png',
};

const PET_FILENAMES: Record<string, string> = {
  'Frosty': 'Frosty_info.png',
  'Electro Owl': 'Electro_Owl_info.png',
  'Mighty Yak': 'Mighty_Yak_info.png',
  'Diggy': 'Diggy_info.png',
  'Phoenix': 'Phoenix_info.png',
  'Spirit Fox': 'Spirit_Fox_info.png',
  'Angry Jelly': 'Angry_Jelly_info.png',
  'Poison Lizard': 'Poison_Lizard_info.png',
  'L.A.S.S.I': 'L.A.S.S.I._info.png',
  'Unicorn': 'Unicorn_info.png',
};

const EQUIPMENT_FILENAMES: Record<string, string> = {
  'Vampstache': 'Vampstache_info.png',
  'Giant Gauntlet': 'Giant_Gauntlet_info.png',
  'Rage Vial': 'Rage_Vial_info.png',
  'Archer Puppet': 'Archer_Puppet_info.png',
  'Healer Puppet': 'Healer_Puppet_info.png',
  'Frozen Arrow': 'Frozen_Arrow_info.png',
  'Invisibility Vial': 'Invisibility_Vial_info.png',
  'Royal Cloak': 'Royal_Cloak_info.png',
  'Seeking Shield': 'Seeking_Shield_info.png',
  'Hog Rider Puppet': 'Hog_Rider_Puppet_info.png',
  'Haste Vial': 'Haste_Vial_info.png',
  'Eternal Tome': 'Eternal_Tome_info.png',
  'Healing Tome': 'Healing_Tome_info.png',
  'Life Gem': 'Life_Gem_info.png',
  'Fireball': 'Fireball_info.png',
  'Earthquake Boots': 'Earthquake_Boots_info.png',
  'Iron Fist': 'Iron_Fist_info.png',
  'Barbarian Puppet': 'Barbarian_Puppet_info.png',
  'Magic Mirror': 'Magic_Mirror_info.png',
  'Rocket Spear': 'Rocket_Spear_info.png',
  'Snake Armor': 'Snake_Armor_info.png',
  'Electro Boots': 'Electro_Boots_info.png',
  'Dark Orb': 'Dark_Orb_info.png',
  'Minion Bros': 'Minion_Bros_info.png',
  'Lavaloon Puppet': 'Lavaloon_Puppet_info.png',
  'Noble Iron': 'Noble_Iron_info.png',
};

function toFandomFilename(name: string): string {
  return name.replace(/\s+/g, '_') + '_info.png';
}

function getFandomDirectUrl(filename: string): string {
  return `${FANDOM_BASE}/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
}

export function getHeroImageUrl(name: string): string | null {
  const filename = HERO_FILENAMES[name] ?? toFandomFilename(name);
  return getFandomDirectUrl(filename);
}

export function getHeroSlug(name: string): string | null {
  return name.replace(/\s+/g, '-').toLowerCase();
}

export function getPetImageUrl(name: string): string | null {
  const filename = PET_FILENAMES[name] ?? toFandomFilename(name);
  return getFandomDirectUrl(filename);
}

export function getEquipmentImageUrl(name: string): string | null {
  const filename = EQUIPMENT_FILENAMES[name] ?? toFandomFilename(name);
  return getFandomDirectUrl(filename);
}
