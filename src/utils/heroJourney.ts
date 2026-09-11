// Hero's Journey: the in-game rewards track inside the Hero Hall (TH7+).
// Progress is driven exclusively by the player's cumulative home-village hero
// levels. Each milestone unlocks a fixed reward: ores, resources, magic items,
// hero equipment, hero skins, or a star-scoring hero quest that pays ore chests
// (amounts scale with Town Hall). Reward thresholds mirror the official wiki.
//
// https://clashofclans.fandom.com/wiki/Hero%27s_Journey

import type { ClashPlayer } from '../types/clash';
import { getAllItemsAtTH } from './armyData';

// --- Reward taxonomy ---

export type HeroJourneyRewardKind =
  | 'shinyOre'
  | 'glowyOre'
  | 'starryOre'
  | 'elixir'
  | 'darkElixir'
  | 'heroPotion'
  | 'mightyMorsel'
  | 'petPotion'
  | 'bookHeroes'
  | 'runeElixir'
  | 'runeDarkElixir'
  | 'equipment'
  | 'skin'
  | 'quest';

export interface RawHeroJourneyMilestone {
  level: number;
  kind: HeroJourneyRewardKind;
  amount?: number; // ores / elixir / dark elixir quantity
  count?: number; // potions, morsels, books, runes
  hero?: string; // skin / quest / equipment — owning hero
  equip?: string; // quest requiring a specific piece of equipment
  equipLevel?: number; // equipment reward level
}

// --- Static rewards track (verified against the wiki) ---

export const HERO_JOURNEY_MILESTONES: RawHeroJourneyMilestone[] = [
  { level: 2, kind: 'darkElixir', amount: 3000 },
  { level: 5, kind: 'heroPotion', count: 1 },
  { level: 9, kind: 'darkElixir', amount: 5000 },
  { level: 13, kind: 'quest', hero: 'Barbarian King' },
  { level: 20, kind: 'equipment', hero: 'Barbarian King', equipLevel: 1 },
  { level: 21, kind: 'mightyMorsel', count: 3 },
  { level: 25, kind: 'quest', equip: 'Giant Gauntlet' },
  { level: 29, kind: 'shinyOre', amount: 2500 },
  { level: 35, kind: 'quest', hero: 'Archer Queen' },
  { level: 38, kind: 'darkElixir', amount: 10000 },
  { level: 43, kind: 'quest', hero: 'Barbarian King' },
  { level: 50, kind: 'equipment', hero: 'Archer Queen', equipLevel: 6 },
  { level: 51, kind: 'mightyMorsel', count: 3 },
  { level: 53, kind: 'quest', equip: 'Frozen Arrow' },
  { level: 57, kind: 'darkElixir', amount: 25000 },
  { level: 64, kind: 'bookHeroes', count: 1 },
  { level: 69, kind: 'glowyOre', amount: 200 },
  { level: 74, kind: 'heroPotion', count: 1 },
  { level: 79, kind: 'quest', hero: 'Minion Prince' },
  { level: 83, kind: 'darkElixir', amount: 50000 },
  { level: 87, kind: 'quest', equip: 'Rage Vial' },
  { level: 92, kind: 'starryOre', amount: 10 },
  { level: 99, kind: 'equipment', hero: 'Minion Prince', equipLevel: 9 },
  { level: 101, kind: 'mightyMorsel', count: 3 },
  { level: 105, kind: 'quest', equip: 'Dark Crown' },
  { level: 110, kind: 'elixir', amount: 5_000_000 },
  { level: 115, kind: 'quest', hero: 'Minion Prince' },
  { level: 125, kind: 'skin', hero: 'Barbarian King' },
  { level: 130, kind: 'shinyOre', amount: 5000 },
  { level: 135, kind: 'quest', hero: 'Grand Warden' },
  { level: 140, kind: 'glowyOre', amount: 250 },
  { level: 145, kind: 'quest', equip: 'Eternal Tome' },
  { level: 150, kind: 'equipment', hero: 'Grand Warden', equipLevel: 12 },
  { level: 152, kind: 'mightyMorsel', count: 3 },
  { level: 155, kind: 'quest', equip: 'Fireball' },
  { level: 158, kind: 'darkElixir', amount: 100000 },
  { level: 163, kind: 'quest', hero: 'Archer Queen' },
  { level: 167, kind: 'shinyOre', amount: 5000 },
  { level: 172, kind: 'starryOre', amount: 15 },
  { level: 180, kind: 'equipment', hero: 'Barbarian King', equipLevel: 12 },
  { level: 181, kind: 'mightyMorsel', count: 3 },
  { level: 182, kind: 'quest', equip: 'Spiky Ball' },
  { level: 185, kind: 'glowyOre', amount: 250 },
  { level: 190, kind: 'quest', hero: 'Minion Prince' },
  { level: 195, kind: 'heroPotion', count: 2 },
  { level: 203, kind: 'equipment', hero: 'Archer Queen', equipLevel: 12 },
  { level: 204, kind: 'mightyMorsel', count: 3 },
  { level: 207, kind: 'quest', equip: 'Magic Mirror' },
  { level: 211, kind: 'elixir', amount: 10_000_000 },
  { level: 215, kind: 'quest', hero: 'Royal Champion' },
  { level: 225, kind: 'skin', hero: 'Archer Queen' },
  { level: 230, kind: 'quest', equip: 'Royal Gem' },
  { level: 233, kind: 'darkElixir', amount: 150000 },
  { level: 238, kind: 'quest', hero: 'Barbarian King' },
  { level: 243, kind: 'starryOre', amount: 25 },
  { level: 250, kind: 'equipment', hero: 'Royal Champion', equipLevel: 12 },
  { level: 251, kind: 'mightyMorsel', count: 3 },
  { level: 253, kind: 'quest', equip: 'Rocket Spear' },
  { level: 260, kind: 'bookHeroes', count: 1 },
  { level: 264, kind: 'quest', hero: 'Archer Queen' },
  { level: 266, kind: 'shinyOre', amount: 5000 },
  { level: 276, kind: 'skin', hero: 'Minion Prince' },
  { level: 280, kind: 'quest', hero: 'Royal Champion' },
  { level: 285, kind: 'runeElixir', count: 1 },
  { level: 289, kind: 'quest', hero: 'Grand Warden' },
  { level: 292, kind: 'glowyOre', amount: 500 },
  { level: 302, kind: 'equipment', hero: 'Minion Prince', equipLevel: 15 },
  { level: 303, kind: 'mightyMorsel', count: 3 },
  { level: 305, kind: 'quest', equip: 'Meteor Staff' },
  { level: 310, kind: 'darkElixir', amount: 200000 },
  { level: 315, kind: 'quest', equip: 'Frozen Arrow' },
  { level: 320, kind: 'petPotion', count: 1 },
  { level: 330, kind: 'skin', hero: 'Grand Warden' },
  { level: 334, kind: 'quest', hero: 'Dragon Duke' },
  { level: 337, kind: 'starryOre', amount: 25 },
  { level: 342, kind: 'quest', hero: 'Barbarian King' },
  { level: 345, kind: 'darkElixir', amount: 250000 },
  { level: 354, kind: 'equipment', hero: 'Grand Warden', equipLevel: 15 },
  { level: 355, kind: 'mightyMorsel', count: 3 },
  { level: 356, kind: 'quest', equip: 'Lavaloon Puppet' },
  { level: 360, kind: 'heroPotion', count: 2 },
  { level: 364, kind: 'quest', hero: 'Dragon Duke' },
  { level: 366, kind: 'glowyOre', amount: 500 },
  { level: 373, kind: 'equipment', hero: 'Dragon Duke', equipLevel: 15 },
  { level: 375, kind: 'mightyMorsel', count: 3 },
  { level: 380, kind: 'quest', equip: 'Rocket Backpack' },
  { level: 385, kind: 'runeDarkElixir', count: 1 },
  { level: 388, kind: 'starryOre', amount: 25 },
  { level: 392, kind: 'quest', equip: 'Fire Heart' },
  { level: 393, kind: 'elixir', amount: 15_000_000 },
  { level: 400, kind: 'skin', hero: 'Royal Champion' },
  { level: 402, kind: 'petPotion', count: 1 },
  { level: 403, kind: 'quest', hero: 'Royal Champion' },
  { level: 407, kind: 'starryOre', amount: 50 },
  { level: 410, kind: 'quest', hero: 'Grand Warden' },
  { level: 412, kind: 'darkElixir', amount: 350000 },
  { level: 416, kind: 'petPotion', count: 1 },
  { level: 425, kind: 'equipment', hero: 'Royal Champion', equipLevel: 15 },
  { level: 426, kind: 'mightyMorsel', count: 3 },
  { level: 428, kind: 'quest', equip: 'Electro Boots' },
  { level: 430, kind: 'elixir', amount: 20_000_000 },
  { level: 434, kind: 'heroPotion', count: 2 },
  { level: 438, kind: 'quest', hero: 'Barbarian King' },
  { level: 440, kind: 'elixir', amount: 25_000_000 },
  { level: 444, kind: 'shinyOre', amount: 5000 },
  { level: 452, kind: 'equipment', hero: 'Barbarian King', equipLevel: 15 },
  { level: 453, kind: 'mightyMorsel', count: 3 },
  { level: 455, kind: 'quest', equip: 'Snake Bracelet' },
  { level: 457, kind: 'darkElixir', amount: 400000 },
  { level: 460, kind: 'quest', hero: 'Dragon Duke' },
  { level: 465, kind: 'starryOre', amount: 50 },
  { level: 470, kind: 'bookHeroes', count: 1 },
  { level: 480, kind: 'skin', hero: 'Dragon Duke' },
];

export const HERO_JOURNEY_MAX_LEVEL = 480;

// --- Ore chest contents scale with Town Hall (normal table) ---

interface OreChestRange {
  shiny: [number, number];
  glowy: [number, number];
  starry: [number, number];
}

const ORE_CHEST_NORMAL: Record<number, OreChestRange> = {
  8: { shiny: [250, 350], glowy: [9, 19], starry: [1, 3] },
  9: { shiny: [300, 400], glowy: [12, 22], starry: [1, 3] },
  10: { shiny: [350, 450], glowy: [15, 25], starry: [2, 4] },
  11: { shiny: [500, 700], glowy: [20, 40], starry: [3, 5] },
  12: { shiny: [700, 900], glowy: [30, 50], starry: [4, 6] },
  13: { shiny: [900, 1100], glowy: [40, 60], starry: [8, 12] },
  14: { shiny: [1100, 1300], glowy: [50, 70], starry: [10, 18] },
  15: { shiny: [1325, 1525], glowy: [60, 80], starry: [25, 35] },
  16: { shiny: [1550, 1750], glowy: [70, 90], starry: [30, 40] },
  17: { shiny: [1750, 1950], glowy: [80, 100], starry: [40, 50] },
  18: { shiny: [1950, 2150], glowy: [90, 110], starry: [50, 60] },
};

export interface OreChestAmounts {
  shiny: number;
  glowy: number;
  starry: number;
}

export function oreChestAmounts(townHallLevel: number): OreChestAmounts | null {
  const range = ORE_CHEST_NORMAL[townHallLevel];
  if (!range) return null;
  const mid = ([lo, hi]: [number, number]) => Math.round((lo + hi) / 2);
  return { shiny: mid(range.shiny), glowy: mid(range.glowy), starry: mid(range.starry) };
}

// --- Per-Town-Hall hero caps ---
//
// Each Town Hall gates the maximum cumulative hero level reachable inside it:
// only the home heroes available at that TH count, each capped by its max
// Hero Hall level. These come from the package (hero levels gated by the max
// Hero Hall reachable at the TH), so they stay current as caps evolve.
// TH7→10, TH8→30, TH9→70, TH10→100, TH11→150, TH12→210, TH13→275,
// TH14→320, TH15→365, TH16→400, TH17→435, TH18→465.

export interface HeroJourneyTHCap {
  th: number;
  /** Maximum sum of home-village hero levels inside this Town Hall. */
  cap: number;
  heroes: { name: string; maxLevel: number }[];
}

let thCapsCache: HeroJourneyTHCap[] | null = null;

export function getHeroJourneyTHCaps(): HeroJourneyTHCap[] {
  if (thCapsCache) return thCapsCache;
  const caps: HeroJourneyTHCap[] = [];
  for (let th = 7; th <= 18; th++) {
    const heroes = getAllItemsAtTH(th)
      .filter((i) => i.type === 'hero')
      .map((h) => ({ name: h.name, maxLevel: h.maxLevel }));
    caps.push({ th, cap: heroes.reduce((s, h) => s + h.maxLevel, 0), heroes });
  }
  thCapsCache = caps;
  return caps;
}

/** Lowest Town Hall whose hero cap reaches the given cumulative level. */
export function minThForHeroLevel(level: number): number | null {
  const entry = getHeroJourneyTHCaps().find((c) => c.cap >= level);
  return entry ? entry.th : null;
}

// --- TH sections that split the rewards track ---

export interface HeroJourneyTHSection {
  th: number;
  cap: number;
  /** First cumulative level reachable inside this TH (> previous TH cap). */
  minLevel: number;
  /** Last cumulative level reachable inside this TH (== cap). */
  maxLevel: number;
  /** Heroes that become available at this TH. */
  newHeroes: string[];
}

let thSectionsCache: HeroJourneyTHSection[] | null = null;

export function getHeroJourneySections(): HeroJourneyTHSection[] {
  if (thSectionsCache) return thSectionsCache;
  const caps = getHeroJourneyTHCaps();
  let prevCap = 0;
  const prevHeroes = new Set<string>();
  const sections = caps.map((c) => {
    const newHeroes = c.heroes.map((h) => h.name).filter((n) => !prevHeroes.has(n));
    newHeroes.forEach((n) => prevHeroes.add(n));
    const section = { th: c.th, cap: c.cap, minLevel: prevCap + 1, maxLevel: c.cap, newHeroes };
    prevCap = c.cap;
    return section;
  });
  thSectionsCache = sections;
  return sections;
}

function milestoneDescription(m: HeroJourneyMilestone): string {
  if (m.kind === 'equipment') {
    return m.fallbackOre ? '50 Starry Ore' : `Lv ${m.equipLevel}`;
  }
  if (m.kind === 'quest') {
    const th = minThForHeroLevel(m.level);
    const chest = th == null ? null : oreChestAmounts(Math.min(18, Math.max(8, th)));
    if (!chest) return '—';
    return `${chest.shiny} Shiny · ${chest.glowy} Glowy · ${chest.starry} Starry`;
  }
  return '—';
}

// --- Computed milestone (unlock state derived from cumulative hero levels) ---

/**
 * Ordered equipment pools per hero. Equipment reward nodes are
 * deterministic in-game: the Nth node for a hero grants the Nth pool
 * entry (reached nodes always display that original piece), and once that
 * entry is owned the next not-yet-owned entry is selected for upcoming
 * nodes. When every piece in the pool is owned, the reward is replaced by
 * 50 Starry Ore.
 *
 * https://clashofclans.fandom.com/wiki/Hero%27s_Journey
 */
export const HERO_EQUIPMENT_POOLS: Record<string, string[]> = {
  'Barbarian King': ['Giant Gauntlet', 'Spiky Ball', 'Snake Bracelet', 'Stick Horse'],
  'Archer Queen': ['Frozen Arrow', 'Magic Mirror', 'Action Figure'],
  'Minion Prince': ['Dark Crown', 'Meteor Staff'],
  'Grand Warden': ['Fireball', 'Lavaloon Puppet', 'Heroic Torch'],
  'Royal Champion': ['Rocket Spear', 'Electro Boots', 'Frost Flake'],
  'Dragon Duke': ['Rocket Backpack'],
};

export interface HeroJourneyMilestone extends RawHeroJourneyMilestone {
  unlocked: boolean;
  isCurrent: boolean; // most recently reached milestone
  /** Passed nodes are already claimed (level reached); lower ones are upcoming. */
  claimState: 'claimed' | 'upcoming';
  /** Lowest Town Hall able to reach this node's cumulative level. */
  minTh: number | null;
  /** Description column for the rewards table (equipment level / quest ores / —). */
  description: string;
  /**
   * Piece actually awarded at this equipment node — the first not-owned entry
   * from the hero's pool, following the in-game deterministic order. null
   * when the pool is exhausted and the node pays 50 Starry Ore instead.
   */
  rewardEquip?: string | null;
  /** True when the pool is fully owned and the reward is 50 Starry Ore. */
  fallbackOre?: boolean;
}

export interface HeroJourneyData {
  milestones: HeroJourneyMilestone[];
  cumulativeLevels: number;
  globalMaxLevel: number;
  unlockedCount: number;
  currentMilestone: HeroJourneyMilestone | null;
  nextMilestone: HeroJourneyMilestone | null;
  progressPercent: number; // between current and next milestone
  overallPercent: number; // cumulative / global max
  townHallLevel: number;
  /** Maximum cumulative hero levels reachable at the player's Town Hall. */
  thCap: number;
  /** TH sections (with caps) that split the rewards track. */
  sections: HeroJourneyTHSection[];
  oreChest: OreChestAmounts | null;
}

// --- Main computation ---

export function computeHeroJourney(player: ClashPlayer): HeroJourneyData {
  const cumulative = player.heroes
    .filter((h) => h.village === 'home')
    .reduce((sum, h) => sum + h.level, 0);

  const capped = Math.min(cumulative, HERO_JOURNEY_MAX_LEVEL);
  const oreChest = oreChestAmounts(player.townHallLevel);
  const sections = getHeroJourneySections();
  const thCapEntry = sections.find((s) => s.th === Math.min(player.townHallLevel, 18));
  const thCap = player.townHallLevel < 7 ? 0 : thCapEntry?.cap ?? 0;

  const milestones: HeroJourneyMilestone[] = HERO_JOURNEY_MILESTONES.map((m) => ({
    ...m,
    unlocked: m.level <= capped,
    isCurrent: false,
    claimState: m.level <= capped ? 'claimed' : 'upcoming',
    minTh: minThForHeroLevel(m.level),
    description: '—',
  }));

  // Equipment reward nodes map 1:1 to each hero's equipment pool: the Nth
  // equipment milestone for a hero originally granted the Nth pool entry
  // (level 20 → Giant Gauntlet, 180 → Spiky Ball, ...). Reached nodes keep
  // displaying that original piece — the one the player actually got from
  // them — no matter what they own today, so a bought-ahead piece never
  // rewrites history. Upcoming nodes follow the game's deterministic rule:
  // the first pool entry the player does not yet own (counting pieces granted
  // by earlier nodes); a fully-owned pool pays 50 Starry Ore instead.
  const ownedEquipment = new Set<string>();
  for (const e of player.heroEquipment) ownedEquipment.add(e.name);
  for (const h of player.heroes) for (const e of h.equipment ?? []) ownedEquipment.add(e.name);
  const poolOrdinal: Record<string, number> = {};
  for (const m of milestones) {
    if (m.kind !== 'equipment' || !m.hero) continue;
    const pool = HERO_EQUIPMENT_POOLS[m.hero] ?? [];
    const ordinal = poolOrdinal[m.hero] ?? 0;
    poolOrdinal[m.hero] = ordinal + 1;
    const nominal = pool[Math.min(ordinal, pool.length - 1)];
    if (m.claimState === 'claimed') {
      m.rewardEquip = nominal;
      ownedEquipment.add(nominal);
      continue;
    }
    const award = pool.find((name) => !ownedEquipment.has(name));
    if (award) {
      m.rewardEquip = award;
      ownedEquipment.add(award);
    } else {
      m.rewardEquip = null;
      m.fallbackOre = true;
    }
  }
  for (const m of milestones) m.description = milestoneDescription(m);

  const unlockedList = milestones.filter((m) => m.unlocked);
  const current = unlockedList.length > 0 ? unlockedList[unlockedList.length - 1] : null;
  const next = milestones.find((m) => !m.unlocked) ?? null;

  if (current) current.isCurrent = true;

  const progressPercent =
    current && next ? ((capped - current.level) / (next.level - current.level)) * 100 : capped >= HERO_JOURNEY_MAX_LEVEL ? 100 : 0;

  return {
    milestones,
    cumulativeLevels: capped,
    globalMaxLevel: HERO_JOURNEY_MAX_LEVEL,
    unlockedCount: unlockedList.length,
    currentMilestone: current,
    nextMilestone: next,
    progressPercent,
    overallPercent: (capped / HERO_JOURNEY_MAX_LEVEL) * 100,
    townHallLevel: player.townHallLevel,
    thCap,
    sections,
    oreChest,
  };
}