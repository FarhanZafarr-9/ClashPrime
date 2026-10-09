import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Platform,
  Image,
  ActivityIndicator,
  type ImageSourcePropType,
} from 'react-native';
import PressableRipple from '../../src/components/PressableRipple';
import { SettingRow } from '../../src/components/SettingRow';
import BottomSheet from '../../src/components/BottomSheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { openURL } from 'expo-linking';
import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { Colors, Typography, Spacing, Radius, useTheme, useClashFontPref, useGlobalLevels } from '../../src/theme';
import { Chip } from '../../src/components/Chip';
import { getTownHallImageSource } from '../../src/utils/buildingImages';
import { getMaxTownHall } from '../../src/utils/buildingData';
import { parseCocExport, cocExportToBuildingLevels, normalizeTag, CocImportResult } from '../../src/utils/cocExport';
import type { ClashPlayer } from '../../src/types/clash';
import { seedBuildingLevelsForTH } from '../../src/utils/seedBuildingLevels';
import { ClashAPI } from '../../src/api/clash';
import { checkForUpdate } from '../../src/utils/versionCheck';
import {
  getPlayerTag,
  setPlayerTag,
  getApiToken,
  setApiToken,
  clearAppCache,
  saveAccount,
  removeAccount,
  getAccounts,
  cachePlayer,
} from '../../src/hooks/usePlayer';
import { usePlayer, usePlayerActions } from '../../src/hooks/usePlayerContext';
import { useGameData } from '../../src/hooks/useGameData';
import { useDialog } from '../../src/components/AlertDialog';
import { useDiscounts } from '../../src/hooks/useDiscounts';
import type { ScopeDiscount } from '../../src/hooks/useDiscounts';
import { useBuilderCount } from '../../src/hooks/useBuilderCount';
import { useBuilderBaseCount } from '../../src/hooks/useBuilderBaseCount';
import DiscountModal from '../../src/components/DiscountModal';
import OnboardingModal from '../../src/components/OnboardingModal';
import Constants from 'expo-constants';
import { DATA_SOURCE_GROUPS, SUPERCELL_NOTICE } from '../../src/data/attribution';
import { Switch } from 'react-native-paper'
const heartImg = require('../../images/heart.png') as any;

/** Settings groups, collapsed the same way the Time to Max pipelines are. */
type SettingsSectionKey = 'account' | 'appearance' | 'discounts' | 'data' | 'app' | 'developer';

const SECTION_META: Record<SettingsSectionKey, { title: string; icon: string; desc: string }> = {
  account: { title: 'Account', icon: 'people-outline', desc: 'Player tag, API token & villages' },
  appearance: { title: 'Appearance', icon: 'color-palette-outline', desc: 'Theme & Clash font' },
  discounts: { title: 'Discounts', icon: 'pricetag-outline', desc: 'Building & army discounts' },
  data: { title: 'Data & Preferences', icon: 'construct-outline', desc: 'Cache, imports & builder counts' },
  app: { title: 'App Management', icon: 'settings-outline', desc: 'Updates, policies & credits' },
  developer: { title: 'Developer', icon: 'person-circle-outline', desc: 'Developer info & build diagnostics' },
};

/**
 * A settings group behind a collapsing header. Same contract as the Time to Max
 * pipeline rows: the header owns the group's top corners while open and its
 * bottom corners while closed, and the body's last row closes them again when
 * open, so one group always reads as a single rounded card.
 */
function SettingSection({
  meta,
  isOpen,
  onToggle,
  isFirst,
  isLast,
  badge,
  children,
}: {
  meta: { title: string; icon: string; desc: string };
  isOpen: boolean;
  onToggle: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SettingRow
        icon={meta.icon}
        title={meta.title}
        desc={meta.desc}
        compact
        isFirst={isFirst || isOpen}
        isLast={isLast && !isOpen}
        onPress={onToggle}
      >
        {badge != null && (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{badge}</Text>
          </View>
        )}
      </SettingRow>
      {isOpen && (
        <View style={styles.settingBody}>
          {children}
          {!isLast && <View style={styles.sectionSeparator} />}
        </View>
      )}
    </>
  );
}

interface ContentAction {
  label: string;
  onPress?: () => void;
  primary?: boolean;
}

const PRIVACY_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Overview',
    body: 'ClashPrime is an unofficial Clash of Clans companion app. This privacy policy explains what data the app handles and how it is used.',
  },
  {
    title: 'Data We Access',
    body: 'To show your village progress, the app stores the Clash of Clans player tag and API token you provide, along with cached player data. This information stays on your device and is only sent directly to the official Clash of Clans API to fetch your profile.',
  },
  {
    title: 'Third-Party Services',
    body: 'Player data is retrieved from the official Clash of Clans API using your token. Reference content such as base layouts, building/troop/hero/spell/pet/equipment data, events and community armies is fetched from public sources including ClashLy, Clash Bases, ClashArmies, clash.ninja and the clash-of-clans-data npm package (canonical Supercell data).',
  },
  {
    title: 'Local Storage',
    body: 'Your player tag, API token and downloaded content are stored locally on your device using AsyncStorage. We do not operate servers that collect, transmit or sell your personal information.',
  },
  {
    title: 'Your Control',
    body: 'You can update or remove your player tag and API token at any time in Settings, and clear the local cache from the Data section. Uninstalling the app removes all locally stored data.',
  },
  {
    title: 'Contact',
    body: 'Questions about this policy can be sent to farhanzafarr.9@gmail.com.',
  },
];

const FEEDBACK_EMAIL = 'farhanzafarr.9@gmail.com';

const CHANGELOG: { version: string; date: string; items: string[] }[] = [
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
      'Walls counted per-copy (not ×250) in next-TH level counts; Army buildings prioritized in level unlocks grid.',
      'Max TH celebration screen; GitHub version checker in Home & Settings with ahead-of-release detection and one-tap release links.',
      'Buildings/Army max level images in Rush unlocks; troop/spell max-level badges on icons.',
      'Timer notifications rebuilt: Android-native per-second countdown (works with app killed, zero battery), progress-free pinned card, sound + vibration on finish, monochrome notification icon.',
      'Add Account button directly in the Home account switcher.',
      'Builder pipeline header shows buildings/heroes/optimal split time inline on Home tab.',
      'Builder split computes internally using player TH/progress details; uses builderCount from settings/onboarding.',
      'Max Time screen: dual Gold/Elixir icons for Gold or Elixir resources (hero resource grid and resource summary).',
      'Max Time screen: hero resource icons resized (32→24px), Gold/Elixir separator changed from "+" to "/", improved padding and spacing.',
      'Builder split label shortened: "Buildings" → "Build", "Heroes" → "Hero", "Optimal" → "Opt" for compact readability.',
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
      'Optional Clash display font with Off / Titles / All preference under Settings → Appearance.',
      'Building stats, copy counts, max levels, upgrade costs now use package data via buildingData.ts/armyData.ts — no more Fandom scraping or local JSON fallbacks.',
      'Troop/hero/spell/pet/equipment detail panels use package data (armyData.ts) — no more Fandom wiki scraping, instant load, per-resource cost breakdown.',
      'New Import Building Levels screen (Settings → Import) — paste a Clash of Clans JSON export to bulk-set all building levels and copies.',
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
      'Quick upgrade/downgrade controls on each building card: tap ▲ to upgrade, hold ▲ to max out, tap ▼ to downgrade — no need to expand the card.',
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

interface ChangelogBodyProps {
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

const DEVELOPER_PROJECTS: { name: string; blurb: string }[] = [
  { name: 'FlexPrime', blurb: 'Academic companion for FASTians — marks analytics, attendance risk, GPA tools and past papers, shipped to Google Play.' },
  { name: 'NotePrime', blurb: 'Material You fork of Note Safe — end-to-end encrypted, local-first notes with a privacy shield and biometric lock.' },
  { name: 'ClashPrime', blurb: 'This app — a premium Clash of Clans companion built in React Native + Expo.' },
  { name: 'Timers', blurb: 'Android multi-timer app with reliable notifications and zero bloat.' },
];

const DEV_AVATAR_URL = 'https://avatars.githubusercontent.com/u/94292576?v=4';
const GITHUB_PROFILE_URL = 'https://github.com/FarhanZafarr-9';
const CLASHPRIME_REPO_URL = 'https://github.com/FarhanZafarr-9/ClashPrime';

export default function SettingsScreen() {
  const router = useRouter();
  const appVersion = `v${(Constants.expoConfig as any)?.version ?? '6.0.0'}`;
  const { bumpTagVersion } = usePlayerActions();
  const { switchAccount, refreshAccounts, accounts, activeAccount, prefetchAccount, syncingTag, player } = usePlayer();
  const activeThImage = activeAccount && activeAccount.townHallLevel > 0
    ? getTownHallImageSource(activeAccount.townHallLevel)
    : null;
  const { show: showDialog, Dialog } = useDialog();
  const [playerTag, setPlayerTagState] = useState('');
  const [apiToken, setApiTokenState] = useState('');
  const { isDark, setThemeMode } = useTheme();
  const { pref: fontPref, setClashFontPref } = useClashFontPref();
  const { enabled: globalLevels, setShowGlobalLevels: setGlobalLevelsPref } = useGlobalLevels();
  const clashFontDesc = fontPref === 'off'
    ? 'Use the system font'
    : fontPref === 'titles'
      ? 'Clash font for headings'
      : 'Clash font everywhere';
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'tag' | 'token'>('tag');
  const [modalTitle, setModalTitle] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [modalPlaceholder, setModalPlaceholder] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalOnSave, setModalOnSave] = useState<(text: string) => void>(() => { });
  const modalInputRef = useRef<TextInput>(null);

  const [contentVisible, setContentVisible] = useState(false);
  const [contentTitle, setContentTitle] = useState('');
  const [contentSubtitle, setContentSubtitle] = useState('');
  const [contentIcon, setContentIcon] = useState<keyof typeof Ionicons.glyphMap | undefined>(undefined);
  const [contentIconSource, setContentIconSource] = useState<ImageSourcePropType | undefined>(undefined);
  const [contentBody, setContentBody] = useState<React.ReactNode>(null);
  const [contentIsChangelog, setContentIsChangelog] = useState(false);
  const [changelogExpanded, setChangelogExpanded] = useState<Record<string, boolean>>({});
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [contentActions, setContentActions] = useState<ContentAction[]>([]);

  const [showOnboarding, setShowOnboarding] = useState(false);
  // Groups start collapsed so the whole tab fits one screen; Account stays open
  // because the tag and token it holds are what everything else depends on.
  const [expanded, setExpanded] = useState<Record<SettingsSectionKey, boolean>>({
    account: true,
    appearance: false,
    discounts: false,
    data: false,
    app: false,
    developer: false,
  });
  const toggleSection = (key: SettingsSectionKey) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const [onboardingStep, setOnboardingStep] = useState<'tag' | 'import' | 'importToken' | 'profile' | 'builderCount' | 'thPicker'>('tag');
  const [onboardingTag, setOnboardingTag] = useState('');
  const [onboardingBuilderCount, setOnboardingBuilderCount] = useState(2);
  const [onboardingThLevel, setOnboardingThLevel] = useState('');
  const [onboardingPlayer, setOnboardingPlayer] = useState<ClashPlayer | null>(null);

  // Import flow state
  const [onboardingImportJson, setOnboardingImportJson] = useState('');
  const [onboardingImportResult, setOnboardingImportResult] = useState<CocImportResult | null>(null);
  const [onboardingImportTag, setOnboardingImportTag] = useState<string | null>(null);
  const [onboardingImportError, setOnboardingImportError] = useState<string | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [discountModalScope, setDiscountModalScope] = useState<'buildings' | 'army' | null>(null);
  const { refresh: refreshGameData } = useGameData();
  const {
    count: builderCount,
    setBuilderCount,
    verified: builderVerifiedCount,
    loaded: builderLoaded,
    isVerified: builderIsVerified,
    canDecrease: canDecreaseBuilders,
    canIncrease: canIncreaseBuilders,
    clearVerified: clearBuilderVerified,
  } = useBuilderCount();
  const { count: builderBaseCount, setBuilderBaseCount, loaded: bbBuilderLoaded } = useBuilderBaseCount(player?.builderHallLevel);
  const { discounts, setBuildingCost, setBuildingTime, setArmyCost, setArmyTime, resetDiscounts } = useDiscounts();

  const discountDesc = (s: ScopeDiscount) => {
    const parts: string[] = [];
    if (s.costPercent > 0) parts.push(`Cost -${s.costPercent}%`);
    if (s.timePercent > 0) parts.push(`Time -${s.timePercent}%`);
    return parts.length ? parts.join(' · ') : 'No discounts set';
  };

  const maskSecret = (value: string) => value ? '•'.repeat(Math.min(value.length, 24)) : '';

  const handleSwitchAccount = async (tag: string) => {
    if (tag === activeAccount?.tag) return;
    setSwitchingAccount(true);
    await switchAccount(tag);
    const t = await getPlayerTag(tag);
    setPlayerTagState(t);
    setSwitchingAccount(false);
  };

  useEffect(() => {
    getPlayerTag().then((tag) => {
      setPlayerTagState(tag);
      if (!tag) setShowOnboarding(true);
    });
    getApiToken().then((t) => {
      setApiTokenState(maskSecret(t));
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    checkForUpdate().then(({ hasUpdate, latestVersion: v }) => {
      if (mounted) {
        setUpdateAvailable(hasUpdate);
        setLatestVersion(v);
      }
    });
    return () => { mounted = false; };
  }, []);

  const openModal = (type: 'tag' | 'token', title: string, placeholder: string, current: string, onSave: (text: string) => void) => {
    setModalType(type);
    setModalTitle(title);
    setModalValue(current);
    setModalPlaceholder(placeholder);
    setModalError('');
    setModalOnSave(() => onSave);
    setModalVisible(true);
    setTimeout(() => modalInputRef.current?.focus(), 300);
  };

  const showContent = (
    title: string,
    body: React.ReactNode,
    actions: ContentAction[],
    subtitle?: string,
    icon?: keyof typeof Ionicons.glyphMap,
    iconSource?: ImageSourcePropType,
  ) => {
    setContentTitle(title);
    setContentSubtitle(subtitle ?? '');
    setContentIcon(icon);
    setContentIconSource(iconSource);
    setContentBody(body);
    setContentIsChangelog(false);
    setContentActions(actions.length ? actions : [{ label: 'Close' }]);
    setContentVisible(true);
  };

  const handleEditTag = () => {
    openModal('tag', 'Player Tag', '#PG8U2LR00', playerTag, async (text) => {
      const trimmed = text.trim();
      if (!trimmed) { setModalError('Tag cannot be empty'); return; }
      const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
      await setPlayerTag(prefixed);
      setPlayerTagState(prefixed);
      bumpTagVersion();
      setModalVisible(false);
    });
  };

  const handleEditToken = () => {
    openModal('token', 'API Token', 'Paste your API token', '', async (text) => {
      const trimmed = text.trim();
      if (!trimmed) { setModalError('Token cannot be empty'); return; }
      await setApiToken(trimmed);
      setApiTokenState(maskSecret(trimmed));
      bumpTagVersion();
      setModalVisible(false);
    });
  };

  const probeConnectivity = async (): Promise<boolean> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch('https://u.expo.dev/', { method: 'HEAD', signal: controller.signal });
      return res.status > 0;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const handleCheckUpdates = async () => {
    if (checkingUpdates) return;
    setCheckingUpdates(true);
    try {
      const online = await probeConnectivity();
      if (!online) {
        showDialog({
          title: 'No Internet Connection',
          subtitle: 'GitHub was unreachable',
          message: 'Could not reach GitHub to check for updates. Check your Wi-Fi or mobile data, then try again.',
          actions: [{ label: 'OK', primary: true, onPress: () => { } }],
        });
        return;
      }

      const { hasUpdate, latestVersion: v, currentVersion } = await checkForUpdate();
      if (hasUpdate) {
        showDialog({
          title: 'Update Available',
          subtitle: `v${v} is out — you're on v${currentVersion}`,
          message: `A new version of ClashPrime (v${v}) has been published — you are running v${currentVersion}. New builds are released as APKs on GitHub, so grab the latest one there to update.`,
          actions: [
            { label: 'Later', onPress: () => { } },
            { label: 'View on GitHub', primary: true, onPress: () => openURL('https://github.com/FarhanZafarr-9/ClashPrime/releases') },
          ],
        });
      } else if (v !== currentVersion) {
        showDialog({
          title: "You're Ahead of the Releases",
          subtitle: 'Running an unreleased development build',
          message: `Your build (v${currentVersion}) is newer than the latest published release (v${v}). This usually means you are running an unreleased development build — nothing to update.`,
          actions: [{ label: 'OK', primary: true, onPress: () => { } }],
        });
      } else {
        showDialog({
          title: "You're Up to Date",
          subtitle: `ClashPrime v${currentVersion} is the latest`,
          message: `ClashPrime v${currentVersion} matches the latest published release. Check back later for new versions.`,
          actions: [{ label: 'OK', primary: true, onPress: () => { } }],
        });
      }
    } catch {
      showDialog({
        title: 'Update Check Failed',
        subtitle: 'GitHub unreachable or rate-limited',
        message: 'Could not check for updates right now. This can happen if GitHub is rate-limiting or temporarily unavailable — please try again in a moment.',
        actions: [{ label: 'OK', primary: true, onPress: () => { } }],
      });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleClearCache = async () => {
    await clearAppCache();
    bumpTagVersion();
    showDialog({ title: 'Cache Cleared', message: 'Local cache has been cleared successfully.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
  };

  const handleOnboardingImportPaste = async () => {
    try {
      const raw = await getStringAsync();
      if (raw) {
        setOnboardingImportJson(raw);
        const parsed = parseCocExport(raw);
        if (!parsed.ok || !parsed.data) {
          setOnboardingImportError(parsed.error ?? 'Failed to parse export.');
          setOnboardingImportResult(null);
          setOnboardingImportTag(null);
          return;
        }
        setOnboardingImportError(null);
        setOnboardingImportResult(cocExportToBuildingLevels(parsed.data));
        setOnboardingImportTag(normalizeTag(parsed.data.tag) || null);
      } else {
        setOnboardingImportError('Clipboard is empty. Copy the export JSON first, then try again.');
      }
    } catch {
      setOnboardingImportError('Could not read the clipboard. Paste the JSON manually instead.');
    }
  };

  const handleOnboardingImportParse = (raw: string) => {
    const parsed = parseCocExport(raw);
    if (!parsed.ok || !parsed.data) {
      setOnboardingImportError(parsed.error ?? 'Failed to parse export.');
      setOnboardingImportResult(null);
      setOnboardingImportTag(null);
      return;
    }
    setOnboardingImportError(null);
    setOnboardingImportResult(cocExportToBuildingLevels(parsed.data));
    setOnboardingImportTag(normalizeTag(parsed.data.tag) || null);
  };

  const handleOnboardingImportContinue = () => {
    if (onboardingImportResult && onboardingImportTag) {
      setOnboardingStep('importToken');
    }
  };

  const handleOnboardingImportTokenSubmit = async (token:string) => {
    if (token.length < 20) {
      setModalError('Enter a valid API token from clashofclans.com');
      return;
    }
    if (!onboardingImportResult || !onboardingImportTag) return;

    setModalVisible(false);
    setShowOnboarding(true); // keep onboarding open for loading

    try {
      const api = new ClashAPI(token);
      const data = await api.getPlayer(onboardingImportTag!);

      const mergedPlayer: ClashPlayer = {
        ...data,
        buildingLevels: onboardingImportResult.levels,
        lastMaxedTH: data.townHallLevel || getMaxTownHall(),
      };

      await saveAccount({
        tag: onboardingImportTag!,
        name: data.name,
        townHallLevel: data.townHallLevel,
        addedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      });
      await setPlayerTag(onboardingImportTag!);
      await setApiToken(token);
      await cachePlayer(mergedPlayer, onboardingImportTag!);

      // Import provides all building levels; skip profile/TH/builder steps
      setShowOnboarding(false);
      setOnboardingStep('tag');
      setOnboardingImportJson('');
      setOnboardingImportResult(null);
      setOnboardingImportTag(null);
      setOnboardingImportError(null);
      setOnboardingPlayer(null);
      setOnboardingTag('');
      setOnboardingThLevel('');
      setOnboardingBuilderCount(2);

      // Refresh accounts and switch to the new one
      await refreshAccounts();
      await handleSwitchAccount(onboardingImportTag!);
    } catch (e: any) {
      showDialog({
        title: 'Sign-in Failed',
        message: e.message || 'Failed to connect. Check your token.',
        actions: [{ label: 'OK', primary: true, onPress: () => { } }],
      });
    }
  };

  const handleOnboardingSave = async () => {
    if (onboardingStep === 'tag') {
      const tag = onboardingTag;
      if (!tag || !tag.startsWith('#')) return;
      const existing = accounts.find((a) => a.tag === tag);
      if (existing) {
        showDialog({
          title: 'Account Already Added',
          message: `${tag} is already in your account list. Switch to it instead.`,
          actions: [
            { label: 'Cancel', onPress: () => { } },
            {
              label: 'Switch', primary: true, onPress: async () => {
                await handleSwitchAccount(existing.tag);
                setShowOnboarding(false);
                setOnboardingStep('tag');
              }
            },
          ],
        });
        return;
      }
      const token = await getApiToken();
      if (!token) {
        showDialog({ title: 'No API Token', message: 'You need to set up an API token first before adding accounts.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
        return;
      }
      try {
        const api = new ClashAPI(token);
        const data = await api.getPlayer(tag);
        setOnboardingPlayer(data);
        setOnboardingStep('profile');
      } catch (e: any) {
        showDialog({ title: 'Failed to Fetch Profile', message: e.message || 'Check your API token and player tag.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
      }
      return;
    }

    if (onboardingStep === 'profile') {
      // User confirmed profile, go to builder count
      setOnboardingStep('builderCount');
      return;
    }

    if (onboardingStep === 'builderCount') {
      // User set builder count, go to TH picker
      setOnboardingStep('thPicker');
      return;
    }

    if (onboardingStep === 'thPicker') {
      const tag = onboardingTag;
      const player = onboardingPlayer;
      if (!tag || !player) return;

      const token = await getApiToken();
      if (!token) return;

      const thLevel = parseInt(onboardingThLevel, 10);
      const currentTh = player.townHallLevel || getMaxTownHall();
      const levels = seedBuildingLevelsForTH(player, Number.isFinite(thLevel) && thLevel > 0 ? thLevel : currentTh, { currentTh });

      await setPlayerTag(tag);
      await setApiToken(token, tag);
      await saveAccount({
        tag,
        name: player.name,
        townHallLevel: player.townHallLevel,
        addedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      });
      const updatedPlayer = { ...player, buildingLevels: levels, lastMaxedTH: Number.isFinite(thLevel) && thLevel > 0 ? thLevel : currentTh };
      await cachePlayer(updatedPlayer, tag);
      await refreshAccounts();

      // Save builder count for this account. Awaited and in this order so the
      // chosen count lands before the import baseline is dropped; both read this
      // account's own stored values rather than the active account's.
      await setBuilderCount(onboardingBuilderCount, tag);
      await clearBuilderVerified(tag);

      setShowOnboarding(false);
      setOnboardingTag('');
      setOnboardingThLevel('');
      setOnboardingPlayer(null);
      setOnboardingStep('tag');

      await prefetchAccount(tag, { token, th: Number.isFinite(thLevel) && thLevel > 0 ? thLevel : currentTh, switch: true });
    }
  };

  const openAbout = () => {
    showContent(
      'About ClashPrime',
      (
        <View>
          {updateAvailable && (
            <View style={styles.aboutUpdateRow}>
              <Ionicons name="cloud-download-outline" size={14} color={Colors.warning} />
              <Text style={styles.updateBadgeText}>v{latestVersion} available</Text>
            </View>
          )}
          <Text style={styles.creditBlurb}>
            ClashPrime is an unofficial, community-built companion for Clash of Clans. It brings your village progress, war performance and favorite game references together in one clean, fast app — no ads, no clutter, just the data that matters.
          </Text>
          <Text style={styles.creditSectionTitle}>What it does</Text>
          {[
            { icon: 'trending-up-outline', title: 'Progress Tracking', body: 'Tracks every troop, spell, hero and building against your town hall, with a weighted max-out score so you always know what is next.' },
            { icon: 'timer-outline', title: 'Pinned Timers', body: 'Set countdowns for upgrades and boosts, with reminders delivered as system notifications.' },
            { icon: 'flag-outline', title: 'War Center', body: 'Follow the current war, per-member attacks and defenses, plus a searchable war history split into regular wars and CWL.' },
            { icon: 'git-network-outline', title: 'Base & Army Hub', body: 'Browse community base layouts, armies, super troops, pets and in-game events — all kept up to date.' },
            { icon: 'swap-horizontal-outline', title: 'Multi-Account', body: 'Switch between several villages with one tap. Each account keeps its own progress, cache and timers.' },
          ].map((f) => (
            <View style={styles.aboutFeatureRow} key={f.title}>
              <Ionicons name={f.icon as any} size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
              <View style={styles.creditSourceText}>
                <Text style={styles.creditSourceName}>{f.title}</Text>
                <Text style={styles.creditSourceUse}>{f.body}</Text>
              </View>
            </View>
          ))}
          {DATA_SOURCE_GROUPS.map((g) => (
            <View key={g.key}>
              <Text style={styles.creditSectionTitle}>{g.label}</Text>
              {g.sources.map((s) => (
                <View style={styles.creditSourceRow} key={s.name}>
                  <Ionicons name="link-outline" size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
                  <View style={styles.creditSourceText}>
                    <Text style={styles.creditSourceName}>{s.name}</Text>
                    <Text style={styles.creditSourceUse}>{s.use}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.policyTitle}>Disclaimer</Text>
          <Text style={styles.policyBody}>
            {"ClashPrime is an independent project and is not affiliated with or endorsed by Supercell. Supercell's trademarks and the Clash of Clans brand are used with permission where applicable."}
          </Text>
        </View>
      ),
      [
        { label: 'Credits', onPress: openCredits },
        { label: 'View on GitHub', primary: true, onPress: () => openURL('https://github.com/FarhanZafarr-9/ClashPrime') },
        { label: 'Close' },
      ],
      `v${appVersion} · Premium Clash of Clans companion`,
      'shield',
    );
  };

  const openCredits = () => {
    showContent(
      'Credits',
      (
        <View>
          <Text style={styles.creditBlurb}>
            ClashPrime is an unofficial Clash of Clans companion, built to give players a clean, fast way to track progress and discover bases.
          </Text>
          {DATA_SOURCE_GROUPS.map((g) => (
            <View key={g.key}>
              <Text style={styles.creditSectionTitle}>{g.label}</Text>
              {g.sources.map((s) => (
                <PressableRipple key={s.name} onPress={() => openURL(s.url)} style={styles.creditSourceRow} hitSlop={4}>
                  <Ionicons name="link-outline" size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
                  <View style={styles.creditSourceText}>
                    <Text style={styles.creditSourceName}>{s.name}</Text>
                    <Text style={styles.creditSourceUse}>{s.use}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={styles.creditSourceIcon} />
                </PressableRipple>
              ))}
            </View>
          ))}
          <Text style={styles.creditNotice}>{SUPERCELL_NOTICE}</Text>
          <View style={styles.creditMadeRow}>
            <Text style={styles.creditMadeText}>Made with </Text>
            <Image source={heartImg} style={styles.creditHeart} />
            <Text style={styles.creditMadeText}> by Parzival</Text>
          </View>
        </View>
      ),
      [
        {
          label: 'View on GitHub',
          primary: true,
          onPress: () => openURL('https://github.com/FarhanZafarr-9'),
        },
        { label: 'Close' },
      ],
      'Farhan Zafar · @FarhanZafarr-9',
      'logo-github',
    );
  };

  const openPrivacy = () => {
    showContent(
      'Privacy Policy',
      (
        <View>
          {PRIVACY_SECTIONS.map((s) => (
            <View style={styles.policyBlock} key={s.title}>
              <Text style={styles.policyTitle}>{s.title}</Text>
              <Text style={styles.policyBody}>{s.body}</Text>
            </View>
          ))}
        </View>
      ),
      [{ label: 'Close', primary: true }],
      'What ClashPrime collects and why',
      'shield-checkmark-outline',
    );
  };

  const openFeedback = () => {
    showContent(
      'Send Feedback',
      (
        <View>
          <Text style={styles.feedbackText}>
            {"We'd love to hear from you — bug reports, feature ideas, or just a hello."}
          </Text>
          <View style={styles.feedbackEmailRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />
            <Text style={styles.feedbackEmail}>{FEEDBACK_EMAIL}</Text>
          </View>
          <Text style={styles.feedbackNote}>
            {'Tap "Email Us" to open your mail app, or copy the address above.'}
          </Text>
        </View>
      ),
      [
        {
          label: 'Email Us',
          primary: true,
          onPress: () => openURL(`mailto:${FEEDBACK_EMAIL}`),
        },
        { label: 'Close' },
      ],
      'Bugs, feature ideas, or just a hello',
      'chatbubble-ellipses-outline',
    );
  };

  const openChangelog = () => {
    setChangelogExpanded({ [CHANGELOG[0].version]: true });
    showContent('What\u2019s New', null, [{ label: 'Close', primary: true }], 'Latest changes in ClashPrime', 'sparkles-outline');
    setContentIsChangelog(true);
  };

  const openDeveloper = () => {
    showContent(
      'Developer Info',
      (
        <View>
          <Text style={styles.devTagline}>
            every pixel intentional · every commit counts · every detail ships
          </Text>
          <Text style={styles.creditBlurb}>
            Mobile and full-stack developer, currently on a BS in Data Science at FAST-NUCES Lahore. I ship real apps — React Native, Flutter and full-stack web — and obsess over the details users actually feel.
          </Text>
          <Text style={styles.creditSectionTitle}>Featured projects</Text>
          {DEVELOPER_PROJECTS.map((p) => (
            <View style={styles.devProjectRow} key={p.name}>
              <Ionicons name="code-slash-outline" size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
              <View style={styles.creditSourceText}>
                <Text style={styles.creditSourceName}>{p.name}</Text>
                <Text style={styles.creditSourceUse}>{p.blurb}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.creditSectionTitle}>What I do</Text>
          {[
            { icon: 'phone-portrait-outline', title: 'Mobile Dev', body: 'React Native · Expo · Flutter' },
            { icon: 'globe-outline', title: 'Full Stack Web', body: 'React · Node.js · Express · SQL' },
            { icon: 'analytics-outline', title: 'Data Science', body: 'Python · PyTorch · scikit-learn · NumPy' },
          ].map((s) => (
            <View style={styles.aboutFeatureRow} key={s.title}>
              <Ionicons name={s.icon as any} size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
              <View style={styles.creditSourceText}>
                <Text style={styles.creditSourceName}>{s.title}</Text>
                <Text style={styles.creditSourceUse}>{s.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ),
      [
        {
          label: 'GitHub',
          onPress: () => openURL(GITHUB_PROFILE_URL),
        },
        {
          label: 'ClashPrime Repo',
          onPress: () => openURL(CLASHPRIME_REPO_URL),
        },
        { label: 'Close', primary: true },
      ],
      'Farhan Zafar · @FarhanZafarr-9',
      undefined,
      { uri: DEV_AVATAR_URL },
    );
  };

  const openBuildDiagnostics = () => {
    const expo = (Constants.expoConfig as any) ?? {};
    const extra = expo.extra ?? {};
    const easBuild = extra.eas?.build ?? {};
    const rows: { label: string; value: string }[] = [
      { label: 'App Version', value: expo.version ? `v${expo.version}` : '—' },
      { label: 'Build Number', value: String(easBuild.runNumber ?? Constants.nativeBuildVersion ?? '—') },
      { label: 'Expo SDK', value: expo.sdkVersion ?? '—' },
      { label: 'Environment', value: extra.variant ?? (__DEV__ ? 'development' : 'production') },
      { label: 'Git Commit', value: extra.commitHash ?? '—' },
      { label: 'Update URL', value: expo.updates?.url ?? '—' },
      { label: 'Platform', value: `${Platform.OS}${Platform.constants && (Platform.constants as any).Version ? ` ${(Platform.constants as any).Version}` : ''}` },
    ];
    showContent(
      'Build Diagnostics',
      (
        <View>
          <Text style={styles.feedbackText}>
            {'Technical build details for bug reports. Tap "Copy Info" to paste them into feedback.'}
          </Text>
          {rows.map((r) => (
            <View style={styles.devRow} key={r.label}>
              <Text style={styles.devRowLabel}>{r.label}</Text>
              <Text style={styles.devRowValue} numberOfLines={1}>{r.value}</Text>
            </View>
          ))}
        </View>
      ),
      [
        { label: 'Copy Info', primary: true, onPress: () => setStringAsync(rows.map((r) => `${r.label}: ${r.value}`).join('\n')) },
        { label: 'Close' },
      ],
      'Technical build details for bug reports',
      'code-slash-outline',
    );
  };

  return (
    <SafeAreaView style={styles.container} >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.settingSections}>
          <SettingSection
            meta={SECTION_META.account}
            isOpen={expanded.account}
            onToggle={() => toggleSection('account')}
            isFirst
            badge="5"
          >
            {accounts.length === 0 ? (
              <>
                <SettingRow
                  icon="person-outline"
                  title="Player Tag"
                  desc={playerTag || 'Not set'}
                  compact
                  onPress={handleEditTag}
                />
                <SettingRow
                  icon="key-outline"
                  title="API Token"
                  desc="Required for API access"
                  compact
                  pillText="Required"
                  pillTopOffset={18}
                  pillRightOffset={-4}
                  onPress={handleEditToken}
                >
                  <Text style={styles.settingValue} numberOfLines={1}>{apiToken}</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
                </SettingRow>
              </>
            ) : (
              <SettingRow
                icon={switchingAccount ? 'ellipsis-horizontal' : 'people-outline'}
                title={activeAccount?.name || 'Accounts'}
                desc={`${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'} · ${activeAccount?.tag || ''}`}
                compact
                onPress={() => setSwitchModalVisible(true)}
              >
                {switchingAccount ? (
                  <ActivityIndicator size="small" color={Colors.textSecondary} />
                ) : activeThImage ? (
                  <Image source={activeThImage} style={styles.settingThImage} resizeMode="contain" />
                ) : null}
                <Ionicons name="swap-horizontal" size={16} color={Colors.textMuted} style={{ marginLeft: 6 }} />
              </SettingRow>
            )}
            {accounts.length > 0 && (
              <SettingRow
                icon="key-outline"
                title="API Token"
                desc="Required for API access"
                compact
                pillText="Required"
                pillTopOffset={8}
                pillRightOffset={-10}
                onPress={handleEditToken}
              >
                <Text style={styles.settingValue} numberOfLines={1}>{apiToken}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
              </SettingRow>
            )}
            <SettingRow
              icon="add-circle-outline"
              title={accounts.length === 0 ? 'Connect Account' : 'Add Account'}
              desc="Connect a new player tag"
              compact
              onPress={() => {
                setOnboardingTag('');
                setOnboardingThLevel('');
                setShowOnboarding(true);
              }}
            />
            <SettingRow
              icon="sync-outline"
              title="Sync Now"
              desc="Pull fresh data from the API"
              compact
              onPress={() => {
                showDialog({
                  title: 'Sync Now',
                  message: 'Triggers an immediate sync of your player data from the Clash of Clans API. Use this if your stats seem outdated or after switching accounts.',
                  actions: [
                    { label: 'Cancel', onPress: () => { } },
                    { label: 'Sync', primary: true, onPress: () => { bumpTagVersion(); } },
                  ],
                });
              }}
            />
            <SettingRow
              icon="rocket-outline"
              title="Add Account (Full Setup)"
                desc="Walk through the full setup for a new account"
                compact
                isLast
                onPress={() => router.push('/onboarding?mode=add')}
            />
          </SettingSection>

          <SettingSection
            meta={SECTION_META.appearance}
            isOpen={expanded.appearance}
            onToggle={() => toggleSection('appearance')}
            badge="3"
          >
            <SettingRow
              icon="moon-outline"
              title="Dark Mode"
              desc="Switch between dark and light theme"
              compact
            >
              <Switch
                value={isDark}
                onValueChange={(v) => setThemeMode(v)}
                trackColor={{ false: Colors.border, true: Colors.textMuted }}
                thumbColor={isDark ? Colors.textPrimary : Colors.bgCard}
              />
            </SettingRow>
            <SettingRow
              icon="text-outline"
              title="Clash Font"
              desc={clashFontDesc}
              compact
            >
              <View style={styles.fontChipRow}>
                <Chip label="Off" selected={fontPref === 'off'} onPress={() => setClashFontPref('off')} />
                <Chip label="Titles" selected={fontPref === 'titles'} onPress={() => setClashFontPref('titles')} />
                <Chip label="All" selected={fontPref === 'all'} onPress={() => setClashFontPref('all')} />
              </View>
            </SettingRow>
            <SettingRow
              icon="globe-outline"
              title="Show Global Levels"
              desc="Show levels beyond your Town Hall"
              compact
              isLast
            >
              <Switch
                value={globalLevels}
                onValueChange={(v) => setGlobalLevelsPref(v)}
                trackColor={{ false: Colors.border, true: Colors.textMuted }}
                thumbColor={globalLevels ? Colors.textPrimary : Colors.bgCard}
              />
            </SettingRow>
          </SettingSection>

          <SettingSection
            meta={SECTION_META.discounts}
            isOpen={expanded.discounts}
            onToggle={() => toggleSection('discounts')}
            badge="2"
          >
            <SettingRow
              icon="business-outline"
              title="Building Discounts"
              desc={discountDesc(discounts.buildings)}
              compact
              onPress={() => setDiscountModalScope('buildings')}
            >
              <View style={styles.discountRowRight}>
                <View style={[styles.discountDot, discounts.buildings.costPercent > 0 || discounts.buildings.timePercent > 0 ? styles.discountDotActive : null]} />
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            </SettingRow>
            <SettingRow
              icon="shield-half-outline"
              title="Army Discounts"
              desc={discountDesc(discounts.army)}
              compact
              onPress={() => setDiscountModalScope('army')}
              isLast
            >
              <View style={styles.discountRowRight}>
                <View style={[styles.discountDot, discounts.army.costPercent > 0 || discounts.army.timePercent > 0 ? styles.discountDotActive : null]} />
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            </SettingRow>
          </SettingSection>

          <SettingSection
            meta={SECTION_META.data}
            isOpen={expanded.data}
            onToggle={() => toggleSection('data')}
            badge="5"
          >
            <SettingRow
              icon="trash-outline"
              title="Clear Cache"
              desc="Remove all locally cached data"
              compact
              destructive
              pillText="Destructive"
              pillTopOffset={18}
              pillRightOffset={-4}
              onPress={handleClearCache}
            />

            <SettingRow
              icon="cloud-upload-outline"
              title="Import Building Levels"
              desc="Paste a Clash of Clans JSON Export to bulk-set levels"
              compact
              onPress={() => router.push('/import-export')}
            />
            <SettingRow
              icon="hammer-outline"
              title="Builder Count"
              desc={!builderLoaded
                ? 'Loading your saved builder count…'
                : builderVerifiedCount !== null
                  ? `Number of builders · ${builderVerifiedCount} confirmed by import`
                  : 'Number of builders (2–6)'}
              compact
              onPress={() => { }}
            >
              <View style={styles.builderCountRow}>
                {builderIsVerified ? (
                  <View style={[styles.builderCountBtn, styles.builderCountBadgeBtn]}>
                    <Ionicons name="checkmark" size={16} color={Colors.success} />
                  </View>
                ) : null}
                <PressableRipple
                  style={[styles.builderCountBtn, !canDecreaseBuilders && styles.builderCountBtnDisabled]}
                  disabled={!canDecreaseBuilders}
                  onPress={() => setBuilderCount(builderCount - 1)}
                >
                  <Ionicons name="remove" size={18} color={canDecreaseBuilders ? Colors.textPrimary : Colors.textMuted} />
                </PressableRipple>
                <Text style={styles.builderCountValue}>{builderCount}</Text>
                <PressableRipple
                  style={[styles.builderCountBtn, !canIncreaseBuilders && styles.builderCountBtnDisabled]}
                  disabled={!canIncreaseBuilders}
                  onPress={() => setBuilderCount(builderCount + 1)}
                >
                  <Ionicons name="add" size={18} color={canIncreaseBuilders ? Colors.textPrimary : Colors.textMuted} />
                </PressableRipple>
              </View>
            </SettingRow>
            <SettingRow
              icon="construct-outline"
              title="Builder Base Builders"
              desc={!bbBuilderLoaded
                ? 'Loading your saved Builder Base count…'
                : `Builder Base builders (1–3)${(player?.builderHallLevel ?? 1) >= 6 ? ' · 2 granted at BH6' : ' · unlocks a 2nd at BH6'}`}
              compact
              onPress={() => { }}
            >
              <View style={styles.builderCountRow}>
                <PressableRipple
                  style={[styles.builderCountBtn, !bbBuilderLoaded && styles.builderCountBtnDisabled]}
                  disabled={!bbBuilderLoaded}
                  onPress={() => setBuilderBaseCount(Math.max(1, builderBaseCount - 1))}
                >
                  <Ionicons name="remove" size={18} color={bbBuilderLoaded ? Colors.textPrimary : Colors.textMuted} />
                </PressableRipple>
                <Text style={styles.builderCountValue}>{builderBaseCount}</Text>
                <PressableRipple
                  style={[styles.builderCountBtn, !bbBuilderLoaded && styles.builderCountBtnDisabled]}
                  disabled={!bbBuilderLoaded}
                  onPress={() => setBuilderBaseCount(Math.min(3, builderBaseCount + 1))}
                >
                  <Ionicons name="add" size={18} color={bbBuilderLoaded ? Colors.textPrimary : Colors.textMuted} />
                </PressableRipple>
              </View>
            </SettingRow>
            <SettingRow
              icon="refresh-outline"
              title="Refresh Game Data"
              desc="Reload the bundled game database"
              compact
              isLast
              onPress={() => {
                showDialog({
                  title: 'Refresh Game Data',
                  message: 'Reloads all game reference data (buildings, troops, heroes, spells, pets, siege machines, equipment, max levels, costs) from the clash-of-clans-data package bundled with the app. No web sources are used, so this is instant.',
                  actions: [
                    { label: 'Cancel', onPress: () => { } },
                    { label: 'Reload', primary: true, onPress: async () => { await refreshGameData(); } },
                  ],
                });
              }}
            />
          </SettingSection>

          <SettingSection
            meta={SECTION_META.app}
            isOpen={expanded.app}
            onToggle={() => toggleSection('app')}
            badge="6"
          >
            <SettingRow
              icon="cloud-outline"
              title="Check for Updates"
              desc={checkingUpdates ? 'Checking GitHub for the latest release…' : 'Compare your build against the latest GitHub release'}
              compact
              onPress={checkingUpdates ? undefined : handleCheckUpdates}
            >
              {checkingUpdates ? <ActivityIndicator size="small" color={Colors.textSecondary} /> : null}
            </SettingRow>
            <SettingRow
              icon="information-circle-outline"
              title="About ClashPrime"
              desc="What this app does, its features and sources"
              compact
              onPress={openAbout}
            >
              <Text style={styles.settingValue}>{appVersion}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </SettingRow>
            <SettingRow
              icon="sparkles-outline"
              title="What's New"
              desc="Recent updates and improvements"
              compact
              onPress={openChangelog}
            >
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </SettingRow>
            <SettingRow
              icon="document-text-outline"
              title="Privacy Policy"
              desc="How your data is handled"
              compact
              onPress={openPrivacy}
            />
            <SettingRow
              icon="heart-outline"
              title="Credits"
              desc="Made with love by Parzival"
              compact
              onPress={openCredits}
            />
            <SettingRow
              icon="chatbubble-outline"
              title="Send Feedback"
              desc="Report a bug or share an idea"
              compact
              onPress={openFeedback}
              isLast
            />
          </SettingSection>

          <SettingSection
            meta={SECTION_META.developer}
            isOpen={expanded.developer}
            onToggle={() => toggleSection('developer')}
            isLast
            badge="2"
          >
            <SettingRow
              icon="person-circle-outline"
              title="Developer Info"
              desc="About the developer behind ClashPrime"
              compact
              onPress={openDeveloper}
            >
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </SettingRow>
            <SettingRow
              icon="code-slash-outline"
              title="Build Diagnostics"
              desc="Technical build details for bug reports"
              compact
              onPress={openBuildDiagnostics}
              isLast
            >
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </SettingRow>
          </SettingSection>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ClashPrime {appVersion}</Text>
          <View style={styles.footerMadeRow}>
            <Text style={styles.footerSubtext}>Made with </Text>
            <Image source={heartImg} style={styles.footerHeart} />
            <Text style={styles.footerSubtext}> by Parzival</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onShow={() => modalInputRef.current?.focus()}
        icon={modalType === 'tag' ? 'person-outline' : 'key-outline'}
        title={modalTitle}
      >
        <View style={styles.modalContent}>
            <View style={styles.modalHint}>
              {modalType === 'tag' ? (
                <Text style={styles.modalHintText}>
                  Your unique player identifier starting with #. Find it in-game under Settings → More → Show Tag.
                </Text>
              ) : (
                <>
                  <Text style={styles.modalHintText}>
                    A long alphanumeric string (starts with <Text style={styles.modalCode}>eyJ</Text>) that grants read-only access to your profile.
                  </Text>
                  <View style={styles.modalSteps}>
                    <View style={styles.modalStep}>
                      <Text style={styles.modalStepNum}>1</Text>
                      <Text style={styles.modalStepText}>
                        Open <Text style={styles.modalLink}>developer.clashofclans.com</Text> and sign in with your Supercell ID
                      </Text>
                    </View>
                    <View style={styles.modalStep}>
                      <Text style={styles.modalStepNum}>2</Text>
                      <Text style={styles.modalStepText}>
                        Go to <Text style={styles.modalLink}>My Account → Create New Key</Text>, name it {"\u201C"}ClashPrime{"\u201D"}
                      </Text>
                    </View>
                    <View style={styles.modalStep}>
                      <Text style={styles.modalStepNum}>3</Text>
                      <Text style={styles.modalStepText}>
                        Copy the token, then <Text style={styles.modalImportant}>add IP 45.79.218.79 to the whitelist</Text> (app uses a proxy)
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
            <View style={styles.modalInputRow}>
              <TextInput
                ref={modalInputRef}
                style={styles.modalInput}
                value={modalValue}
                onChangeText={(t) => { setModalValue(t); setModalError(''); }}
                placeholder={modalPlaceholder}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={modalType === 'token'}
                keyboardAppearance="dark"
              />
              {modalType === 'token' && (
                <PressableRipple style={styles.modalIconBtn} onPress={async () => { const t = await getStringAsync(); if (t) setModalValue(t); }} hitSlop={8}>
                  <Ionicons name="clipboard-outline" size={18} color={Colors.textMuted} />
                </PressableRipple>
              )}
              {modalValue.length > 0 && (
                <PressableRipple style={styles.modalClearBtn} onPress={() => setModalValue('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </PressableRipple>
              )}
            </View>
            {modalError ? (
              <Text style={styles.modalErrorText}>{modalError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <PressableRipple
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </PressableRipple>
              <PressableRipple
                style={styles.modalSaveBtn}
                onPress={() => modalOnSave(modalValue)}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </PressableRipple>
            </View>
          </View>
      </BottomSheet>

      <BottomSheet
        visible={contentVisible}
        onClose={() => setContentVisible(false)}
        maxHeight="92%"
        title={contentTitle}
        subtitle={contentSubtitle || undefined}
        icon={contentIcon}
        iconSource={contentIconSource}
        contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
      >
            <ScrollView
              style={[styles.contentBody, contentIsChangelog && styles.contentBodyTall]}
              contentContainerStyle={styles.contentBodyInner}
              showsVerticalScrollIndicator={false}
            >
              {contentIsChangelog ? (
                <ChangelogBody
                  expanded={changelogExpanded}
                  onToggle={(v) => setChangelogExpanded((prev) => ({ ...prev, [v]: !prev[v] }))}
                />
              ) : (
                contentBody
              )}
            </ScrollView>
            <View style={styles.contentActions}>
              {contentActions.map((a, i) => (
                <PressableRipple
                  key={`${a.label}-${i}`}
                  style={[styles.contentBtn, a.primary && styles.contentBtnPrimary]}
                  onPress={() => {
                    a.onPress?.();
                    setContentVisible(false);
                  }}
                >
                  <Text style={[styles.contentBtnText, a.primary && styles.contentBtnTextPrimary]}>
                    {a.label}
                  </Text>
                </PressableRipple>
              ))}
            </View>
      </BottomSheet>

      <OnboardingModal
        visible={showOnboarding}
        onClose={() => { setShowOnboarding(false); setOnboardingStep('tag'); setOnboardingPlayer(null); }}
        step={onboardingStep}
        setStep={setOnboardingStep}
        onboardingTag={onboardingTag}
        setOnboardingTag={setOnboardingTag}
        onboardingPlayer={onboardingPlayer}
        setOnboardingPlayer={setOnboardingPlayer}
        onboardingBuilderCount={onboardingBuilderCount}
        setOnboardingBuilderCount={setOnboardingBuilderCount}
        onboardingThLevel={onboardingThLevel}
        setOnboardingThLevel={setOnboardingThLevel}
        onboardingImportJson={onboardingImportJson}
        setOnboardingImportJson={setOnboardingImportJson}
        onboardingImportResult={onboardingImportResult}
        setOnboardingImportResult={setOnboardingImportResult}
        onboardingImportTag={onboardingImportTag}
        setOnboardingImportTag={setOnboardingImportTag}
        onboardingImportError={onboardingImportError}
        setOnboardingImportError={setOnboardingImportError}
        handleOnboardingSave={handleOnboardingSave}
        handleOnboardingImportPaste={handleOnboardingImportPaste}
        handleOnboardingImportParse={handleOnboardingImportParse}
        handleOnboardingImportContinue={handleOnboardingImportContinue}
        handleOnboardingImportTokenSubmit={handleOnboardingImportTokenSubmit}
      />

      <BottomSheet visible={switchModalVisible} onClose={() => setSwitchModalVisible(false)} maxHeight="90%" title="Accounts" subtitle="Tap to switch · hold to remove" icon="swap-horizontal-outline" contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: 0 }}>
        <View style={styles.switchCard}>
          {accounts.length === 0 && <Text style={styles.switchEmpty}>No accounts added</Text>}

          <ScrollView style={styles.switchList} showsVerticalScrollIndicator={false}>
            {accounts.map((acct) => {
              const isActive = acct.tag === activeAccount?.tag;
              const isSyncing = acct.tag === syncingTag;
              const acctThImage = acct.townHallLevel > 0 ? getTownHallImageSource(acct.townHallLevel) : null;
              return (
                <PressableRipple
                  key={acct.tag}
                  style={[styles.switchItem, isActive && styles.switchItemActive]}
                  onPress={async () => {
                    if (isActive || switchingAccount || isSyncing) return;
                    setSwitchModalVisible(false);
                    await handleSwitchAccount(acct.tag);
                  }}
                  onLongPress={() => {
                    if (accounts.length <= 1) {
                      showDialog({ title: 'Cannot Remove', message: 'You need at least one account.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
                      return;
                    }
                    showDialog({
                      title: 'Remove Account',
                      message: `Remove ${acct.tag}? This will not delete your Clash of Clans account, only remove it from ClashPrime.`,
                      actions: [
                        { label: 'Cancel', onPress: () => { } },
                        {
                          label: 'Remove', primary: true, destructive: true, onPress: async () => {
                            await removeAccount(acct.tag);
                            await refreshAccounts();
                            if (isActive) {
                              const remaining = await getAccounts();
                              if (remaining.length > 0) {
                                await handleSwitchAccount(remaining[0].tag);
                              }
                            }
                          }
                        },
                      ],
                    });
                  }}
                >
                  <View style={styles.switchAvatar}>
                    {acctThImage ? (
                      <Image source={acctThImage} style={styles.switchAvatarImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="person" size={18} color={Colors.textSecondary} />
                    )}
                  </View>
                  <View style={styles.switchItemText}>
                    <View style={styles.switchItemNameRow}>
                      <Text style={styles.switchItemName} numberOfLines={1}>{acct.name || acct.tag}</Text>
                    </View>
                    <Text style={styles.switchItemTag}>{acct.tag}</Text>
                  </View>
                  {isSyncing && (
                    <View style={styles.switchSyncingBadge}>
                      <ActivityIndicator size="small" color={Colors.textSecondary} />
                    </View>
                  )}
                  {acct.townHallLevel > 0 && (
                    <View style={[styles.switchThBox, isActive && styles.switchThBoxActive]}>
                      <Text style={[styles.switchThBoxLevel, isActive && styles.switchThBoxLevelActive]}>{acct.townHallLevel}</Text>
                      <Text style={[styles.switchThBoxLabel, isActive && styles.switchThBoxLabelActive]}>TH</Text>
                    </View>
                  )}
                </PressableRipple>
              );
            })}
          </ScrollView>

          <PressableRipple
            style={styles.switchAdd}
              onPress={() => {
                setSwitchModalVisible(false);
                setOnboardingTag('');
                setOnboardingThLevel('');
                setShowOnboarding(true);
              }}
            >
              <Ionicons name="link-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.switchAddText}>Add Account</Text>
            </PressableRipple>

            <PressableRipple style={styles.switchClose} onPress={() => setSwitchModalVisible(false)}>
              <Text style={styles.switchCloseText}>Close</Text>
            </PressableRipple>
          </View>
      </BottomSheet>

      <DiscountModal
        visible={discountModalScope !== null}
        onClose={() => setDiscountModalScope(null)}
        scope={discountModalScope ?? 'buildings'}
        buildings={discounts.buildings}
        army={discounts.army}
        onBuildingCostChange={setBuildingCost}
        onBuildingTimeChange={setBuildingTime}
        onArmyCostChange={setArmyCost}
        onArmyTimeChange={setArmyTime}
        onReset={resetDiscounts}
      />

      <Dialog />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
settingSections: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  settingBody: {
    gap: Spacing.xs,
  },
  sectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  sectionBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeText: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  settingValue: {
    ...Typography.footnote,
    color: Colors.textMuted,
    flexShrink: 1,
    fontWeight: '500',
    maxWidth: 160,
  },
  settingThImage: {
    width: 24,
    height: 24,
    marginLeft: Spacing.sm,
  },
  discountRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fontChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  builderCountMessage: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
    marginBottom: 12,
  },
  discountDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  discountDotActive: {
    backgroundColor: Colors.warning,
  },
  switchCard: {
    gap: Spacing.xs,
  },
  switchList: {
    flexGrow: 0,
    maxHeight: 380,
  },
  switchEmpty: {
    ...Typography.subhead,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  switchItemActive: {
    backgroundColor: Colors.accentGhost,
  },
  switchAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  switchAvatarImg: {
    width: 34,
    height: 34,
  },
  switchItemText: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  switchItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  switchItemName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
  },
  switchItemTag: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 1,
  },
  switchSyncingBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchThBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchThBoxActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  switchThBoxLevel: {
    ...Typography.headline,
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 16,
    fontWeight: '700',
  },
  switchThBoxLevelActive: {
    color: Colors.bg,
  },
  switchThBoxLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '600',
  },
  switchThBoxLabelActive: {
    color: Colors.bg,
    opacity: 0.7,
  },
  switchAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  switchAddText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  switchClose: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  switchCloseText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
    opacity: 0.6,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  footerSubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  footerMadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerHeart: {
    width: 12,
    height: 12,
    marginBottom: 1,
  },
  creditMadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  creditMadeText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  creditHeart: {
    width: 12,
    height: 12,
    marginBottom: 1,
  },
  onboardingMadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  onboardingMadeText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  onboardingHeart: {
    width: 12,
    height: 12,
    marginBottom: 1,
  },
  modalContent: {
    gap: Spacing.sm,
  },
  modalHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginBottom: Spacing.xs,
  },
  modalHintText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
  modalCode: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: Colors.accent,
  },
  modalSteps: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  modalStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  modalStepNum: {
    width: 18,
    height: 18,
    borderRadius: 4.5,
    backgroundColor: Colors.accent,
    color: Colors.bg,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    marginTop: 1,
  },
  modalStepText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  modalLink: {
    color: Colors.accent,
    fontWeight: '600',
  },
  modalImportant: {
    color: Colors.warning,
    fontWeight: '600',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingRight: Spacing.sm,
  },
  modalInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  modalClearBtn: {
    padding: 4,
  },
  modalIconBtn: {
    padding: 4,
    marginLeft: 2,
  },
  modalErrorText: {
    ...Typography.caption,
    color: Colors.destructive,
    marginTop: -4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
  },
  modalCancelBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  modalCancelText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  modalSaveBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
  },
  modalSaveText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  contentBody: {
    maxHeight: 360,
  },
  contentBodyTall: {
    maxHeight: 520,
  },
  contentBodyInner: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.base,
  },
  contentActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contentBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
  },
  contentBtnPrimary: {
    backgroundColor: Colors.textPrimary,
  },
  contentBtnText: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  contentBtnTextPrimary: {
    color: Colors.bg,
  },
  aboutUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginBottom: Spacing.base,
  },
  updateBadgeText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '700',
  },
  creditBlurb: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  creditSectionTitle: {
    ...Typography.callout,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginVertical: Spacing.sm,
  },
  creditSourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingVertical: 4,
  },
  creditNotice: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  aboutFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  creditSourceIcon: {
    marginTop: 2,
  },
  creditSourceText: {
    flex: 1,
    gap: 2,
  },
  creditSourceName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  creditSourceUse: {
    ...Typography.footnote,
    color: Colors.textTertiary,
  },
  policyBlock: {
    gap: Spacing.xs,
  },
  policyTitle: {
    ...Typography.callout,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  policyBody: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.base,
  },
  feedbackText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  feedbackEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginVertical: Spacing.lg,
  },
  feedbackEmail: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  feedbackNote: {
    ...Typography.footnote,
    color: Colors.textTertiary,
  },
  onboardingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  onboardingCard: {
    alignSelf: 'stretch',
    marginHorizontal: 20,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  onboardingIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  onboardingTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
  },
  onboardingDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginBottom: Spacing.xs,
  },
  onboardingInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    width: '100%',
  },
  onboardingInputGroup: {
    width: '100%',
    gap: Spacing.xs,
  },
  onboardingFieldLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  onboardingActions: {
    width: '100%',
    flexDirection: 'column',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  onboardingBtn: {
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    width: '100%',
  },
  onboardingBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  onboardingBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
    textAlign: 'center',
  },
  onboardingBtnTextGhost: {
    color: Colors.textSecondary,
  },
  onboardingConfirmText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  onboardingProfileCard: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  profileCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCardIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  profileCardIconImage: {
    width: 34,
    height: 34,
  },
  profileCardIconText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  profileCardMiddle: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  profileCardName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs / 1.25,
  },
  profileCardSubtitle: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  profileCardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: Spacing.sm,
  },
  profileCardProgressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  profileCardProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  profileCardTimeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
  },
  onboardingThGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    justifyContent: 'space-between'
  },
  onboardingThCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    minWidth: '48%',
    flex: 1
  },
  onboardingThImg: {
    width: 32,
    height: 32,
    marginRight: Spacing.lg,
  },
  onboardingThText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  onboardingThHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  builderCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  builderCountBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
builderCountBtnDisabled: {
    opacity: 0.45,
  },
  builderCountBadgeBtn: {
    backgroundColor: Colors.bgCardHover,
  },
  builderCountValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  builderCountBadge: {
    marginTop: 1,
  },
  builderCountValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
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
  devTagline: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  devProjectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  devRowLabel: {
    ...Typography.subhead,
    color: Colors.textSecondary,
  },
  devRowValue: {
    ...Typography.footnote,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  onboardingImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardHover,
    marginTop: Spacing.md,
  },
  onboardingImportBtnText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  onboardingBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  onboardingGhostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  onboardingGhostBtnText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  onboardingParseBtn: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
  },
  onboardingParseBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  onboardingSummaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  onboardingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },
  onboardingSummaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  onboardingSummaryValue: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  onboardingErrorText: {
    ...Typography.caption,
    color: Colors.destructive,
    marginTop: Spacing.sm,
  },
});
