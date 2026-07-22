# ClashPrime

A premium monochrome companion app for Clash of Clans — track your progress, manage bases, explore building levels, and stay on top of events.

<p align="center">
  <img src="images/rounded-icon.png" width="120" alt="ClashPrime Icon" />
</p>

## Features

- **Home Dashboard** — overview of your village with progress cards, quick stats, and quick actions
- **Player Profile** — troops, heroes, spells, pets, equipment with images, level stats tables, and collapsible progress section
- **Buildings** — expandable cards showing all 80+ buildings with level model progression and stat tables (Home Village + Builder Base)
- **Events** — upcoming in-game events with countdown timers and progress bars
- **Base Library** — browse TH-level base layouts with community ratings from ClashLy (paginated, category filters)
- **Achievements** — standalone tab with star summary and village-filtered achievement list
- **Settings** — API token & dark mode, plus Credits, Privacy Policy and Feedback (reach us at farhanzafarr.9@gmail.com)
- **Onboarding** — guided first-run flow for entering API token and player tag

## Design

Monochrome palette (`#0A0A0A` → `#FAFAFA`), 8pt spacing system, decreased roundedness, and icon-only bottom navigation.

- **Dynamic Theme Engine** — Full runtime support for switching between Dark Mode and Light Mode, utilizing a dynamic StyleSheet proxy that maps color tokens instantly across all components.
- **Theme-Aware Skeletons** — Custom animated skeleton loaders that mimic tab structures (Home, Profile, Bases, Events) and transition smoothly between themes.

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

Uses the official Clash of Clans API:
- Endpoint: `https://api.clashofclans.com/v1/players/{tag}`
- Auth: Bearer token
- Players enter their own API token and player tag in the onboarding flow

## Data Sources

| Data | Source | Method |
|------|--------|--------|
| Player data | CoC API | REST fetch (Bearer token) |
| Base layouts | ClashLy API | REST fetch (Parse server) |
| TH max levels | clash.ninja | CLI scraper → static JSON |
| Troop & hero details (images, descriptions, stats) | Clash of Clans Fandom Wiki | On-demand MediaWiki API fetch with 7-day cache |
| Building images | Clash of Clans Fandom Wiki | CLI scraper → downloaded .webp assets |
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
│       ├── profile.tsx     # Player Profile
│       ├── buildings.tsx   # Buildings
│       ├── events.tsx      # Events
│       ├── bases.tsx       # Base Library
│       ├── achievements.tsx# Achievements
│       └── settings.tsx    # Settings
├── src/
│   ├── api/                # API clients and scrapers
│   │   ├── clash.ts        # CoC API client
│   │   ├── baseScraper.ts  # ClashLy API base layout fetcher
│   │   ├── troopDetail.ts  # On-demand troop detail fetcher
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
3. Find your player tag in-game (e.g., `#YYYYY`)
4. Enter both and tap **Connect**

## Scraper Scripts

```bash
# Scrape TH max levels from clash.ninja
npx tsx scraper/run-th-levels.ts

# Scrape building images from Fandom wiki
npx tsx scraper/fandom-buildings.ts

# Re-download building images + regenerate asset mapping
npx tsx scraper/download-building-images.ts

# Scrape building level data from Fandom wiki (all building types)
npx tsx scraper/run-building-levels.ts
```

## Roadmap

- **Building level data from Fandom** ✅ — Per-building descriptions, max levels, and full stat tables from the Clash of Clans Fandom Wiki (`action=raw` wikitext). Runs via `npx tsx scraper/run-building-levels.ts` and generates `src/data/building-levels.json`. Covers **83 buildings** across all categories: Defenses, Resources, Army buildings, Traps, Walls, and their Builder Base variants. The scraper uses a flexible parser that handles both single-line (`||`-delimited) and multi-line cell formats, `{{GoldPass}}` cost/template wrappers, and dynamically discovers column sets instead of hardcoding them. Column names are normalised (Damage per Second → DPS, Hitpoints → HP, etc.) for consistent display, and info-only tables (Range, Attack Speed, Damage Type) are automatically skipped.

## License

MIT
