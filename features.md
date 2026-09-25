# Features Plan

High-level plans for four planned utility features. This file decides **what** to build and **in what order**. Reference sites (fan content) are behavior references only; no code/text/assets copied.

Status legend: **Done** (shipped to the app), **Not started** (pending).

---

## Resolved questions (from research)

- **Earthquake stacking** — confirmed structure. EQ damage is a % of the building's **maximum** HP (not current), so spell order is irrelevant. 1st EQ = base `D%`; k-th (k≥2) = `D/(2k−1)` of max HP (2nd = 1/3, 3rd = 1/5, 4th = 1/7). m EQs deal `D% × Σ 1/(2k−1)`, a bounded series → EQ alone can **never** destroy a building (matches game behavior). Exact current `D` per level must come from data, not hardcoded.
- **"Dragon backpack"** = **Rocket Backpack**, Dragon Duke's first epic equipment (Apr 2026 Medal Event). Mechanic: choose a direction, Duke dashes in a straight line through the base center, breathing fire. Community-described as "a controllable Giant Arrow". **Shipped** as a second mode inside the Giant Arrow planner tab (mode selector). The dash is rendered as a line that always passes through a user-placed center pivot: place the Duke (entry), then the pivot (base center); the exit is the Duke mirrored across the pivot; dragging the Duke re-aims the line, touching the pivot clears it for re-placing. Band width still unverified (not rendered).
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

**Status:** Done — shipped in v6.1.0 as the **Zapquaker** tab. **Effort:** ~1 day.

Beyond the original scope, the tab now also supports:
- Fireball (Warden) and Giant Arrow (Queen) equipment as once-per-raid, no-slot hits with their own level steppers;
- the only double-damage pairing in the game: **Giant Arrow ×2 vs Air Defenses** (applied when the combo is sized against an Air Defense);
- multiple selected targets — the combo is sized against the highest-HP one, each building gets its own level stepper.

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

**Status:** Done — shipped in v6.1.0 as the **6th Builder** tab. **Effort:** ~4–6 days (largest).

**Scope v1 (shipped):** From the attached player profile (Skills reads `heroes`/`troops`/`buildingLevels`/`buildings` and `builderHallLevel` from the API + import merge — no new export UI), produce an ordered, resource-feasible plan for all seven unlock requirements:

1. Cannon gear-up (build Cannon Lv7 + Double Cannon Lv4 in BB, pay 1M HV Gold / 2d on a BB builder) — **manual checkbox** (gear-up status is not in the API);
2. Archer Tower gear-up (AT Lv10 + BB Archer Tower Lv6, 3M HV Gold / 7d) — **manual checkbox**;
3. Mortar gear-up (Mortar Lv8 + Multi Mortar Lv8, 6M HV Gold / 14d) — **manual checkbox**;
4. Troop research to lvl 18 (Star Lab Lv9 gate; lab deadline gates the plan);
5. Defence lvl 9 across the base;
6. Battle Machine + Battle Copter combined **45**;
7. B.O.B Control Lv5.

**Algorithm:** a `computeBobPlan(input)` pure function. Requirement steps resolved against `clash-of-clans-data` (gear-up recipes, building upgrade chains w/ floating + fixed costs + durations via `buildingUpgradeChainTimes`, per-copy BB store levels via `getBuildingCopies`, troop/hero level lists, `minBHallFor` gates). Two **active** machines modelled — **bb-builder** (auto count = 2@BH6, max 3) and **star-lab** — scheduled with the shared `scheduleChains` LPT list scheduler; `totalEtaSec = max(bb, lab)`. Resource layer: HV Gold / HV Elixir / BB Gold / BB Elixir totals + **storage-feasibility cascades**: total cost per BB currency must fit inside its storages (per-copy caps from `resourceBuildings()`, e.g. lvl-7 storage 1.2M ×2 at BH7); when a currency overflows, storage upgrades are auto-inserted into the builder chain **and each upgrade costs the alternating currency** (Gold Storage costs Builder Elixir, Elixir Storage costs Builder Gold), so the fixpoint keeps upgrading until the whole plan is affordable; storage-driven Builder-Hall demand feeds the BH gate too, and unreachable gaps surface as blocking callouts. **Clock Tower value** line = BB time × (max-cycle boost − current). A truncated schedule (top N) reduces noise for "fully maxed" profiles. Builder Hall gate chain inserted when steps demand a higher BH (only real buildings can gate — hero/troop steps were the source of a phantom "BH 7→11" chain).

**Constraints honoured from the plan:** HV builder slots are explicitly **not** consumed (gear-ups pull HV *gold*, not a Homie worker). Income curves / HV labour contention / storage-upgrade insertion are intentionally out of v1 (greedy callout notes instead).

**UI (shipped):** profile-gated EmptyState → requirement checklist (auto rows from player data + 3 manual gear-up toggles persisted to AsyncStorage), machine timeline grouped by bb-builder / star-lab with per-chain ETA + costs badges, resource chips, Clock Tower value card, "what is blocking you" (storage-cap + BH gates + builder-count + gear-up-pending callouts), footnotes (verify vs game version).

**Risks:** requirement set is **post-2.0** and unverified — checklist pinned to current data package, flags "verify post-2.0 requirements against the current client" in the footnotes; gear-up done-state is user-maintained (checkbox, local only); income modeling still unknown (v1 uses totals + storage caps, not curves); mixed-resource building upgrades (elixir/gold alternatives) resolved greedily.

---

## Feature 3 — Path planner (Giant Arrow / Rocket Backpack)

**Status:** Done — both modes shipped as the **Giant Arrow** planner tab (v6.1.0 + follow-up). **Effort:** ~1–2 days.

**Scope:** Upload a base screenshot, place markers, render the effect's straight-line path. Visualizer, not pathfinder (screenshot exposes no layout). Image stays on-device. **Shipped** without scale calibration or the tile-wide band — a center line + dashed arrow only.

**Inputs:** image; draggable markers; effect mode selector (Giant Arrow / Rocket Backpack).
**Data:** none external. Equipment params (band width, origin rule) as constants:
- Giant Arrow (AQ): from Queen, ~2 tiles wide, straight line (band not rendered).
- Rocket Backpack (Dragon Duke): dash passes through the base center — implemented as a **center pivot**: the exit is the Duke mirrored across the pivot, so the line always runs through the center. Band width + exact center rule unverified.

**Algorithm (shipped):** `PanResponder`-dragged pins over a `react-native-svg` overlay: vector origin→endpoint, center line + dashed stroke + arrowhead at the end. Rocket Backpack mode derives the exit from center+entry. No layout inference — visual guide only.

**UI (shipped):** image canvas, two draggable pins, an optional amber center pivot (Rocket Backpack), frozen mode icons in a mode selector, path color palette, fullscreen viewer, share as 3x PNG, auto-save/restore. Tap order in Rocket Backpack mode: place the Duke, then the pivot (exit auto-placed); a later tap resets both.
**Risks (carry-over):** crop/zoom skew a hypothetical band width (scale calibration would mitigate — not implemented); rotation/perspective distort tile counts; Rocket Backpack band width and exact center rule remain unverified.

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
| 1 | Zapquake (F1) | ~1d | **Done** — Zapquaker tab (v6.1.0). Logic + data layer. |
| 2 | Path planner (F3) | ~1–2d | **Done** — Giant Arrow tab, both modes (v6.1.0 + follow-up). Standalone, zero backend. |
| 3 | Clan snapshot collector (F4) | ~1d | **Next.** Start accumulating history now; UI later. |
| 4 | Clan analysis UI (F4) | ~2–3d | Builds on collector. |
| 5 | B.O.B. planner (F2) | ~4–6d | **Done** — 6th Builder tab (v6.1.0). Reused `gameData` + shared chain scheduler + per-copy building reader. |

**Open items to verify before building:** exact EQ damage %/stack values per current game level (structure confirmed; values from data, not wiki copy-paste) and Rocket Backpack dash width/center rule if mode 2 is wanted.