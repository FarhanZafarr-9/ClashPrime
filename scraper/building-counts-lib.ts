/**
 * Building count extraction from Clash of Clans Fandom wiki.
 *
 * The wiki encodes how many copies of a building are available at each Town
 * Hall / Builder Hall level via templates:
 *   {{NumberAvailable||TH1=1||TH2=2||TH9=7}}            (Home Village)
 *   {{BuilderBaseNumberAvailable|BH1=1|BH3=2|BH7=3}}    (Builder Base)
 *
 * Only "change points" are listed (e.g. TH9=7 means the count becomes 7 at TH9
 * and stays there until the next listed TH). Some templates carry extra params
 * (width/tablestyle/UseStages) and merged-building notations (TH16=7/3*),
 * which are skipped — the leading integer is the count.
 */

export const ALL_BUILDINGS: Record<string, string> = {
  // Defenses
  'Cannon': 'Cannon/Home_Village',
  'Archer Tower': 'Archer_Tower/Home_Village',
  'Mortar': 'Mortar',
  'Air Defense': 'Air_Defense/Home_Village',
  'Wizard Tower': 'Wizard_Tower',
  'Air Sweeper': 'Air_Sweeper',
  'Hidden Tesla': 'Hidden_Tesla/Home_Village',
  'Bomb Tower': 'Bomb_Tower/Home_Village',
  'X-Bow': 'X-Bow/Home_Village',
  'Inferno Tower': 'Inferno_Tower/Home_Village',
  'Eagle Artillery': 'Eagle_Artillery',
  'Scattershot': 'Scattershot',
  "Builder's Hut": "Builder's_Hut",
  'Spell Tower': 'Spell_Tower',
  'Monolith': 'Monolith',
  'Multi-Archer Tower': 'Multi-Archer_Tower',
  'Ricochet Cannon': 'Ricochet_Cannon',
  'Multi-Gear Tower': 'Multi-Gear_Tower',
  'Firespitter': 'Firespitter',
  'Revenge Tower': 'Revenge_Tower',
  'Super Wizard Tower': 'Super_Wizard_Tower/Home_Village',
  'Wall': 'Wall/Home_Village',
  // Resources
  'Town Hall': 'Town_Hall',
  'Gold Mine': 'Gold_Mine/Home_Village',
  'Elixir Collector': 'Elixir_Collector/Home_Village',
  'Dark Elixir Drill': 'Dark_Elixir_Drill',
  'Gold Storage': 'Gold_Storage/Home_Village',
  'Elixir Storage': 'Elixir_Storage/Home_Village',
  'Dark Elixir Storage': 'Dark_Elixir_Storage',
  'Clan Castle': 'Clan_Castle',
  // Army
  'Army Camp': 'Army_Camp/Home_Village',
  'Barracks': 'Barracks',
  'Dark Barracks': 'Dark_Barracks',
  'Laboratory': 'Laboratory',
  'Spell Factory': 'Spell_Factory',
  'Hero Hall': 'Hero_Hall',
  'Dark Spell Factory': 'Dark_Spell_Factory',
  'Blacksmith': 'Blacksmith',
  'Workshop': 'Workshop',
  'Pet House': 'Pet_House',
  // Traps
  'Bomb': 'Bomb',
  'Spring Trap': 'Spring_Trap/Home_Village',
  'Giant Bomb': 'Giant_Bomb',
  'Air Bomb': 'Air_Bomb',
  'Seeking Air Mine': 'Seeking_Air_Mine',
  'Skeleton Trap': 'Skeleton_Trap',
  'Tornado Trap': 'Tornado_Trap',
  'Giga Bomb': 'Giga_Bomb',
  // Builder Base - Defenses
  'BB Cannon': 'Cannon/Builder_Base',
  'Double Cannon': 'Double_Cannon',
  'BB Archer Tower': 'Archer_Tower/Builder_Base',
  'BB Hidden Tesla': 'Hidden_Tesla/Builder_Base',
  'Firecrackers': 'Firecrackers',
  'Crusher': 'Crusher/Builder_Base',
  'Guard Post': 'Guard_Post',
  'BB Air Bombs': 'Air_Bombs/Builder_Base',
  'Multi Mortar': 'Multi_Mortar/Builder_Base',
  "O.T.T.O's Outpost": "O.T.T.O's_Outpost",
  'BB Roaster': 'Roaster/Builder_Base',
  'Giant Cannon': 'Giant_Cannon/Builder_Base',
  'Mega Tesla': 'Mega_Tesla',
  'BB Lava Launcher': 'Lava_Launcher/Builder_Base',
  'BB X-Bow': 'X-Bow/Builder_Base',
  'BB Walls': 'Wall/Builder_Base',
  // Builder Base - Traps
  'Push Trap': 'Push_Trap',
  'BB Spring Trap': 'Spring_Trap/Builder_Base',
  'Mine': 'Mine/Builder_Base',
  'Mega Mine': 'Mega_Mine/Builder_Base',
  // Builder Base - Resources
  'Builder Hall': 'Builder_Hall',
  'BB Gold Mine': 'Gold_Mine/Builder_Base',
  'BB Elixir Collector': 'Elixir_Collector/Builder_Base',
  'BB Gold Storage': 'Gold_Storage/Builder_Base',
  'BB Elixir Storage': 'Elixir_Storage/Builder_Base',
  'Gem Mine': 'Gem_Mine',
  // Builder Base - Army
  'Builder Barracks': 'Builder_Barracks',
  'BB Army Camp': 'Army_Camp/Builder_Base',
  'Star Laboratory': 'Star_Laboratory',
  'Battle Machine Altar': 'Battle_Machine_Altar',
  'Reinforcement Camp': 'Reinforcement_Camp',
  'Healing Hut': 'Healing_Hut',
  'Battle Copter Altar': 'Battle_Copter_Altar',
  // Builder Base - Other
  "B.O.T.O's Shack": "B.O.T.O's_Shack",
  'Clock Tower': 'Clock_Tower',
  'Elixir Cart': 'Elixir_Cart',
};

const NUMBER_AVAILABLE_RE = /\{\{\s*(?:BuilderBase)?NumberAvailable\s*\|([^}]*)\}\}/i;

/**
 * Parse the count-per-TH/BH change points out of a building's wikitext.
 * Returns a sparse map like { "1": 1, "2": 2, "9": 7 } (string keys) or null
 * when no count template is present (e.g. single-copy or fixed-count buildings).
 */
export function extractCounts(wikitext: string): Record<string, number> | null {
  const m = wikitext.match(NUMBER_AVAILABLE_RE);
  if (!m) return null;

  const counts: Record<string, number> = {};
  // Template params are pipe-separated; some entries have || (empty first param).
  const params = m[1].split('|');
  for (const param of params) {
    const match = param.match(/^\s*(TH|BH)(\d+)\s*=\s*(\d+)/i);
    if (!match) continue;
    const key = `${match[1].toUpperCase()}${parseInt(match[2], 10)}`;
    counts[key] = parseInt(match[3], 10);
  }
  return Object.keys(counts).length > 0 ? counts : null;
}
