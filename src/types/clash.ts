export type Village = 'home' | 'builderBase' | 'clanCapital';
export type PlayerRole = 'member' | 'admin' | 'coLeader' | 'leader';
export type WarPreference = 'in' | 'out';

export interface BadgeUrls {
  small: string;
  medium: string;
  large: string;
}

export interface IconUrls {
  small: string;
  medium?: string;
  large?: string;
}

export interface ClanSummary {
  tag: string;
  name: string;
  clanLevel: number;
  badgeUrls: BadgeUrls;
}

export interface LeagueTier {
  id: number;
  name: string;
  iconUrls: IconUrls;
}

export interface BuilderBaseLeague {
  id: number;
  name: string;
}

export interface SeasonRecord {
  id: string;
  rank: number;
  trophies: number;
}

export interface CurrentSeason {
  trophies: number;
}

export interface LegendStatistics {
  legendTrophies: number;
  previousSeason?: SeasonRecord;
  bestSeason?: SeasonRecord;
  currentSeason?: CurrentSeason;
  previousBuilderBaseSeason?: SeasonRecord;
  bestBuilderBaseSeason?: SeasonRecord;
}

export interface Achievement {
  name: string;
  stars: 0 | 1 | 2 | 3;
  value: number;
  target: number;
  info: string;
  completionInfo: string | null;
  village: Village;
}

export type PlayerHouseElementType = 'ground' | 'walls' | 'roof' | 'decoration';

export interface PlayerHouseElement {
  type: PlayerHouseElementType;
  id: number;
}

export interface PlayerHouse {
  elements: PlayerHouseElement[];
}

export interface Label {
  id: number;
  name: string;
  iconUrls: IconUrls;
}

export interface UnitProgress {
  name: string;
  level: number;
  maxLevel: number;
  village: 'home' | 'builderBase';
}

export type Troop = UnitProgress;
export type Spell = UnitProgress;

const SUPER_TROOP_NAMES = new Set([
  'Super Barbarian', 'Super Archer', 'Super Giant',
  'Sneaky Goblin', 'Super Wall Breaker', 'Rocket Balloon',
  'Super Wizard', 'Super Dragon', 'Inferno Dragon',
  'Super Miner', 'Super Yeti', 'Ice Hound', 'Super Minion',
  'Super Witch', 'Super Bowler', 'Super Valkyrie',
  'Super Hog Rider',
]);

export function isSuperTroop(name: string): boolean {
  if (SUPER_TROOP_NAMES.has(name)) return true;
  if (name.startsWith('Super ') || name.startsWith('Sneaky ') || name.startsWith('Rocket ')) return true;
  return false;
}

// --- War ---

export type WarState = 'notInWar' | 'inWar' | 'preparation' | 'warEnded';

export interface WarAttack {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order: number;
  duration: number;
}

export interface WarMember {
  tag: string;
  name: string;
  townhallLevel: number;
  mapPosition: number;
  attacks?: number;
  opponentAttacks?: number;
  bestOpponentAttack?: WarAttack;
}

export interface WarClanDetail {
  tag: string;
  name: string;
  badgeUrls: BadgeUrls;
  clanLevel: number;
  attacks: number;
  stars: number;
  destructionPercentage: number;
  members: WarMember[];
}

export interface ClanWar {
  state: WarState;
  teamSize: number;
  preparationStartTime: string;
  startTime: string;
  endTime: string;
  clan: WarClanDetail;
  opponent: WarClanDetail;
}

export interface WarLogClan {
  tag: string;
  name: string;
  badgeUrls: BadgeUrls;
  clanLevel: number;
  stars: number;
  destructionPercentage: number;
  attacks?: number;
  expEarned?: number;
}

export interface WarLogEntry {
  result: 'win' | 'lose' | 'draw';
  endTime: string;
  teamSize: number;
  attacksPerMember: number;
  battleModifier?: string;
  clan: WarLogClan;
  opponent: WarLogClan;
}

// --- End War ---

export function filterHomeTroops(troops: Troop[]): Troop[] {
  return troops.filter((t) => t.village === 'home' && !isSuperTroop(t.name));
}

export interface EquippedItem {
  name: string;
  level: number;
  maxLevel: number;
  village: 'home' | 'builderBase';
}

export interface Hero {
  name: string;
  level: number;
  maxLevel: number;
  village: 'home' | 'builderBase';
  equipment?: EquippedItem[];
}

export type HeroEquipment = EquippedItem;

export interface Pet {
  name: string;
  level: number;
  maxLevel: number;
  village: 'home' | 'builderBase';
}

export interface ClashPlayer {
  tag: string;
  name: string;
  townHallLevel: number;
  townHallWeaponLevel?: number;
  expLevel: number;
  trophies: number;
  bestTrophies: number;
  warStars: number;
  attackWins: number;
  defenseWins: number;
  donations: number;
  donationsReceived: number;
  clanCapitalContributions: number;
  builderHallLevel?: number;
  builderBaseTrophies?: number;
  bestBuilderBaseTrophies?: number;
  role?: PlayerRole;
  warPreference?: WarPreference;
  clan?: ClanSummary;
  leagueTier?: LeagueTier;
  builderBaseLeague?: BuilderBaseLeague;
  legendStatistics?: LegendStatistics;
  currentLeagueSeasonId?: number;
  previousLeagueGroupTag?: string;
  previousLeagueSeasonId?: number;
  achievements: Achievement[];
  playerHouse?: PlayerHouse;
  labels: Label[];
  troops: Troop[];
  heroes: Hero[];
  heroEquipment: HeroEquipment[];
  spells: Spell[];
  pets: Pet[];
}
