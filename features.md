# Features Plan

High-level plans for four planned utility features. No implementation yet — this file decides **what** to build and **in what order**. Reference sites (fan content) are behavior references only; no code/text/assets copied.

Status legend: **Not started** for all four.

---

## Resolved questions (from research)

- **Earthquake stacking** — confirmed structure. EQ damage is a % of the building's **maximum** HP (not current), so spell order is irrelevant. 1st EQ = base `D%`; k-th (k≥2) = `D/(2k−1)` of max HP (2nd = 1/3, 3rd = 1/5, 4th = 1/7). m EQs deal `D% × Σ 1/(2k−1)`, a bounded series → EQ alone can **never** destroy a building (matches game behavior). Exact current `D` per level must come from data, not hardcoded.
- **"Dragon backpack"** = **Rocket Backpack**, Dragon Duke's first epic equipment (Apr 2026 Medal Event). Mechanic: choose a direction, Duke dashes in a straight line through the base center, breathing fire. Community-described as "a controllable Giant Arrow". Same path-planner tool applies as a second mode with different params. Params unverified (band width, center rule).
- **Clan IP binding** — no new backend strictly required: the app already routes CoC API through the RoyaleAPI proxy (dynamic-IP safe, `src/api/clash.ts`).

---

## Shared architecture (prerequisite)

- **Runtime:** all four features live in the existing Expo app. Clan analysis may later get an optional cron worker; v1 is app-side polling.
- **`gameData` module (`src/data/gameData.ts`)** — typed accessor over `clash-of-clans-data` (canonical): `buildingHP(type, level)`, `spellDamage(name, level)`, `spellHousing(name)`, `upgradeCost/Time(type, level)`, `storageCap(type, level)`, prerequisites. All features read from it. Scrapers (clash.ninja pattern) only fill package gaps. **Never hardcode game constants.**
- **Caching:** in-memory + AsyncStorage, stale-while-revalidate (existing 30-min ClashArmies pattern). `currentwar` caches at ~5 min (must not go stale).
- **Validation:** zod schemas for API payloads and the export JSON (export format drifts between game versions — riskiest input).
- **Scheduler:** generalize `src/utils/upgradeCosts` chain scheduler into a shared multi-machine list scheduler (used by Import/Export now, B.O.B planner later).

---

## Feature 1 — Zapquake calculator

**Status:** Not started. **Effort:** ~1 day.

**Scope:** Given a target building (type + level, or raw HP) and spell levels, list every (Lightning×n, EQ×m) combination that destroys it, with housing cost. Pure function + screen.

**Inputs:** building type+level or raw HP; Lightning level; EQ level; optional spell-capacity cap and "already damaged %".
**Data:** `clash-of-clans-data` — per-level building HP, Lightning total damage, EQ building-damage %, `housingSpace` for both spells (do not hardcode — rebalances happen).

**Algorithm:**
1. Destroy condition: `LightningDamage×n + D×H(m)×maxHP ≥ maxHP`, where `H(m) = Σ_{k=1..m} 1/(2k−1)`.
2. Order is irrelevant (EQ is max-HP based) — no permutation handling needed.
3. Enumerate `n,m` under spell capacity; sort by housing; mark minimum-cost combo.

**UI:** building picker (type+level or manual HP), spell-level steppers, result list (`2 EQ + 3 LGT · 7 housing · 12% overkill`), highlighted cheapest.
**Risks:**
- EQ %/stack numbers are from wiki; verify against current game version, keep as data constant.
- Lightning splits damage across multiple buildings in its radius — single-target assumption v1, flag later.
- Storages are EQ-immune — exclude from picker.
- Builder-hut repair ticks at the margin → "safety margin" toggle in v2.

---

## Feature 2 — 6th builder (B.O.B.) planner

**Status:** Not started. **Effort:** ~4–6 days (largest).

**Scope:** From village export, produce an ordered, resource-feasible schedule for all seven unlock requirements (3 gear-ups, troop lvl 18, defence lvl 9, BM+Copter 45 combined, B.O.B Control lvl 5). Deeper than ClashClock: resources, storage caps, lab/builder parallelism, Clock Tower impact.

**Inputs:** existing CoC JSON export (Import/Export tab already parses HV + BB buildings incl. per-copy levels — reuse verbatim; B.O.B Control level comes from there). Optional: TH/BH targets, gem budget, income-rate sliders.
**Data:** `clash-of-clans-data` per-level costs/durations for all involved buildings, troops, hero, B.O.B Control, gear-up recipes, storage caps, Star Lab/BH prerequisites. Verify post-2.0 requirement names/levels against current client.

**Algorithm:**
1. Dependency graph: node = one upgrade step; edges = prerequisites (level chains, TH/BH/Star Lab gates, gear-up chains); weights = cost + duration + resource type + owning machine.
2. Four parallel machines: HV builders (N), HV lab, BB builder (auto 2 at BH6, max 3), BB Star Lab. Multi-machine list scheduling on top of generalized `upgradeCosts` chain scheduler.
3. Resource layer: HV gold/elixir/dark and BB gold/elixir as separate currencies; income model (tunable sliders) vs storage caps → detect resource-starved waits, insert storage upgrades; gear-ups pull HV gold but occupy a BB builder slot → cross-village contention (the gap vs ClashClock).
4. Clock Tower: periodic boost multiplier during boost window per level applied to BB durations → total days saved per level surfaced as a "Clock Tower value" line.
5. Output: Gantt per machine + start/end day, total days, resource timeline, bottleneck annotations.

**UI:** requirement checklist (current → needed, cost, owner), timeline grouped by machine, resource curves, "what's blocking you" callouts.
**Risks:** requirement rework/version drift; income modeling is guesswork (tunable, never hardcoded); BB2.0 builder-count rules; exact scheduling is NP-hard — list scheduling is fine for ~40 nodes, don't over-engineer; export JSON schema drift (validate).

---

## Feature 3 — Path planner (Giant Arrow / Rocket Backpack)

**Status:** Not started. **Effort:** ~1–2 days.

**Scope:** Upload a base screenshot, place origin + direction markers, render the effect's tile-wide path with scale calibration. Visualizer, not pathfinder (screenshot exposes no layout). Image stays on-device.

**Inputs:** image; two draggable markers (origin, direction/endpoint); scale calibration (mark a known footprint — TH is 4×4 → tiles-per-pixel); effect mode selector.
**Data:** none external. Equipment params (band width, origin rule) as constants:
- Giant Arrow (AQ): from Queen, ~2 tiles wide, straight line.
- Rocket Backpack (Dragon Duke): user picks entry direction, line passes through base center (params unverified).

**Algorithm:** pointer-driven canvas overlay via `react-native-gesture-handler` + `react-native-svg` (both in stack). Vector origin→direction; center line + perpendicular half-width band using calibrated tiles-per-pixel. No layout inference — visual guide only.

**UI:** image canvas, two draggable pins, direction indicator, calibrated band, stale-calibration warning, export/screenshot overlay.
**Risks:** crop/zoom skew the band width (scale calibration mitigates — the reference site's known flaw); rotation/perspective distort tile counts; Rocket Backpack mechanics unverified — ship Giant Arrow first, add mode 2 as cheap param later.

---

## Feature 4 — Clan analysis

**Status:** Not started. **Effort:** ~3–4 days (collector ~1d, UI ~2–3d).

**Scope:** Per-player war participation history (attacks used/missed, stars, destruction, attacking up/down), CWL + Capital raid participation, donations, activity trends. **Start snapshotting early — history only accumulates once captured.**

**Inputs:** clan tag; existing API token (stored); member roster from `/clans/{tag}/members`.
**Data source:** official API — `/currentwar` (per-player attack detail lives only here), `/warlog` (aggregates only), `/currentwar/leaguegroup` (CWL rounds), `/capitalraidseasons`, `/members`.

**Algorithm (ETL):** while a war is open, snapshot `/currentwar` every ~5 min; on "ended", store final state; optionally backfill aggregates from warlog. Per war per player: attacks used/missed, per-attack stars + destruction, opponent TH from same payload → attacking up/down (TH diff). CWL: walk `leaguegroup.rounds` per day. Capital: `/capitalraidseasons` per-member attacks/loot per season. Donations/activity: periodic `/members` snapshots → delta series for trends. Cache roster snapshots (join/leave attribution).

**UI:** leaderboard per war with up/down badges; per-player trend sparklines; season rollup; CSV export.
**Risks:** per-player history is forward-only (start early); API rate limits (throttle poller); roster churn (snapshot roster to attribute); leaguegroup is large (cache); app-only polling is best-effort if user offline during wars → optional later cron worker.

---

## Build order

Rough effort estimates; recommended sequence (value/dependency aware, not just cheapest-first).

| # | Step | Effort | Why now |
|---|------|--------|---------|
| 0 | `gameData` module | ~0.5d | Prerequisite for features 1 and 4. |
| 1 | Zapquake (F1) | ~1d | Pure logic, tests the data layer, low risk, fast win. |
| 2 | Path planner (F3) | ~1–2d | Standalone, zero backend. Giant Arrow mode first. |
| 3 | Clan snapshot collector (F4) | ~1d | Start accumulating history now; UI later. |
| 4 | Clan analysis UI (F4) | ~2–3d | Builds on collector. |
| 5 | B.O.B. planner (F2) | ~4–6d | Reuses gameData + generalized scheduler + export importer. Last by design. |

**Open items to verify before building:** exact EQ damage %/stack values per current game level (structure confirmed; values from data, not wiki copy-paste) and Rocket Backpack dash width/center rule if mode 2 is wanted.