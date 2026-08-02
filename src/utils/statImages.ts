// Stat icons bundled from the PixelCrux Clash of Clans profile page
// (https://pixelcrux.com/Clash_of_Clans/Images/Icons/). These are static
// game assets that do not change, so they are shipped with the app.

export const STAT_ICONS = {
  exp: require('../../assets/stats/exp.png'),
  trophies: require('../../assets/stats/trophies.png'),
  bestTrophies: require('../../assets/stats/best_trophies.png'),
  bhTrophies: require('../../assets/stats/bh_trophies.png'),
  bhBestTrophies: require('../../assets/stats/bh_best_trophies.png'),
  warStars: require('../../assets/stats/war_stars.png'),
} as const;

export type StatIconName = keyof typeof STAT_ICONS;

export const CATEGORY_ICONS = {
  Heroes: require('../../assets/categories/heroes.png'),
  Troops: require('../../assets/categories/troops.png'),
  Spells: require('../../assets/categories/spells.png'),
  Equipment: require('../../assets/categories/equipment.png'),
} as const;
