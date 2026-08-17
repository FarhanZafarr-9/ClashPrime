# ClashPrime

A premium monochrome companion app for Clash of Clans — track your progress, manage armies and bases, explore building levels, follow wars, and stay on top of events.

<p align="center">
  <img src="images/rounded-icon.png" width="120" alt="ClashPrime Icon" />
</p>

## Features

- **Home Dashboard** — overview of your village with progress cards, quick actions, **League section** (badge, bonus, loot, star bonus, ore), and quick stats
- **Time to Max** — dedicated tab with four parallel pipelines (**Lab**, **Builders**, **Pets**, **Equipment**) showing remaining upgrade time & resources per category; **chain-scheduled builder time** (LPT bin-packing of serial upgrade chains) so a single long hero upgrade correctly bounds the result
- **Import / Export** — bulk import building levels from CoC JSON export; shows **only real upgrades** (skips buildings already at target), per-copy current levels, builders pipeline with chain-scheduled time & resource breakdown, spaced upgrade cards with proper corner rounding
- **Multi-Account** — add and switch between multiple player tags from Settings or the Home dashboard. Each account keeps its own building levels, saved bases, and favorites. Shared data (events, troop details) is fetched once.
- **Army** — troops, heroes, spells, pets, equipment with images, level stats tables (with acronym legend), progress tracking, and discount-aware cost/time columns
- **Buildings** — expandable cards showing all 80+ buildings with level model progression, stat tables (Home Village + Builder Base), and per-building discount toggles. Multi-copy buildings (Cannons, Walls, Traps, etc.) are grouped into collapsible sections with per-copy level tracking, aggregated remaining cost/time, and quick upgrade/downgrade controls
- **Events** — upcoming in-game events with countdown timers and progress bars
- **War** — live war tracking with per-member attack dots and defense shields, plus live Clan War League rounds (expandable per-member breakdowns, W/L/D per round) and a searchable war history split into regular wars and CWL
- **Base Library** — browse TH-level base layouts from ClashLy, grouped by year and sorted by popularity, paginated with end-of-list feedback
- **Army Library** — community army compositions from ClashArmies with TH-level filtering, save/favorite, in-game copy, and end-of-list feedback
- **Discount System** — modal with per-scope (Buildings / Army) cost and time reduction sliders, preset pills, custom percentage input, and instant preview across all tabs
- **Saved** — quick access to saved and favorited bases and armies, with full army cards and share actions
- **Awards** — standalone tab with star summary and village-filtered achievement list
- **Settings** — API token, dark mode, discounts, account management, plus a **redesigned What's New changelog** with version chips and "Latest" badge, About, Credits, Privacy Policy, Feedback (farhanzafarr.9@gmail.com) and Developer Info
- **Onboarding** — guided first-run flow with an image-based Town Hall picker and an Add Account (Full Setup) flow
- **Timers** — custom duration parsing (1d 2h 3m), dashed "Add timer" row at list end with proper isFirst/isLast rounding

## Design

Monochrome palette (`#0A0A0A` → `#FAFAFA`), 8pt spacing system, decreased roundedness, and icon-only bottom navigation.

- **Dynamic Theme Engine** — Full runtime support for switching between Dark Mode and Light Mode, utilizing a dynamic StyleSheet proxy that maps color tokens instantly across all components.
- **Theme-Aware Skeletons** — Custom animated skeleton loaders that mimic tab structures (Home, Army, Bases, Armies, Events) and transition smoothly between themes.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 57.0.14 + React Native 0.86 |
| Navigation | expo-router (file-based) |
| Language | TypeScript 6.0 |
| Storage | AsyncStorage |
| Status Bar | expo-status-bar (hidden) |
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

## Project Structure

```
ClashPrime/
├── app/                    # Screens (expo-router file-based)
│   ├── _layout.tsx         # Root layout with auth gate
│   ├── onboarding.tsx      # First-run token + tag input
│   ├── import-export.tsx   # Bulk import building levels from CoC JSON export (redesigned: real upgrades only, chain-scheduled pipeline)
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
│       └── settings.tsx    # Settings (redesigned changelog with version chips)
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

> The old Fandom wiki scrapers in `scraper/` are deprecated — all building/troop data now comes from `clash-of-clans-data` npm package.

## Roadmap

- **Time to Max enhancements** — Hero equipment pipeline, season/tournament integration, exportable upgrade plan.
- **Clan War Leagues** — Live CWL rounds are now tracked on the War tab. Remaining: medal tracking and promotion/ranking through a league season.
- **Landing page** — A simple static HTML page for web presence, deployed via Vercel from the same repo.

## Future Considerations

- **Fork `clash-of-clans-data`** — Upstream is pre-1.0 and updates on Supercell's schedule. Consider forking as `@clashprime/clash-of-clans-data` with a sync script to apply custom mappings (display names, BB building fixes, image paths) and publish on our own cadence when new content drops.
- **Offline-first sync** — Cache player data + reference data for full offline usage; background sync when online.
- **Clan roster management** — Track member donations, war participation, and activity across seasons.
- **Push notifications** — Event start/end, war attacks, builder completion, upgrade timers.
- **Builder chain planner** — Visual scheduler for serial upgrade chains across N builders with drag-to-reorder.

## License

MIT
