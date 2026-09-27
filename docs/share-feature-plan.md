# Visual Share Feature — High-Level Plan

## Goal

Let users share their Clash progress as **rendered views (images) + supporting links/text**, instead of the current bare text links. Shared content targets three kinds of "progress":

- **Progress stats** — current state shown as stats, progress bars and pipeline/detail views.
- **Time left** — Maxtime-style "how much is left / how long until max" summaries.
- **Loadouts** — armies and base layouts shown as their card visuals plus their permalink.

## Core approach

- **Reusable hook** `useShareImage(ref, { title, text?, url? })` built on:
  `react-native-view-shot` `captureRef` (3x scale, PNG) + `expo-sharing` `shareAsync`.
  This is the pattern already proven in `app/(tabs)/giantarrow.tsx`.
- Optional **dedicated share card**: a fixed layout (header, progress bars, footer/app watermark) rendered off-screen and captured, so shares look consistent regardless of live screen chrome.
- **Per-tab buttons**, not a new tab: the floating bar already runs 4 pages of content, and sharing is an action performed on what you're viewing.
- Text + permalink appended when the content has one (armies/bases already have clasharmies links). Progress/maxtime have no URL today; can embed a deep link later (see Open questions).

## Registered tabs overview (from `app/(tabs)/_layout.tsx`)

Tab bar pages (from `FloatingTabBar` TAB_GROUPS):
P1 `index · buildings · army · maxtime` | P2 `events · hero-journey · bases · armies` | P3 `war · search · zapquaker · bob` | P4 `giantarrow · achievements · saved · settings`
(`search` is pseudo-entry → `/player` route; `bases`, `saved`, `settings`, `war`, `maxtime` registered with `href: null`.)

| Tab | What it shows | Bar | Current share | Class | Priority | Status |
|---|---|---|---|---|---|---|
| `index` (Home) | Progress overview: category stats, progress bars, time-to-max, builder split | P1 | none | **BUILD** | 1 | ✅ **Done** |
| `buildings` | Per-building resource cost chains | P1 | none | Consider | 5 | |
| `army` | Loaded army detail: units/heroes/equipment | P1 | none | **BUILD** | 4 | |
| `maxtime` | Remaining upgrade time summary (BB) | P1 | none | **BUILD** | 2 | ✅ **Done** |
| `events` | Events + news feed | P2 | none | Not useful | — | |
| `hero-journey` | TH journey: per-TH new items + cumulative pipeline/totals | P2 | none | **BUILD** | 3 | |
| `bases` | Base layout list (API) | P2 | text link share | **BUILD** (upgrade) | 4 | ✅ **Done** |
| `armies` | Current armies list (cards) | P2 | text link share | **BUILD** (upgrade) | 4 | ✅ **Done** |
| `war` | War roster/member progress | P3 | none | Consider | 6 | |
| `zapquaker` | Zapquaker planner | P3 | none | Consider (reuse pattern) | 6 | |
| `bob` | 6th-builder planner | P3 | none | Consider | 6 | |
| `giantarrow` | Giant Arrow / Rocket Backpack plan | P4 | **PNG share — exists** | Done (reference) | — | ✅ **Done** |
| `achievements` | Achievements list | P4 | none | Consider | 6 | |
| `saved` | Saved armies + bases (hub) | (hidden) | text link share | Consider | 7 | |
| `settings` | Settings / Export Data | (hidden) | JSON export via Share | Not useful | — | |

## Classifications

### Build (high value — user progress rendered nicely)

1. **Home — progress overview.** Flagship. Capture the overview stats + progress bars to a share card; include text snapshot (account, TH, totals). No permalink today. ✅ **Done**
2. **Maxtime — time-left summary.** Render remaining-time bars + totals as an image; add "as of HH:MM" freshness. ✅ **Done**
3. **Hero journey — pipeline view.** Captures the per-TH cumulative pipeline/totals nicely; strong "progress story" share.
4. **Armies & bases — view + link.** Upgrade existing text-only share to image of the (ArmyCard/BaseCard-style) view + permalink text. ✅ **Done**
5. **Army detail.** Share the loaded army build as an image + link.

### Consider (would be nice, lower urgency)

- **buildings** — per-building cost chain image for a single structure.
- **war** — clan war progress snapshot (member table + stars/total %).
- **zapquaker** — same capture pattern as giantarrow; trivial once hook exists.
- **bob** — builder-base completion progress bars.
- **achievements** — snapshot of recently/completed achievements.
- **saved** — management hub; keep text shares, optionally add card-image shares.
- **player (search pseudo-tab)** — not itself shareable; only feed into Home.

### Not useful

- **events** — third-party, ephemeral, no user progress.
- **settings** — UI only; data portability already covered by Export Data (JSON via Share).

## Roadmap

1. Build `useShareImage` hook + share-card base layout (branding, dark/light, watermark). ✅ **Done**
2. Home progress share (header button → capture overview view). ✅ **Done**
3. Maxtime share. ✅ **Done**
4. Hero-journey pipeline share. 🎯 **Next**
5. Armies/bases share upgrade (image + link). ✅ **Done**
6. Army-detail share.
7. Optional wave: war, bob, zapquaker, buildings, achievements, saved.
8. Optional: app-deep-link scheme (`clashprime://progress/...`) so these shares carry a "view in app" link, and/or hosted image links.

## Button placement (decision)

- Home: header action button (right of profile) → share overview card. ✅ **Done**
- Maxtime: header button, shares the whole summary view. ✅ **Done**
- Hero journey: header/section button → share current pipeline.
- Armies/bases/saved: per-card share action (upgrade existing) + optional list-header "share all". ✅ **Done**
- Army detail: share action in the detail header.

## Open questions

- Share-card branding: app watermark/footer on every image? Font (Clash font) vs system?
- Dark mode share card vs light, or follow theme?
- Progress/maxtime shares: attach a plain-text summary (no link) or omit text entirely?
- Deep links for progress/maxtime: do we want `clashprime://` links in shared text so recipients can open the same screen?
- Cost of scope: keep to the **Build** list first, then revisit **Consider** after user feedback on Home share.