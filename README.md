# ClashPrime

A premium monochrome companion app for Clash of Clans — track your progress, manage armies and bases, explore building levels, follow wars, and stay on top of events.

<p align="center">
  <img src="images/rounded-icon.png" width="120" alt="ClashPrime Icon" />
</p>

## Features

- **Home Dashboard** — overview of your village with progress cards, quick actions, **League section** (badge, bonus, loot, star bonus, ore), quick stats, and a **Progress Achieved dialog** that also tracks Builder Base troop and hero progress
- **Time to Max** — dedicated tab with four parallel pipelines (**Lab**, **Builders**, **Pets**, **Equipment**) showing remaining upgrade time & resources per category; **chain-scheduled builder time** (LPT bin-packing of serial upgrade chains) so a single long hero upgrade correctly bounds the result
- **Import / Export** — bulk import building levels from a CoC JSON export covering **Home Village and Builder Base**; shows **only real upgrades** (skips buildings already at target), per-copy current levels, a builders pipeline with chain-scheduled time & resource breakdown (Builder Base upgrades timed against their own builders — auto 2 at Builder Hall 6, max 3), spaced upgrade cards with proper corner rounding, and in-game resource icons on upgrade rows
- **Multi-Account** — add and switch between multiple player tags from Settings or the Home dashboard. Each account keeps its own building levels, saved bases, and favorites. Shared data (events, troop details) is fetched once.
- **Army** — troops, heroes, spells, pets, equipment (including Builder Base items) with images, level stats tables (with acronym legend), progress tracking, and discount-aware cost/time columns
- **Buildings** — expandable cards showing all 80+ buildings with level model progression, stat tables (Home Village + Builder Base), and per-building discount toggles. Multi-copy buildings (Cannons, Walls, Traps, etc.) are grouped into collapsible sections with per-copy level tracking, aggregated remaining cost/time, and quick upgrade/downgrade controls
- **Events** — upcoming in-game events with countdown timers and progress bars
- **War** — live war tracking with per-member attack dots and defense shields, plus live Clan War League rounds (expandable per-member breakdowns, W/L/D per round) and a searchable war history split into regular wars and CWL
- **Base Library** — browse TH-level base layouts from ClashLy, grouped by year and sorted by popularity, paginated with end-of-list feedback
- **Army Library** — community army compositions from ClashArmies with TH-level filtering, save/favorite, in-game copy, and end-of-list feedback
- **Discount System** — modal with per-scope (Buildings / Army) cost and time reduction sliders, preset pills, custom percentage input, and instant preview across all tabs
- **Saved** — quick access to saved and favorited bases and armies, with full army cards and share actions
- **Awards** — standalone tab with star summary and village-filtered achievement list
- **Settings** — API token, dark mode, discounts, account management, plus a **What's New changelog** with a hero header and collapsible release cards (version chips, item counts, "Latest" badge), About, Credits, Privacy Policy, Feedback (farhanzafarr.9@gmail.com) and Developer Info
- **Onboarding** — guided first-run flow with an image-based Town Hall picker and an Add Account (Full Setup) flow
- **Timers** — custom duration parsing (1d 2h 3m), dashed "Add timer" row at list end with proper isFirst/isLast rounding, and an ongoing notification with an **Android-native per-second countdown** that keeps ticking even when the app is killed (zero battery) plus sound/vibration on finish
- **Version Checker** — compares the running build against GitHub release tags; update badges in Home & Settings with one-tap release links and ahead-of-release detection

## What's New (v6.0.0)

- **Builder Base in Import** — JSON exports now parse Builder Base buildings; their upgrades are timed against their own builders (dedicated "Builder Base Builders" count, auto 2 at Builder Hall 6, max 3) with in-game resource icons on upgrade rows.
- **Builder Base progress everywhere** — Builder Base troops and heroes are tracked in Progress Achieved, the army list shows builder hero max levels and Builder Base items at their Builder Hall, and progress snapshots include them.
- **Smarter Import** — per-copy level tracking, "Upgrading now" with a treat-as-done toggle, one row per level variant, and re-pastes no longer re-propose already-applied upgrades.
- **Hero Journey tab** — the full rewards track from TH7 to TH18 (quests, ore, hero equipment, potions, books, runes and Majestic skins) as milestones in collapsible Town Hall sections, capped to your own Town Hall with a skip-to-milestone shortcut.
- **Bottom-sheet detail panels** — Army and Buildings details (including locked items) open in slide-up sheets with custom headers, condenseable level ranges, and reset-on-close.
- **Time to Max** — exclude buildings you don't plan to max and a new Town Hall upgrade card in the rush comparison; new-unlock rows show item type and count.
- **Polished dialogs** — restyled Progress Achieved (pictograms + in-game item icons) and account switcher (row-highlighted active account, full-width cards).
- **Home timers** — edit a timer to restart its countdown; rows show start/end times and sort by end time.
- **Pageable floating tab bar** — overflow tabs page into groups with prev/next arrows.
- **Restyled What's New dialog** — hero header with the latest version, and every release as a collapsible card with item counts and expand/collapse.
- **Under the hood** — Expo 57 / React Native 0.86, clash-of-clans-data 0.17 with new package images (Ruin Witch, Sky Wagon, Valkyrie L12 and more), aligned skeleton rows.

Full release history is available in-app under **Settings → What's New**.

## Design

Monochrome palette (`#0A0A0A` → `#FAFAFA`), 8pt spacing system, decreased roundedness, and an icon-only bottom navigation with pageable tab groups (prev/next arrows) when the tab set overflows.

- **Dynamic Theme Engine** — Full runtime support for switching between Dark Mode and Light Mode, utilizing a dynamic StyleSheet proxy that maps color tokens instantly across all components.
- **Theme-Aware Skeletons** — Custom animated skeleton loaders that mimic tab structures (Home, Army, Bases, Armies, Events) and transition smoothly between themes.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 57 + React Native 0.86 |
| Navigation | expo-router (file-based) |
| Language | TypeScript 6.0 |
| Storage | AsyncStorage |
| Status Bar | expo-status-bar (hidden) |
| Linting | ESLint (eslint-config-expo) + React Compiler |
| SVG | react-native-svg |
| Gesture | react-native-gesture-handler |

## API

Uses the official Clash of Clans API via the [RoyaleAPI proxy](https://docs.royaleapi.com/proxy.html) (for servers with dynamic IPs):
- Endpoint: `https://cocproxy.royaleapi.dev/v1/players/{tag}`
- Auth: Bearer token
- Players enter their own API token and player tag in the onboarding flow

> **Important:** When creating your API key at [developer.clashofclans.com](https://developer.clashofclans.com), you must whitelist the proxy IP: **`45.79.218.79`** — otherwise requests will be rejected.

## Data Sources

| Data | Source | Method |
|------|--------|--------|
| Player data | CoC API | REST fetch (Bearer token) |
| Base layouts | ClashLy API | REST fetch (Parse server) |
| Community armies | ClashArmies | Devalue-format REST fetch with 30-min cache |
| Troop, hero, spell, pet, equipment & siege machine details (levels, costs, stats, images) | clash-of-clans-data (npm) | Bundled package data (canonical) |
| Building images, levels, TH max, copy counts (Home & Builder Base) | clash-of-clans-data (npm) | Bundled package data (canonical) |
| **Max Town Hall** | clash-of-clans-data (npm) | **Derived from `townHallRequired` across all building levels** (falls back to 18) |
| League loot/bonus/ore info | clash-of-clans-data (npm) | Bundled package data (canonical) |
| Events | clash.ninja | Runtime HTML scraper |
| TH max levels (fallback) | clash.ninja | Runtime HTML scraper with section-hash caching |

## Credits & Attribution

ClashPrime is an unofficial fan project. It gathers reference data and content from the following public sources — please support them:

| Project / Site | Used for | Homepage |
|----------------|----------|----------|
| Clash of Clans API | Player stats & progress | [developer.clashofclans.com](https://developer.clashofclans.com) |
| RoyaleAPI proxy | Stable API access for dynamic-IP setups | [docs.royaleapi.com/proxy.html](https://docs.royaleapi.com/proxy.html) |
| ClashLy | Base layout library & ratings | [clashly.com](https://clashly.com) |
| ClashArmies | Community army compositions & sharing | [clasharmies.com](https://clasharmies.com) |
| clash-of-clans-data (npm) | Troop/hero/spell/pet/equipment/siege machine & building data (levels, costs, stats, images) | [npmjs.com/package/clash-of-clans-data](https://www.npmjs.com/package/clash-of-clans-data) |
| clash.ninja | In-game events & TH max level fallback | [clash.ninja](https://clash.ninja) |
| Zapquaker | Inspiration for the Zapquaker tab (Zap & Quake combo calculator) | [zapquaker.netlify.app](https://zapquaker.netlify.app/) |
| Otaku Planner | Inspiration for the Giant Arrow tab (Giant Arrow path planner) | [otakuplanner.com/tools/coc-arrow-path](https://otakuplanner.com/tools/coc-arrow-path) |

These credits are also shown in-app under **Settings → Credits**, where each source is tappable.

> **Supercell fan-content notice:** This content is not affiliated with, endorsed, sponsored, or specifically approved by Supercell and Supercell is not responsible for it. For more information see Supercell's Fan Content Policy: [supercell.com/fan-content-policy](https://supercell.com/en/fan-content-policy/).

## Project Structure

```
ClashPrime/
├── app/                    # Screens (expo-router file-based)
│   ├── _layout.tsx         # Root layout with auth gate
│   ├── onboarding.tsx      # First-run token + tag input
│   ├── import-export.tsx   # Bulk import building levels from CoC JSON export (Home Village + Builder Base, chain-scheduled pipeline)
│   └── (tabs)/             # Tab screens
│       ├── _layout.tsx     # Bottom tab navigator (Time to Max promoted to main)
│       ├── index.tsx       # Home Dashboard (with League section in Quick Stats)
│       ├── army.tsx        # Player Army
│       ├── buildings.tsx   # Buildings
│       ├── events.tsx      # Events
│       ├── bases.tsx       # Base Library
│       ├── armies.tsx      # Army Library (ClashArmies)
│       ├── maxtime.tsx     # Time to Max (4 pipelines: Lab/Builders/Pets/Equipment)
│       ├── saved.tsx       # Saved & Favorites
│       ├── war.tsx         # War & CWL
│       ├── achievements.tsx# Awards
│       └── settings.tsx    # Settings (collapsible What's New changelog)
├── src/
│   ├── api/                # API clients and scrapers
│   │   ├── clash.ts        # CoC API client
│   │   ├── baseScraper.ts  # ClashLy API base layout fetcher
│   │   ├── clashArmies.ts  # ClashArmies popular armies fetcher with devalue parser
│   │   ├── troopDetail.ts  # TroopDetail types (levels from package)
│   │   └── eventsScraper.ts# Events scraper
│   ├── components/         # Shared UI components
│   ├── data/               # Static data (packageImages.ts, cocBuildingIds.ts, entityReference.ts)
│   ├── hooks/              # Player context and storage
│   ├── theme/              # Design system (colors, spacing, typography)
│   ├── types/              # TypeScript interfaces
│   └── utils/              # armyData, buildingData (getMaxTownHall), buildingImages, thMaxLevels, upgradeCosts (chain scheduling), etc.
├── scripts/                # Generators: gen-package-images.mjs, gen-coc-ids.mjs
├── images/                 # App icons and logos
```

## Getting Started

```bash
# Install dependencies
npm install

# Start the dev server
npx expo start

# Run on specific platform
npx expo start --android
npx expo start --ios
```

### First Launch

1. Open the app — you'll see the onboarding screen
2. Get your API token from [developer.clashofclans.com](https://developer.clashofclans.com)
3. When creating your API key, whitelist the proxy IP: **`45.79.218.79`** — the app uses the RoyaleAPI proxy to support dynamic IPs
4. Find your player tag in-game (e.g., `#YYYYY`)
5. Enter both and tap **Connect**

## Generator Scripts

```bash
# Generate packageImages.ts (bundled images for troops, heroes, spells, pets, equipment, siege machines, buildings)
npm run gen:images

# Generate cocBuildingIds.ts (building ID mapping for API)
npm run gen:coc-ids
```

### When `clash-of-clans-data` updates upstream

```bash
npm run sync:coc-data   # installs latest package + regenerates images & ID mapping
npx tsc --noEmit        # sanity check for schema changes
```

Then commit the regenerated `src/data/` files + lockfile, push, and tag the release (e.g. `v6.0.0`) so the in-app version checker picks it up.

> The old Fandom wiki scrapers in `scraper/` are deprecated — all building/troop data now comes from `clash-of-clans-data` npm package.

## Roadmap

- **Time to Max enhancements** — Hero equipment pipeline, season/tournament integration, exportable upgrade plan.
- **Clan War Leagues** — Live CWL rounds are now tracked on the War tab. Remaining: medal tracking and promotion/ranking through a league season.
- **Landing page** — A simple static HTML page for web presence, deployed via Vercel from the same repo.

## Future Considerations

- **Fork `clash-of-clans-data`** — Upstream is pre-1.0 and updates on Supercell's schedule. Consider forking as `@clashprime/clash-of-clans-data` with a sync script to apply custom mappings (display names, BB building fixes, image paths) and publish on our own cadence when new content drops.
- **Offline-first sync** — Cache player data + reference data for full offline usage; background sync when online.
- **Clan roster management** — Track member donations, war participation, and activity across seasons.
- **Push notifications** — Event start/end, war attacks. Builder/upgrade timers already ship as native countdown notifications; remaining: event and war attack alerts.
- **Builder chain planner** — Visual scheduler for serial upgrade chains across N builders with drag-to-reorder.

## License

MIT
