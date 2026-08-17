// Shared detail types for army items. Level data itself now comes exclusively
// from the clash-of-clans-data package (see armyData.ts); no Fandom scraping.

export interface TroopDetailLevel {
  level: number;
  dps: number;
  damagePerHit: number;
  hitpoints: number;
  upgradeCost: string;
  upgradeTime: string;
  xp: number;
  labLevel: number | null;
  thRequired: number | null;
  extra?: { label: string; value: string }[];
  /** Canonical resource type this level costs (e.g. "Elixir", "Dark Elixir", "Shiny Ore"). */
  costResource?: string;
  /** Full numeric cost of this level, unformatted. */
  costAmount?: number;
  /** All resources this level costs (e.g. equipment levels that require Shiny + Glowing + Starry ore). */
  costs?: { resource: string; amount: number }[];
}

export interface TroopDetail {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  levels: TroopDetailLevel[];
  currentLevel?: number;
  maxLevel?: number;
  info: {
    range: string;
    housingSpace: number;
    attackSpeed: string;
    damageType: string;
    targetType: string;
    favoriteTarget: string;
  };
  infoPairs?: { label: string; value: string }[];
}
