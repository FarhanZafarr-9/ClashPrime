# Plans

Backlog of implementation plans picked up later. Each entry should be self-contained enough to resume without context.

---

## Troop level images from clash.ninja (PENDING)

**Status:** Idea stage — not started.

### Goal
Bundle per-level troop/hero/pet images so the Army tab can show level-aware sprites (troop aesthetics change as they level up), plus static images for spells, siege machines, and equipment.

### How clash.ninja images work
- Entity image URL: `https://www.clash.ninja/images/entities/<entityId>_<level>.png`
- Example: barbarian level 1 is `31_1.png`; levels `1..N` give each level's sprite.
- Only **troops, dark troops, heroes, pets** have cosmetic level changes.
- **Spells, siege machines, equipment** do NOT change with level — use a single image per entity (no `_level` variants needed).

### The blocker: entity ID mapping
- clash.ninja's *site data* (the entity ID ↔ unit name mapping) requires login — we can't scrape it.
- The image files themselves are public (no login to fetch PNGs).

### Options to build the mapping
1. **Manual paste (most reliable)** — user provides unit name → entity ID map once. ~1 minute of copying, no risk.
2. **Auto-probe (slightly risky)** — iterate a plausible entity ID range, fetch `entities/<id>_1.png`, and verify each hit against the official Clash API unit list (name + barracks/townhall availability) to auto-build the map. Images are public so this works without login, but ID collisions/verification edge cases are possible.
3. **Community mirrors** — repos like `clash-statistics`, `clashapi`, or clash-of-clans-data GitHub dumps already contain clash.ninja-compatible ID tables.

### Recommended approach
Start with option 2 (auto-discover + verify against API), then fill any gaps manually. If probing turns out flaky, fall back to option 1.

### Implementation sketch
- One-time CLI scraper (`scraper/download-troop-images.ts`) that:
  - builds the entity ID map (via chosen option above),
  - downloads all level images for cosmetic units (troops/dark troops/heroes/pets),
  - downloads single images for non-cosmetic units (spells/siege/equipment),
  - saves into `assets/troops/` (same pattern as `assets/buildings/`).
- Generate `src/data/troopImages.ts` mapping `clashApiName` + `level` → bundled asset (require).
- Army cards use level-aware lookup: `troopImages[name]?.[level] ?? troopImages[name]?.[base]`.
- Keep entity IDs in a static map so runtime never depends on network.

### Verification
- Every troop/hero/pet in the Clash API list resolves to an image for each of its levels.
- Spells/siege/equipment resolve to their single image.
- `npx tsc --noEmit` passes; Army tab shows correct level sprite.

### Notes
- Bundle size grows with ~level-count × unit-count images; acceptable given no runtime network cost.
- IDs are stable per unit, so the static map only needs updating when the game adds new units.
