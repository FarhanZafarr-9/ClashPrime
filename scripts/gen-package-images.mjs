import { home, builder, magicItems as magicItemsApi } from 'clash-of-clans-data';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outPath = join(root, 'src', 'data', 'packageImages.ts');
const localImagesDir = join(root, 'assets', 'package-images');

if (!existsSync(localImagesDir)) {
  mkdirSync(localImagesDir, { recursive: true });
}

const pkgRoot = join(root, 'node_modules', 'clash-of-clans-data');

async function ensureWebp(pkgRelPath) {
  const src = join(pkgRoot, pkgRelPath);
  const dstRel = pkgRelPath.replace(/\.png$/i, '.webp');
  const dst = join(localImagesDir, dstRel);
  const dstDir = dirname(dst);
  if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true });
  if (!existsSync(dst)) {
    // Much of the package (all of images/home/crafted-defenses) ships WebP bytes
    // under a .png name. sharp sniffs the extension here and rejects those, so
    // check the RIFF/WEBP header and copy the bytes as-is; only genuinely
    // non-WebP sources get re-encoded.
    const buf = readFileSync(src);
    const isWebp =
      buf.length > 12 &&
      buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
      buf.subarray(8, 12).toString('latin1') === 'WEBP';
    if (isWebp) {
      writeFileSync(dst, buf);
    } else {
      try {
        await sharp(src).webp().toFile(dst);
      } catch {
        // A few upstream files are not images at all — e.g.
        // images/home/crafted-defenses/light-beam/normal/level-3.png is a saved
        // 404 HTML page. Skip those instead of failing the whole run.
        console.warn(`skipping unreadable package image: ${pkgRelPath}`);
        return null;
      }
    }
  }
  return `../../assets/package-images/${dstRel}`;
}

const addTo = (map, list, name, icon, levels) => {
  if (map.has(name)) {
    // Same display name exists in both villages (e.g. "Baby Dragon"): merge the
    // level sprites (first wins per level) and keep the first icon.
    const existing = map.get(name);
    for (const k of Object.keys(levels)) if (!(k in existing.levels)) existing.levels[k] = levels[k];
    return;
  }
  const entry = { name, icon, levels };
  map.set(name, entry);
  list.push(entry);
};

// Some entries point at a neighbouring level's sprite (upstream data quirk, e.g.
// Dark Barracks 13 -> level-12.png). Prefer the level-matching file when the
// package ships one for that level; otherwise keep the pointer (sprite reuse).
const levelSprite = (p, level) => {
  const m = /^(.*\/)?level-(\d+)(\.png)$/i.exec(p);
  if (m && Number(m[2]) !== level) {
    const correct = `${m[1] ?? ''}level-${level}.png`;
    if (existsSync(join(pkgRoot, correct))) return correct;
  }
  return p;
};

const homeEntries = [];
const builderEntries = [];
const builderTroopEntries = [];
const craftedEntries = [];
const homeByName = new Map();
const builderByName = new Map();
const builderTroopByName = new Map();

const collect = (items) => {
  for (const it of items) {
    const levels = {};
    for (const l of it.levels ?? []) {
      const p = l.images?.normal;
      if (p && !levels[String(l.level)]) levels[String(l.level)] = levelSprite(p, l.level);
    }
    addTo(homeByName, homeEntries, it.name, it.images?.icon ?? null, levels);
    if (it.superTroop?.name && it.superTroop.images) {
      const sl = {};
      for (const l of it.superTroop.levels ?? []) {
        const p = l.images?.normal;
        if (p && !sl[String(l.level)]) sl[String(l.level)] = p;
      }
      addTo(homeByName, homeEntries, it.superTroop.name, it.superTroop.images.icon ?? null, sl);
    }
  }
};

const collectBuilderTroops = (items) => {
  for (const it of items) {
    const levels = {};
    for (const l of it.levels ?? []) {
      const p = l.images?.normal;
      if (p && !levels[String(l.level)]) levels[String(l.level)] = levelSprite(p, l.level);
    }
    addTo(builderTroopByName, builderTroopEntries, it.name, it.images?.icon ?? null, levels);
  }
};

const collectBuilding = (items) => {
  for (const it of items) {
    const levels = {};
    for (const l of it.levels ?? []) {
      const p = l.images?.normal;
      if (p && !levels[String(l.level)]) levels[String(l.level)] = levelSprite(p, l.level);
    }
    const keys = Object.keys(levels);
    addTo(homeByName, homeEntries, it.name, keys.length ? levels[keys[0]] : null, levels);
  }
};

const collectBuilderBuilding = (items) => {
  for (const it of items) {
    const levels = {};
    for (const l of it.levels ?? []) {
      const p = l.images?.normal;
      if (p && !levels[String(l.level)]) levels[String(l.level)] = levelSprite(p, l.level);
    }
    const keys = Object.keys(levels);
    addTo(builderByName, builderEntries, it.name, keys.length ? levels[keys[0]] : null, levels);
  }
};

// Crafted defenses are not flat per-level buildings: a defense's level is the sum of
// its module levels, and the package ships one sprite per *range* of that total
// (e.g. 3-11, 12-20, 21-29, 30). Key each tier by the first effective level of its
// range so the caller can pick the tier containing a given total.
const collectCraftedDefenses = (items) => {
  for (const it of items ?? []) {
    const tiers = {};
    for (const im of it.images ?? []) {
      if (!im.normal) continue;
      const key = String(im.fromEffectiveLevel);
      if (!tiers[key]) tiers[key] = im.normal;
    }
    const keys = Object.keys(tiers);
    if (keys.length) craftedEntries.push({ name: it.name, icon: tiers[keys[0]], levels: tiers });
  }
};

const hh = home();
const bb = builder();
collect(hh.troops().get());
collect(hh.spells().get());
collect(hh.pets().get());
collect(hh.heroes().get());
collect(hh.heroEquipment().get());
collect(hh.siegeMachines().get());
collect(bb.troops().get());
collect(bb.heroes().get());

collectBuilding(hh.townHall().get());
collectBuilding(hh.defenses().get());
collectBuilding(hh.resourceBuildings().get());
collectBuilding(hh.resourceBuildings().clanCastle().get());
collectBuilding(hh.otherBuildings().helperHut().get());
collectBuilding(hh.armyBuildings().armyCamp().get());
collectBuilding(hh.armyBuildings().barracks().get());
collectBuilding(hh.armyBuildings().darkBarracks().get());
collectBuilding(hh.armyBuildings().laboratory().get());
collectBuilding(hh.armyBuildings().spellFactory().get());
collectBuilding(hh.armyBuildings().darkSpellFactory().get());
collectBuilding(hh.armyBuildings().heroHall().get());
collectBuilding(hh.armyBuildings().blacksmith().get());
collectBuilding(hh.armyBuildings().workshop().get());
collectBuilding(hh.armyBuildings().petHouse().get());
collectBuilding(hh.traps().get());
collectBuilding(hh.walls().get());

collectBuilderBuilding(bb.defenses().get());
collectBuilderBuilding(bb.resourceBuildings().get());
collectBuilderBuilding(bb.armyBuildings().get());
collectBuilderBuilding(bb.otherBuildings().get());
collectBuilderBuilding(bb.traps().get());
collectBuilderBuilding(bb.walls().get());
collectBuilderBuilding(bb.builderHall().get());

collectCraftedDefenses(hh.craftedDefenses ? hh.craftedDefenses().get() : []);

// Builder troops/heroes keep their own village sprites (separate from the
// name-merged home map) so shared display names like "Baby Dragon" still show
// their Builder Base visuals.
collectBuilderTroops(bb.troops().get());
collectBuilderTroops(bb.heroes().get());

// Resource icons live outside the item APIs (images/other/*.png and images/other/ore/*.png).
const resourceFiles = [
  ['Gold', 'gold'],
  ['Elixir', 'elixir'],
  ['Dark Elixir', 'dark-elixir'],
  ['Builder Gold', 'gold-b'],
  ['Builder Elixir', 'elixir-b'],
  ['Shiny Ore', 'ore/shiny-ore'],
  ['Glowing Ore', 'ore/glowy-ore'],
  ['Starry Ore', 'ore/starry-ore'],
];

// The combined "X or Y" resource art is not shipped by clash-of-clans-data, so it is
// referenced straight from the repo copy instead of being copied/converted.
const localResourceFiles = [
  ['Gold or Elixir', 'images/other/goldelxir.png'],
  ['Builder Gold or Builder Elixir', 'images/other/goldelxir_b.webp'],
];

// Builder Base league badges (images/builder/leagues/*.png) ship separately from
// the item APIs and go into their own map keyed by league name.
const bbLeagueEntries = bb
  .leagues()
  .get()
  .filter((l) => l.image)
  .sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

// Magic items are exposed via magicItems() with per-type queries (books/hammers/potions/snacks/utilities).
const magicItemEntries = [];
{
  const groups = magicItemsApi();
  for (const g of ['books', 'hammers', 'potions', 'snacks', 'utilities']) {
    for (const it of groups[g]().get()) {
      if (it.image && !magicItemEntries.some((e) => e.name === it.name)) {
        magicItemEntries.push({ name: it.name, image: it.image });
      }
    }
  }
}

async function req(p) {
  if (!p) return '0';
  const localPath = await ensureWebp(p);
  return localPath ? `require('${localPath}')` : '0';
}

async function generate() {
  const lines = [];
  lines.push('// AUTO-GENERATED by scripts/gen-package-images.mjs — do not edit by hand.');
  lines.push('// Regenerate after updating clash-of-clans-data with: npm run gen:images');
  lines.push('');
  lines.push('export interface PackageItemImages {');
  lines.push('  icon: number;');
  lines.push('  levels: Record<string, number>;');
  lines.push('}');
  lines.push('');
  for (const [constName, entries] of [['PACKAGE_IMAGES', homeEntries], ['PACKAGE_BUILDER_IMAGES', builderEntries], ['PACKAGE_BUILDER_TROOP_IMAGES', builderTroopEntries], ['PACKAGE_CRAFTED_IMAGES', craftedEntries]]) {
    lines.push(`export const ${constName}: Record<string, PackageItemImages> = {`);
    for (const e of entries) {
      lines.push(`  ${JSON.stringify(e.name)}: {`);
      lines.push(`    icon: ${await req(e.icon)},`);
      const keys = Object.keys(e.levels);
      if (keys.length) {
        lines.push('    levels: {');
        for (const k of keys) lines.push(`      ${JSON.stringify(k)}: ${await req(e.levels[k])},`);
        lines.push('    },');
      } else {
        lines.push('    levels: {},');
      }
      lines.push('  },');
    }
    lines.push('};');
    lines.push('');
  }

  lines.push('export const PACKAGE_RESOURCE_IMAGES: Record<string, number> = {');
  for (const [name, file] of resourceFiles) {
    lines.push(`  ${JSON.stringify(name)}: ${await req(`images/other/${file}.png`)},`);
  }
  for (const [name, file] of localResourceFiles) {
    lines.push(`  ${JSON.stringify(name)}: require('../../assets/package-images/${file}'),`);
  }
  lines.push('};');
  lines.push('');

  lines.push('export const PACKAGE_MAGIC_ITEM_IMAGES: Record<string, number> = {');
  for (const e of magicItemEntries) {
    lines.push(`  ${JSON.stringify(e.name)}: ${await req(e.image)},`);
  }
  lines.push('};');
  lines.push('');

  lines.push('export const BB_LEAGUE_IMAGES: Record<string, number> = {');
  for (const e of bbLeagueEntries) {
    lines.push(`  ${JSON.stringify(e.name)}: ${await req(e.image)},`);
  }
  lines.push('};');
  lines.push('');

  writeFileSync(outPath, lines.join('\n'));
  console.log(`Wrote ${outPath} (${homeEntries.length} home + ${builderEntries.length} builder items, ${magicItemEntries.length} magic items, ${bbLeagueEntries.length} builder base leagues)`);
}

generate().catch((err) => { console.error(err); process.exit(1); });
