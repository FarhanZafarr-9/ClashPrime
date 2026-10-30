import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableRipple from './PressableRipple';
import { Colors, Radius, Spacing, Typography } from '../theme';

/** Release notes for the in-app changelog sheet. Kept out of the Settings
 * screen so the data and its renderer do not sit in a 3000-line file. */

export const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: '7.2.0',
    date: 'October 30, 2026',
    items: [
      'Game data: updated the bundled database to 0.19.1, including Portal Pendant and the latest building costs, upgrade times and balance changes.',
      'Expandable sections: Home, Settings, Time to Max and War member lists now slide and fade open and closed, with reduced-motion support.',
      'Rows: expanded headers smoothly transition their colors and corners; icon chips and neutral badges invert with the surface and remain readable in both themes.',
      'Settings: switches now have a highlighted track and checkmark/cross thumb icons; Clash Font and Base Sources use compact left/right option selectors.',
      'War: cleaner member rows place the defense shield after the attack dots, with attacks used and stars earned shown after TH when attacks have been used.',
      'War: perfect-attack dots and perfect-defense shields now adapt to the theme, with matching legend colors.',
      'War: the Current / History switch scrolls with the content, the Legend card has a dashed border, and the Attack Plan header ripple fills the card width.',
      'Share previews: removed card, preview-image and Close-button outlines for a cleaner appearance.',
      'Home: removed the profile-card border from the loading skeleton.',
      'Headers: one shared header button across every screen, so the square action buttons no longer differ in background, radius and border from screen to screen.',
      'Headers: all top buttons now share the bgCardHover surface with a dashed border, and carry an accessibility label so screen readers announce them.',
      'Layout: screens no longer shift down on first open - the top inset is read from the status bar synchronously instead of arriving after the first paint.',
      'Layout: the loading skeletons use that same inset, so a skeleton no longer slides down once its data lands.',
      'Tab bar: the loading bar now matches the real one - same chevron widths, same highlighted active tab, and the page dots stay in place.',
      'Import: the export is now paste-only. The box reads as an empty drop zone, and a paste is validated on arrival - anything that is not a Clash export is discarded instead of waiting to fail.',
      'Import: a valid paste reports what was found (building types and tag) rather than dumping raw JSON on screen.',
      'Import: Refresh now sits beside Apply and pulls live troops, heroes and spells, while building levels still come only from the pasted export.',
      'Import: nothing to apply now shows an up-to-date panel instead of a summary that says zero, and the Apply button reads Nothing to apply.',
      'Import: crafted defenses are listed as ordinary rows, and only appear when they actually change something.',
      'Import: builder huts read off a pasted export are acknowledged, prefilled and verified - previously an import saved the default of 2.',
      'War: opens from its last known data and refreshes in the background, instead of holding the skeleton through a full API round trip.',
      'War: the Current / History tabs now use the same segmented switch as the rest of the app, and the stats table has a dashed frame.',
      'Hero Journey: replaces the deprecated InteractionManager with an idle callback using a short timeout, avoiding the old five-second skeleton delay.',
      'Settings: the token and tag sheets have subtitles, account rows are padded, and the Close button matches the Add button height.',
      'Settings: fixed the builder count ranges, which were rendering as 1"3 and 2"6, the sheet breadcrumbs showing as apostrophes, and the API token prefix losing its Clash font.',
      'Settings: row descriptions now sit on the type scale with a taller line height and less dimmed opacity.',
      'Keyboard: bottom sheets now lift on Android, where the keyboard was previously ignored.',
      'Dialogs: every sheet in the app carries an icon and a subtitle.',
      'Army: the short column keywords in the stats sheet keep their font in the Clash titles preference.',
    ],
  },
  {
    version: '7.0.0',
    date: 'October 17, 2026',
    items: [
      'Buildings: grouped building-copy cards in the detail sheet now sit on a distinct bgCardHover surface, with a tighter gap between copies.',
      'Army: hero equipment max levels are now gated by the Town Hall Blacksmith level instead of inferred from owned equipment, fixing the stale Equipment chip count.',
      'Army: locked siege machines and pets now appear in the Locked list; owned-name matching is punctuation-insensitive so L.A.S.S.I. is recognized.',
      'Army: army item icons resolve punctuated package names (L.A.S.S.I.) so the pet and equipment art actually shows.',
      'Army: the detail sheet no longer reports owned pets as "Not yet unlocked".',
      'Army: unlock-requirement blocks are hidden for items the player already owns.',
      'Army: horizontal stat tables use dashed borders and dashed interior rules at 1px, matching the Buildings tables.',
      'Army: the Rush to TH+1 tables now use a 2:1:1:1.25 dashed grid with the Building/Pet House/Town Hall columns aligned.',
      'Home: a Siege category was added to the Laboratory pipeline, alongside Troops and Spells.',
      'Home: pets are now counted in unlockable/locked items and in the Laboratory/pet progress, fixing locked pets and the blank Pets pipeline time.',
      'Home: the Locked and Rushed backlog headers now report Build / Lab / Pet House time buckets instead of one undifferentiated total.',
      'Home: locked items show the gating building cost and time rather than research time they cannot start.',
      'Home: the Builders split line shows "Optimal" and the optimal makespan moved into the progress row.',
      'Home: the chevron in Progress Achieved level-up rows now has breathing room.',
      'Home: Progress Achieved calls out a Town Hall jump in its own banner, with the real Town Hall art.',
      'Home: no longer sticks on the loading skeleton after a JSON import — the cached player is now loaded into the app.',
      'Home: collapsible section headers invert to a negative card (bgCardHover fill) when expanded, with knocked-out icon and badge.',
      'Home: Building copy cards in the detail sheet use bgCardHover and a tighter gap.',
      'Settings: all groups start collapsed by default; the section badge rounds with the card and inverts with it.',
      'Settings: you can now sign out of your last account, which erases its cached player data, token, saved bases, favourites and progress from this device.',
      'Settings: Developer Info redesigned with circular icon chips and roomier spacing.',
      'Settings: fixed broken characters across section descriptions and the API token mask.',
      'Settings: Build Diagnostics no longer crashes on values Expo hands over as objects.',
      'Time to Max: pipeline badges read the row surface and round with the card; Rush tables use dashed borders.',
      'Time to Max: the pets pipeline now renders with real numbers and locked pets/siege are included.',
      'Time to Max: the Equipment subtitle no longer reads 0/N maxed before opening the tab.',
      'Tabs: page order now matches the tab bar carousel, and the hidden maxtime/bases/war/saved/settings screens are reachable again.',
      'Tabs: the search pseudo-entry became a real Player tab, so it keeps the floating bar.',
      'Tabs: every root page scroll disables the Android overscroll glow.',
      'Share icon on the home screen changed to an images icon.',
    ],
  },
  {
    version: '6.5.0',
    date: 'October 9, 2026',
    items: [
      'Every settings dialog now opens as a bottom sheet — the player tag / API token edit sheet, the About / What\u2019s New / Privacy / Credits / Feedback / Developer content sheets, the account switcher, the discount modal and the onboarding modal all slide up with their title, subtitle and icon in the sheet header.',
      'New Show Global Levels toggle under Settings \u2192 Appearance: Buildings and Army level tables expand to the game\u2019s full global max instead of stopping at your Town Hall. Display-only \u2014 progress, maxed badges and Remaining totals still count against your Town Hall.',
      'Onboarding polished: every step shows loading art while work is in flight, the API token field is masked, the builder-hut picker lays out two per row, and the Town Hall picker\u2019s Next button stays visible (disabled until you pick).',
      'The Home / Builder Base switch is now one shared component across Army, Buildings, Time to Max and Bases.',
      'Base cards simplified: the Apply Layout button now sits between a share-card image icon and a share icon, the bookmark replaces the duplicate heart (favoriting stays in the Saved tab), and tag chips hide whatever just restates the card\u2019s own category.',
      'Army cards match: the heart gives way to a single bookmark, and the share-card image and share icons now flank the Copy Army button (favoriting stays in the Saved tab).',
      'Onboarding ends on a Data & Credits slide listing every public source the app draws from (with tappable links and the Supercell notice) before entering the app.',
      'Packed package art capped at 128px WebP — roughly 85% smaller install footprint with no visible quality loss.',
    ],
  },
  {
    version: '6.3.0',
    date: 'October 8, 2026',
    items: [
      'Base Library now merges ClashLy with the clash-bases catalogue for Home Village layouts — every card gets a real base name, description, builder credit and tags where the catalogue has them, new Progress and Fun category pills surface layout styles ClashLy never tagged, and duplicates across the two sources are collapsed by their official in-game layout link. Builder Base stays on ClashLy.',
      'A Both / ClashLy / Clash Bases source switch sits beside the village selector (Home Village only), so either catalogue can be browsed on its own instead of being buried under the other\u2019s volume.',
    ],
  },
  {
    version: '6.2.0',
    date: 'September 29, 2026',
    items: [
      'Share cards: Home progress, Time to Max, base layouts and community armies each render a high-res PNG through one shared preview sheet — capture, save or share from the card in any of those tabs.',
      'Bases and Armies now paint from their on-device snapshot the moment you open the tab, then quietly refresh behind it: the stored data is trusted for three days, and is refetched early if it is older than that or holds fewer items than the list you have scrolled to. No more skeleton wait on every revisit, and the refresh button still forces a fresh pull.',
      'Base layout thumbnails no longer shimmer forever when a stored image url is dead or missing — the placeholder clears on failure and the card falls back to its TH/BH label.',
      'Filter pills rebuilt as one seamless 3-up block across Bases, Armies, Hero Journey and Awards — real leading art per filter, a count subtitle under the label, and large rounding only on the outer corners of the grid.',
      'Hero Journey: the flag and summary now mark the next milestone you can actually claim instead of the last one already collected (at 100 cumulative levels that is Lv101, not Lv99), the All pill uses the Hero\'s Journey mark, and each section header shows its hero portrait centred — dimmed with a lock badge when you do not own that hero.',
      'Hero Journey filter pills lead with real rewards: the chest for quests, the Fireball for equipment, and the matching Majestic skin for skins.',
      'Awards: village filters are the same pill grid, leading with your Town Hall and Builder Hall art and a war-stars mark for All, each carrying an award count.',
      'Spell stat tables filled in from real package data — the placeholder Value column is gone and each spell fact sits in a pill row with its own glyph, no repeated housing space.',
      'War tab rebuilt with a war/CWL tab switcher, collapsible member sections and auto-refresh, plus the attack plan now shows during preparation and badges the target position.',
      'Buildings: Builder Base categories with Town Hall gating, and a redesigned category pill row with a village switch showing the Town Hall and Builder Hall art.',
      'Army: redesigned category chips and a tidied detail sheet, and unit, hero, spell, siege, pet and equipment icons on every army card.',
      'Home: the account switcher is now a seamless block, and rushed or locked troops and spells use their in-game base icons.',
      'Time to Max: added the Builder Base section alongside the four Home Village pipelines.',
      'Onboarding: new export guide step, chevron icons in place of arrows, and the flow extracted into its own modal component.',
      'Builder count is shared through a single store, so changing it anywhere keeps the Import pipeline, Time to Max and Home in sync.',
      'Switching accounts now re-fetches the player you land on instead of showing the previous account for a moment.',
      'Tab order tidied — Zapquaker and 6th Builder move to the third page, with Awards and Saved ahead of Settings.',
      'Clash display font now defaults to "All" so titles and body text use it out of the box.',
      'Under the hood: all troop, hero, spell, pet, equipment and building art resolved from clash-of-clans-data (the Fandom image URLs are gone), legacy building/Town Hall JSON tables and the obsolete image scrapers deleted, Builder Base league and Town Hall sprites generated, app icons regenerated at the right sizes, expo-notifications loaded lazily so the app also works outside Expo Go, and a lint pass across screens, components, hooks and utils.',
    ],
  },
  {
    version: '6.1.0',
    date: 'September 25, 2026',
    items: [
      'New Zapquaker tab: per-building Lightning + Earthquake combo calculator — pick target buildings from game data (Town Hall, Clan Castle and storages are excluded), tune spell levels and spell capacity, flip each spell On/Off, and enable Fireball (Warden) or Giant Arrow (Queen) equipment with their own level steppers. Combos show the cheapest kill by spell slots with spell-only and equipment-lean variants and overkill %.',
      'Zapquaker: double-damage rows against Air Defenses and a per-target level row, so each building shows what a Zap or Quake actually does to it at your spell level.',
      'New Giant Arrow tab: plan the Archer Queen skill on a base screenshot — tap and drag start/end pins, pick a path color from a collapsible swatch row, open a fullscreen viewer, and share the finished plan as a high-res PNG.',
      'Giant Arrow: Rocket Backpack (Dragon Duke) mode reuses the same canvas with a centre pivot, so the dash line always runs through the base center.',
      'Giant Arrow plans auto-save on this device and restore on next launch (screenshot, pins, color and arrow path).',
      'New 6th Builder (B.O.B.) tab: turns your profile into an ordered, resource-feasible schedule for all seven unlock requirements — requirement checklist, machine timeline, storage cascades and "what is blocking you" callouts.',
      'Buildings: Builder Base building categories with Town Hall gating.',
      'Hero Journey: reward captions, image badges and parent grouping so completed and upcoming Town Hall sections are clearly separated.',
      'Builder Base troops got their own generated sprites (no more shared Home Village art), and buildings/troops now resolve to the sprite for their own level.',
      'Android: edge-to-edge window with a permanently hidden status bar.',
      'Credits: data sources are now tappable with links; RoyaleAPI, Zapquaker and Otaku Planner are credited as reference sites for the new tools, with the Supercell fan-content notice.',
    ],
  },
  {
    version: '6.0.0',
    date: 'September 20, 2026',
    items: [
      'Import screen: Builder Base buildings in JSON exports are now tracked and timed against their own builders — a dedicated "Builder Base Builders" count (default 1, auto 2 at Builder Hall 6, max 3) drives them while Home Village upgrades keep using your builder count.',
      'Builder Base progress now flows into the rest of the app: Builder Base troops and heroes are tracked in Progress Achieved, the army list shows builder hero max levels and Builder Base items at their Builder Hall, and progress snapshots include them.',
      'Import screen: the builders pipeline summary is now a stack of rounded rows — a Builders header chip showing the combined time as the first row, one time row per village, and a compact 2-column resource grid using the in-game gold/elixir icons.',
      'Import screen: building levels apply per-copy — mixed-level copies import and upgrade independently, only copies that actually gain a level show up, and "Upgrading now" lists copies still mid-upgrade with time left plus a treat-as-done toggle (Lv +1).',
      'Import screen: one row per level variant with its own count, cost and time; applying to another attached account confirms first; re-pasting the same export drops copies the account already absorbed.',
      'Import screen: skipped/un-tracked buildings match the tracked Upgrade rows, the Town Hall row shows its actual TH-level image, and upgrade rows carry in-game resource icons.',
      'Settings: new "Builder Base Builders" control next to the incoming Builder Count, with inline +/- steppers.',
      'Settings: What\u2019s New dialog redesigned — a hero header with the latest version and release dates, and every release as a collapsible card with version chips, item counts and per-release expand/collapse.',
      'Home: account switcher dialog polished — name/tag aligned, bigger Add Account button with a link icon, active account highlighted by row instead of a chip; dialogs now span full-width with edge margins.',
      'Home: Progress Achieved dialog restyled — progress rows use each category\'s building pictograms, level-up rows show in-game item icons, and rows sit in a gap-spaced rounded layout.',
      'Army and Buildings detail panels open in a slide-up bottom sheet with a custom header — item icon, title, progress bar and level badge, plus a badge-styled close button.',
      'Locked heroes/units/spells open their detail sheet too: header shows a lock badge, stats tables start from the first levels, and sheets reset to the default level window whenever they close.',
      'Building detail sheets condense long level ranges with "..." in both the level grid and stats table, with a Show-all toggle.',
      'Home timers: edit a timer to restart its countdown; rows show start and end times and are sorted by end time.',
      'Home tab Heroes progress section now uses the Hero Hall building image.',
      'Time to Max: exclude any building you don\'t plan to max — all its copies are skipped from max-time estimates and TH readiness.',
      'Time to Max: new Town Hall upgrade card in the rush comparison shows next-TH build cost and time, and new-unlock rows show item type and count info with per-group corner rounding.',
      'Buildings: "Distributed" column shows how long remaining upgrades take using all your builders.',
      'New Hero Journey tab: the full rewards track from TH7 to TH18 — quests, ore, hero equipment, potions, books, runes and Majestic skins — shown as milestones grouped into collapsible Town Hall sections with claimed badges and lock icons.',
      'Hero Journey: equipment nodes grant the in-game piece for each hero pool in order, next piece is picked while it is already owned, a fully-owned pool pays 50 Starry Ore, and progress reflects your own Town Hall cap with a scroll-to-current-milestone shortcut.',
      'Majestic hero skins, runes and other magic items now render as full images in rewards.',
      'Floating tab bar: pageable tab groups with prev/next arrows when tabs overflow, plus a wider pagination chevron hit area.',
      'Polished skeleton rows on Home and Hero Journey aligned with the new layouts.',
      'Engine upgrade: Expo 57, React Native 0.86, eslint-config-expo 57.',
      'New in-app package images for added content and levels — Electro Fangs, Monolith Arrow and Revenge Deck hero equipment, Barbarian/Dragon L13, Golem L15, Yeti L8, Workshop 9, Log Launcher 6 and more — after upgrading to clash-of-clans-data 0.18.',
    ],
  },
  {
    version: '5.3.0',
    date: 'August 23, 2026',
    items: [
      'Critical-path TH readiness using computeMaxTime — bottleneck-driven score (Lab/Builders/Pets pipeline times) replaces weighted average, exposing hero/building bottlenecks correctly.',
      'Rush to TH+1 expandable comparison: remaining time, added time, total time per pipeline + new unlocks grid with icons and max-level badges.',
      'Lab expandable in readiness card with Troops/Spells/Sieges tier progress.',
      'Walls counted per-copy (not –250) in next-TH level counts; Army buildings prioritized in level unlocks grid.',
      'Max TH celebration screen; GitHub version checker in Home & Settings with ahead-of-release detection and one-tap release links.',
      'Buildings/Army max level images in Rush unlocks; troop/spell max-level badges on icons.',
      'Timer notifications rebuilt: Android-native per-second countdown (works with app killed, zero battery), progress-free pinned card, sound + vibration on finish, monochrome notification icon.',
      'Add Account button directly in the Home account switcher.',
      'Builder pipeline header shows buildings/heroes/optimal split time inline on Home tab.',
      'Builder split computes internally using player TH/progress details; uses builderCount from settings/onboarding.',
      'Max Time screen: dual Gold/Elixir icons for Gold or Elixir resources (hero resource grid and resource summary).',
      'Max Time screen: hero resource icons resized (32’24px), Gold/Elixir separator changed from "+" to "/", improved padding and spacing.',
      'Builder split label shortened: "Buildings" ’ "Build", "Heroes" ’ "Hero", "Optimal" ’ "Opt" for compact readability.',
      'Auto-refresh player data once per day per account on app start.',
      'Onboarding flow redesign: TH picker now select-then-confirm with Next button; added Builder Hut picker step between TH and builder count; builder count step integrated; fixed navigation/back flow between steps.',
      'Settings: builder count inline +/- controls (removed modal), reactive chip selection with proper dialog dismissal.',
      'Settings screen: fixed indentation and spacing inconsistencies.',
    ],
  },
  {
    version: '5.0.0',
    date: 'August 17, 2026',
    items: [
      'Complete data migration to clash-of-clans-data npm package — all building images, troop/hero/spell/pet/equipment/siege machine data, levels, costs, stats, and TH/BH max levels now come from canonical Supercell data.',
      'Removed ~1000 local .webp building images and 1200 lines of auto-generated asset mapping — app size reduced from 535 MB to ~40 MB archive.',
      'New Time to Max screen — estimate remaining upgrade time for Laboratory, Builders, Pet House and Equipment pipelines, with per-resource cost breakdowns and adjustable builder counts.',
      'Optional Clash display font with Off / Titles / All preference under Settings ’ Appearance.',
      'Building stats, copy counts, max levels, upgrade costs now use package data via buildingData.ts/armyData.ts — no more Fandom scraping or local JSON fallbacks.',
      'Troop/hero/spell/pet/equipment detail panels use package data (armyData.ts) — no more Fandom wiki scraping, instant load, per-resource cost breakdown.',
      'New Import Building Levels screen (Settings ’ Import) — paste a Clash of Clans JSON export to bulk-set all building levels and copies.',
      'Tab bar rework: Time to Max promoted to main tabs, War moved to the More menu, and a refreshed floating bar.',
      'Home tab timers: custom durations like 1d 2h 30m, an Add Timer row inside the active list, and focus-styled inputs in the New Timer modal.',
      'Resource and ore icons now shipped in-app and shown on Home, Army, Buildings and Time to Max rows.',
      'Generator scripts: npm run gen:images (WebP images with correct extension), npm run gen:coc-ids (building ID mapping).',
      'League loot/bonus/ore info from package (leagueData.ts).',
      'Account management improvements: ensureAccountRegistered, cachePlayer, mergeBuildingCopies, applyLevelsToAccount.',
    ],
  },
  {
    version: '4.5.0',
    date: 'August 11, 2026',
    items: [
      'War tab: enemy member list with the same grouped rows and colors, a heuristic Attack Plan card — your mirror plus the top targets with expected stars, cleanup estimates and Best/Mirror/Cleanup/Risky tags — and a collapsible legend for the attack and defense colors.',
      'Home tab: Progress Overview, Buildings and Backlog now nest into collapsible sections with progress bars, so the whole village fits on one screen.',
      'Buildings tab: bulk Max out all buildings action with a confirmation summary of every category affected.',
      'Home polish: quick actions as compact setting rows, softer borderless profile card, and rounded corners that now match across section headers, badges and icons.',
    ],
  },
  {
    version: '4.3.0',
    date: 'August 9, 2026',
    items: [
      'Buildings tab tracks every copy of multi-copy buildings individually — Cannons, Archer Towers, Walls, Traps and more are grouped into collapsible sections with a per-building progress bar, aggregate remaining cost/time and level badges.',
      'Quick upgrade/downgrade controls on each building card: tap – to upgrade, hold – to max out, tap – to downgrade — no need to expand the card.',
      'Building copy counts come straight from the Clash of Clans wiki (per-TH and per-BH), so new copies unlocked at higher Town Halls seed correctly at level 1.',
    ],
  },
  {
    version: '4.2.0',
    date: 'August 7, 2026',
    items: [
      'Player inspect screen — search any player by tag to view their stats, army, achievements and clan, copy their tag, add them to your accounts or open their profile in-game.',
      'Home screen rebuilt into collapsible sections: Progress Overview, a Backlog of locked and rushed upgrades, Quick Stats and Active Timers.',
      'Builder timers scoped per account, with an improved active-timers section and a redesigned new-timer modal.',
      'Achievements rows and summary restyled to match the settings rows, grouped by stars with corner rounding.',
      'Highlight your own member in war and CWL member lists, plus polished expanded war detail sections.',
      'Supercell Store deep-link banner on the Events tab.',
      'Home tab polish: header open-in-game button, rounded icon and badge corners, smarter empty-timers banner.',
      'Home skeleton loading reworked for the new collapsible layout, and shared SettingRow component powering Home, Player, Achievements and Settings.',
    ],
  },
  {
    version: '4.1.0',
    date: 'August 5, 2026',
    items: [
      'Live Clan War League rounds on the War tab — follow each round, its result and expandable per-member breakdowns.',
      'War tab list redesign: grouped member rows with attack dots and defense shields, rounded list corners and tighter spacing.',
      'Onboarding Town Hall picker rebuilt as an image gallery with a current-TH badge.',
      'Add Account (Full Setup) walks you through connecting a new village from Settings.',
      'Saved armies now render as full cards with share actions.',
      'Building and army discounts moved into Settings with clearer scopes.',
      'New What\u2019s New and Developer Info sections in Settings.',
    ],
  },
  {
    version: '4.0.0',
    date: 'August 1, 2026',
    items: [
      'Floating rounded bottom navigation with a More menu for the full tab set.',
      'Progress rebuilt as a weighted average with locked items shown at their next available level.',
      'Pinned countdown timers with system notifications.',
      'War tab enriched with per-member attack details and an expanded result table.',
      'Multi-account polish: smooth account-switch fade, building downgrade support and Town Hall input during onboarding.',
      'Settings redesigned into grouped cards with separated rows.',
    ],
  },
  {
    version: '3.0.0',
    date: 'July 27, 2026',
    items: [
      'Multi-account support: account registry, one-tap switching and per-account storage.',
      'Account switcher with list, add and remove directly on the Home tab.',
      'Settings refactored around the new account system with name backfill for existing players.',
    ],
  },
  {
    version: '2.0.0',
    date: 'July 23, 2026',
    items: [
      'Dynamic light/dark theme engine — switch instantly, every screen follows.',
      'Animated skeleton loading screens for Home, Profile, Bases and Events.',
      'Fandom Wiki as the primary troop, hero and pet detail source with inline detail panels.',
      'Building level data scraper and stat tables inside expanded building cards.',
      'Home quick-stats table with Town Hall avatar, plus Privacy Policy and Feedback dialogs.',
      'EAS build profiles for side-by-side dev and production installs.',
    ],
  },
  {
    version: '1.0.0',
    date: 'July 19, 2026',
    items: [
      'ClashPrime launch — the full Clash of Clans companion app.',
      'Home dashboard with progress cards, quick actions and quick stats.',
      'Army tab with troops, heroes, spells and pet details.',
      'Buildings tab covering 80+ structures with level progression.',
      'Base library powered by ClashLy and in-game events with countdowns.',
      'Credits and data sources documented in-app.',
    ],
  },
];

const TOTAL_RELEASES = CHANGELOG.length;
const TOTAL_CHANGES = CHANGELOG.reduce((sum, e) => sum + e.items.length, 0);

export interface ChangelogBodyProps {
  expanded: Record<string, boolean>;
  onToggle: (version: string) => void;
}

function ChangelogBody({ expanded, onToggle }: ChangelogBodyProps) {
  return (
    <View>
      <View style={styles.changelogHero}>
        <View style={styles.changelogHeroRow}>
          <Text style={styles.changelogHeroVersion}>v{CHANGELOG[0].version}</Text>
          <View style={styles.changelogLatestBadge}>
            <Ionicons name="sparkles" size={11} color={Colors.warning} />
            <Text style={styles.changelogLatestText}>Latest</Text>
          </View>
        </View>
        <Text style={styles.changelogHeroDate}>{CHANGELOG[0].date}</Text>
        <Text style={styles.changelogHeroStats}>
          {TOTAL_RELEASES} {TOTAL_RELEASES === 1 ? 'release' : 'releases'} · {TOTAL_CHANGES} {TOTAL_CHANGES === 1 ? 'change' : 'changes'}
        </Text>
      </View>

      {CHANGELOG.map((entry, entryIndex) => {
        const isLatest = entryIndex === 0;
        const isExpanded = expanded[entry.version] ?? false;
        const isLast = entryIndex === CHANGELOG.length - 1;
        return (
          <View key={entry.version} style={
            [styles.changelogSection,
            isLatest && { borderTopLeftRadius: Radius.xl * 1.25, borderTopRightRadius: Radius.xl * 1.25 },
            isLast && { borderBottomLeftRadius: Radius.xl * 1.25, borderBottomRightRadius: Radius.xl * 1.25 }]}>
            <PressableRipple
              style={styles.changelogSectionHeader}
              onPress={() => onToggle(entry.version)}
            >
              <View style={[styles.changelogSectionChip, isLatest && styles.changelogSectionChipLatest]}>
                {isLatest ? <Ionicons name="sparkles" size={11} color={Colors.warning} /> : null}
                <Text style={[styles.changelogSectionVersion, isLatest && styles.changelogSectionVersionLatest]}>
                  v{entry.version}
                </Text>
              </View>
              <Text style={styles.changelogSectionDate} numberOfLines={1}>{entry.date}</Text>
              <View style={styles.changelogSectionRight}>
                <View style={styles.changelogItemCount}>
                  <Text style={styles.changelogItemCountText}>{entry.items.length}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                  size={16}
                  color={Colors.textMuted}
                />
              </View>
            </PressableRipple>
            {isExpanded && (
              <View style={styles.changelogItems}>
                {entry.items.map((item) => (
                  <View style={styles.changelogItem} key={item}>
                    <View style={[styles.changelogDot, isLatest && styles.changelogDotLatest]} />
                    <Text style={styles.changelogItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  changelogHero: {
    paddingBottom: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.base,
  },
  changelogHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  changelogHeroVersion: {
    ...Typography.title2,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  changelogHeroDate: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  changelogHeroStats: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  changelogSection: {
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  changelogSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  changelogSectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  changelogSectionChipLatest: {
    backgroundColor: `${Colors.warning}22`,
    borderColor: `${Colors.warning}40`,
  },
  changelogSectionVersion: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  changelogSectionVersionLatest: {
    color: Colors.warning,
  },
  changelogSectionDate: {
    ...Typography.caption,
    color: Colors.textMuted,
    flex: 1,
  },
  changelogSectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  changelogItemCount: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changelogItemCountText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  changelogLatestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: `${Colors.warning}1f`,
  },
  changelogLatestText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  changelogItems: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    paddingTop: Spacing.xs,
    gap: 6,
  },
  changelogItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  changelogDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accent,
    marginTop: 9,
  },
  changelogDotLatest: {
    backgroundColor: Colors.warning,
  },
  changelogItemText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});

export default ChangelogBody;
