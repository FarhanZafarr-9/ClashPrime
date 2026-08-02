# Plans

Backlog of implementation plans picked up later. Each entry should be self-contained enough to resume without context.

---

## Troop level images from clash.ninja (IN PROGRESS)

**Status:** Mapping resolved + URL-based rendering implemented — bundling explicitly deferred.

### Goal
Bundle per-level troop/hero/pet images so the Army tab can show level-aware sprites (troop aesthetics change as they level up), plus static images for spells, siege machines, and equipment.

### How clash.ninja images work
- Entity image URL: `https://www.clash.ninja/images/entities/<entityId>_<level>.png`
- Example: barbarian level 1 is `31_1.png`; levels `1..N` give each level's sprite.
- **Level-suffixed** (`{id}_{level}.png`): Troops, Dark Troops, Siege Machines — always.
- **Static** (`{id}.png`): Spells, Heroes, Hero Equipment, Pets — almost always.
- **Exceptions**: Angry Spell (281), Electro Fangs (279), Ruin Witch (282) use level-suffixed icons despite their categories being otherwise static (their category images can still be accessed without a level suffix).

### Entity ID mapping — RESOLVED
- clash.ninja's *site data* (the entity ID ↔ unit name mapping) requires login, so it can't be scraped.
- The user manually provided the full reference (option 1, ~150 entities across all categories).
- Saved as `src/data/entityReference.ts` with helpers:
  - `ENTITY_REFERENCE` — all entities with `name`, `id`, `category`, `levelSuffix`, `heroId` (equipment only).
  - `entityImageUrl(name, level?)` — builds the clash.ninja URL (handles the `_level` suffix).
  - `entityRef(name)` — lookup by Clash API display name.
- Update this file (not the plan) when new units are added.

### Chosen approach: URL-based (implemented)
- `src/utils/troopImages.ts` now prefers `entityImageUrl(name, level?)` (clash.ninja CDN) and falls back to Fandom URLs for anything not in the reference (e.g. super troops, retired equipment).
- Level-aware sprites: Army tab passes the unit's current level to `getTroopImageUrl(name, level)` for troops, dark troops, and siege machines. Heroes/pets/spells/equipment use static entity images.
- Caching: same as existing pattern — `Image.prefetch` on render + React Native's built-in disk cache → offline after first view.
- No bundling for now: ~300-400 PNGs would add several MB to the app, and bundled sprites go stale on game updates.

### Deferred: offline-first bundling (only if needed later)
- One-time CLI scraper (`scraper/download-troop-images.ts`) that:
  - reads `ENTITY_REFERENCE`,
  - downloads level-suffixed images (`_1`..`_N`) for `levelSuffix` entities,
  - downloads single images for static entities,
  - saves into `assets/troops/` (same pattern as `assets/buildings/`).
- Generate `src/data/troopImages.ts` mapping `clashApiName` + `level` → bundled asset (require).
- Army cards use level-aware lookup: `troopImages[name]?.[level] ?? troopImages[name]?.[base]`.

### Verification
- Every troop/hero/pet in the Clash API list resolves to an image for each of its levels.
- Spells/siege/equipment resolve to their single image.
- `npx tsc --noEmit` passes; Army tab shows correct level sprite.

### Notes
- IDs are stable per unit, so the static map only needs updating when the game adds new units.
