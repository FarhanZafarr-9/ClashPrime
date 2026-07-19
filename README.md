# ClashPrime

A premium monochrome companion app for Clash of Clans — track your progress, manage bases, explore building levels, and stay on top of events.

<p align="center">
  <img src="images/rounded-icon.png" width="120" alt="ClashPrime Icon" />
</p>

## Features

- **Home Dashboard** — overview of your village with progress rings, resource counters, and building stats
- **Base Library** — scrape and browse TH-level base layouts from clashofclans-layouts.com
- **Player Profile** — troops, heroes, spells, pets, equipment with images and level progress
- **Buildings** — expandable cards showing all 75+ buildings with level model progression (Home Village + Builder Base)
- **Events** — upcoming in-game events with countdown timers and progress bars
- **Settings** — API token configuration, dark mode toggle, credits
- **Onboarding** — guided first-run flow for entering API token and player tag

## Design

Monochrome palette (`#0A0A0A` → `#FAFAFA`), 8pt spacing system, decreased roundedness, icon-only bottom navigation. All UI components are custom-built with a consistent dark theme.

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
| Player data | CoC API | REST fetch |
| Base layouts | clashofclans-layouts.com | Runtime regex scraper |
| TH max levels | clash.ninja | CLI scraper → static JSON |
| Troop list | coc.guide | CLI scraper → static JSON |
| Troop details | coc.guide | On-demand fetch with cache |
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
│       ├── bases.tsx       # Base Library
│       ├── profile.tsx     # Player Profile
│       ├── events.tsx      # Events
│       ├── buildings.tsx   # Buildings
│       └── settings.tsx    # Settings
├── src/
│   ├── api/                # API clients and scrapers
│   │   ├── clash.ts        # CoC API client
│   │   ├── baseScraper.ts  # Runtime base layout scraper
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
# Scrape base layouts for all TH levels
npx tsx scraper/run.ts

# Scrape TH max levels from clash.ninja
npx tsx scraper/run-th-levels.ts

# Scrape troop list from coc.guide
npx tsx scraper/run-troops.ts

# Scrape building images from Fandom wiki
npx tsx scraper/run-building-images.ts

# Re-download building images + regenerate asset mapping
npx tsx scraper/download-building-images.ts
```

## License

MIT
