# ClashPrime

A premium monochrome companion app for Clash of Clans — track your progress, manage armies and bases, explore building levels, follow wars, and stay on top of events.

<p align="center">
  <img src="images/rounded-icon.png" width="120" alt="ClashPrime Icon" />
</p>

## Features

- **Home Dashboard** — overview of your village with progress cards, quick actions, and quick stats
- **Multi-Account** — add and switch between multiple player tags from Settings or the Home dashboard. Each account keeps its own building levels, saved bases, and favorites. Shared data (events, troop details) is fetched once.
- **Army** — troops, heroes, spells, pets, equipment with images, level stats tables (with acronym legend), progress tracking, and discount-aware cost/time columns
- **Buildings** — expandable cards showing all 80+ buildings with level model progression, stat tables (Home Village + Builder Base), and per-building discount toggles
- **Events** — upcoming in-game events with countdown timers and progress bars
- **War** — live war tracking with per-member attack dots and defense shields, plus live Clan War League rounds (expandable per-member breakdowns, W/L/D per round) and a searchable war history split into regular wars and CWL
- **Base Library** — browse TH-level base layouts from ClashLy, grouped by year and sorted by popularity, paginated with end-of-list feedback
- **Army Library** — community army compositions from ClashArmies with TH-level filtering, save/favorite, in-game copy, and end-of-list feedback
- **Discount System** — modal with per-scope (Buildings / Army) cost and time reduction sliders, preset pills, custom percentage input, and instant preview across all tabs
- **Saved** — quick access to saved and favorited bases and armies, with full army cards and share actions
- **Awards** — standalone tab with star summary and village-filtered achievement list
- **Settings** — API token, dark mode, discounts, account management, plus a What's New changelog, About, Credits, Privacy Policy, Feedback (farhanzafarr.9@gmail.com) and Developer Info
- **Onboarding** — guided first-run flow with an image-based Town Hall picker and an Add Account (Full Setup) flow

## Design

Monochrome palette (`#0A0A0A` → `#FAFAFA`), 8pt spacing system, decreased roundedness, and icon-only bottom navigation.

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
| TH max levels | clash.ninja | Runtime HTML scraper with section-hash caching |
| Troop & hero details (images, descriptions, stats) | Clash of Clans Fandom Wiki | On-demand MediaWiki API fetch with 7-day cache |
| Building images | Clash of Clans Fandom Wiki | CLI scraper → downloaded .webp assets |
| Siege machine, super troop & pet names | Clash of Clans Fandom Wiki | On-demand MediaWiki category API with 7-day cache |
| Events | clash.ninja | Runtime HTML scraper |

## Project Structure

```
ClashPrime/
├── app/                    # Screens (expo-router file-based)
│   ├── _layout.tsx         # Root layout with auth gate
│   ├── onboarding.tsx      # First-run token + tag input
│   └── (tabs)/             # Tab screens
│       ├── _layout.tsx     # Bottom tab navigator
│       ├── index.tsx       # Home Dashboard
│       ├── army.tsx        # Player Army
│       ├── buildings.tsx   # Buildings
│       ├── events.tsx      # Events
│       ├── bases.tsx       # Base Library
│       ├── armies.tsx      # Army Library (ClashArmies)
│       ├── saved.tsx       # Saved & Favorites
│       ├── war.tsx         # War & CWL
│       ├── achievements.tsx# Awards
│       └── settings.tsx    # Settings
├── src/
│   ├── api/                # API clients and scrapers
│   │   ├── clash.ts        # CoC API client
│   │   ├── baseScraper.ts  # ClashLy API base layout fetcher
│   │   ├── clashArmies.ts  # ClashArmies popular armies fetcher with devalue parser
│   │   ├── troopDetail.ts  # On-demand troop detail fetcher (Fandom Wiki)
│   │   └── eventsScraper.ts# Events scraper
│   ├── components/         # Shared UI components
│   ├── data/               # Static scraped data + building assets
│   ├── hooks/              # Player context and storage
│   ├── theme/              # Design system (colors, spacing, typography)
│   ├── types/              # TypeScript interfaces
│   └── utils/              # TH max levels, troop/building image lookups
├── assets/buildings/       # 75 folders of .webp building images (736 level images)
├── scraper/                # CLI scrapers for generating static data
└── images/                 # App icons and logos
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

## Scraper Scripts

```bash
# Scrape TH max levels from clash.ninja
npx tsx scraper/run-th-levels.ts

# Scrape building images from Fandom wiki
npx tsx scraper/fandom-buildings.ts

# Re-download building images + regenerate asset mapping
npx tsx scraper/download-building-images.ts

# Scrape siege machine names from Fandom wiki (dev verification only — app fetches dynamically)
npx tsx scraper/siege-machines.ts
```

## Roadmap

- **Clan War Leagues** — Live CWL rounds are now tracked on the War tab. Remaining: medal tracking and promotion/ranking through a league season.
- **Landing page** — A simple static HTML page for web presence, deployed via Vercel from the same repo.

## License

MIT
