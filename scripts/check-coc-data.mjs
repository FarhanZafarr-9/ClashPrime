// Compares the installed clash-of-clans-data against the baseline recorded in
// scripts/coc-data-baseline.json.gz and reports what was added, removed or
// changed, with field-level diffs for anything that changed.
//
// The baseline stores every entity's full normalized value, gzipped (~130KB),
// so diffs are exact and work offline. `images` fields are excluded because they
// are asset paths rather than game data, and reordering keys is normalized away.
//
// Run `node scripts/check-coc-data.mjs --update` to accept the installed data.

import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = 'clash-of-clans-data';
const MAX_DIFFS_PER_ENTITY = 12;
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const baselinePath = path.join(rootDir, 'scripts', 'coc-data-baseline.json.gz');
const dataDir = path.join(rootDir, 'node_modules', PKG, 'data');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag('--help')) {
  console.log('Usage: node scripts/check-coc-data.mjs [options]\n');
  console.log('  --update        record the installed data as the new baseline');
  console.log('  --json          print the report as JSON');
  console.log('  --print <key>   dump one baseline entity, e.g. home/troops/thrower.json');
  process.exit(0);
}

function listJsonFiles(dir, prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listJsonFiles(path.join(dir, entry.name), rel));
    else if (entry.name.endsWith('.json')) out.push(rel);
  }
  return out;
}

function stripImages(value) {
  if (Array.isArray(value)) return value.map(stripImages);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => k !== 'images')
        .map(([k, v]) => [k, stripImages(v)])
    );
  }
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const labelOf = (value, key) => String(value?.name ?? value?.id ?? key);
const isEntityLike = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && ('name' in v || 'id' in v);

function collectRecords(dir) {
  const records = new Map();
  for (const rel of listJsonFiles(dir)) {
    const parsed = canonical(stripImages(JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'))));
    if (Array.isArray(parsed)) {
      parsed.forEach((el, i) => records.set(`${rel}#${i}`, { label: labelOf(el, `#${i}`), value: el }));
    } else if (parsed && typeof parsed === 'object') {
      if (typeof parsed.name === 'string') {
        records.set(rel, { label: parsed.name, value: parsed });
      } else {
        for (const [key, val] of Object.entries(parsed)) {
          if (Array.isArray(val) && val.length > 0 && val.every(isEntityLike)) {
            val.forEach((el) => {
              const id = String(el.id ?? el.name ?? '');
              records.set(`${rel}#${key}/${id}`, { label: labelOf(el, id), value: el });
            });
          } else {
            records.set(`${rel}#${key}`, { label: key, value: val });
          }
        }
      }
    } else {
      records.set(rel, { label: rel, value: parsed });
    }
  }
  return records;
}

function show(value) {
  if (value === undefined) return '(absent)';
  if (value !== null && typeof value === 'object') {
    return Array.isArray(value)
      ? `[${value.length} items]`
      : `{${Object.keys(value).length} keys}`;
  }
  const s = JSON.stringify(value);
  if (s === undefined) return String(value);
  return s.length > 60 ? `${s.slice(0, 57)}...` : s;
}

function diffValues(oldValue, newValue, prefix, out) {
  if (out.length >= MAX_DIFFS_PER_ENTITY || Object.is(oldValue, newValue)) return;
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    for (let i = 0; i < Math.max(oldValue.length, newValue.length); i++) {
      diffValues(oldValue[i], newValue[i], `${prefix}[${i}]`, out);
    }
    return;
  }
  const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  if (plain(oldValue) && plain(newValue)) {
    const at = (key) => (prefix ? `${prefix}.${key}` : key);
    for (const key of [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort()) {
      if (!(key in oldValue)) out.push({ path: at(key), old: undefined, new: newValue[key] });
      else if (!(key in newValue)) out.push({ path: at(key), old: oldValue[key], new: undefined });
      else diffValues(oldValue[key], newValue[key], at(key), out);
    }
    return;
  }
  out.push({ path: prefix || '(root)', old: oldValue, new: newValue });
}

function groupBySection(keys) {
  const groups = new Map();
  for (const key of keys) {
    const section = key.split('/')[0];
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(key);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const plural = (n, singular, many = `${singular}s`) => `${n} ${n === 1 ? singular : many}`;

const installedVersion = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'node_modules', PKG, 'package.json'), 'utf8')
).version;
const current = collectRecords(dataDir);

if (flag('--update')) {
  const payload = Buffer.from(
    `${JSON.stringify({ package: PKG, version: installedVersion, records: Object.fromEntries(current) })}\n`
  );
  fs.writeFileSync(baselinePath, gzipSync(payload, { level: 9 }));
  if (!flag('--json')) {
    console.log(
      `Baseline recorded for ${PKG}@${installedVersion}: ${plural(current.size, 'entity', 'entities')} -> ${path.relative(rootDir, baselinePath)} (${(fs.statSync(baselinePath).size / 1024).toFixed(0)}KB)`
    );
  }
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error('No baseline found. Run `npm run sync:coc-data:accept` once to record the current data.');
  process.exit(1);
}

const baseline = JSON.parse(gunzipSync(fs.readFileSync(baselinePath)).toString('utf8'));
const before = baseline.records ?? {};

const wanted = option('--print');
if (wanted) {
  const key = Object.keys(before).find((k) => k === wanted || k.endsWith(wanted));
  if (!key) {
    console.error(`No baseline entity matching "${wanted}". Try --print home/troops/thrower.json`);
    process.exit(1);
  }
  console.log(JSON.stringify(before[key].value, null, 2));
  process.exit(0);
}

const added = [...current.keys()].filter((k) => !(k in before));
const removed = Object.keys(before).filter((k) => !current.has(k));
const changed = [...current.keys()].filter((k) => before[k] && digest(before[k].value) !== digest(current.get(k).value));

const details = {};
for (const key of changed) {
  const diffs = [];
  diffValues(before[key].value, current.get(key).value, '', diffs);
  if (diffs.length > 0) details[key] = diffs;
}

const report = {
  package: PKG,
  from: baseline.version,
  to: installedVersion,
  entities: current.size,
  added: added.map((k) => ({ key: k, label: current.get(k).label })),
  removed: removed.map((k) => ({ key: k, label: before[k].label })),
  changed: changed.map((k) => ({ key: k, label: current.get(k).label })),
  details,
};

if (flag('--json')) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${PKG} ${baseline.version} -> ${installedVersion}   (${plural(current.size, 'entity', 'entities')}, images excluded)\n`);

const listSection = (title, entries, sign) => {
  if (entries.length === 0) return;
  console.log(`${title} (${entries.length})`);
  const byKey = new Map(entries.map((e) => [e.key, e]));
  for (const [section, keys] of groupBySection(entries.map((e) => e.key))) {
    console.log(`  ${section}/`);
    for (const key of [...keys].sort()) {
      const entry = byKey.get(key);
      console.log(`    ${sign} ${pad(entry.key.split('#')[0].replace(`${section}/`, ''), 36)} ${entry.label}`);
    }
  }
  console.log('');
};

listSection('ADDED', report.added, '+');
listSection('REMOVED', report.removed, '-');

if (changed.length > 0) {
  console.log(`CHANGED (${changed.length})`);
  for (const key of changed.sort()) {
    const label = current.get(key).label;
    console.log(`  ~ ${key}${key.endsWith('.json') ? '' : `  (${label})`}`);
    for (const d of details[key] ?? []) {
      console.log(`      ${pad(d.path, 42)} ${show(d.old)} -> ${show(d.new)}`);
    }
    if ((details[key]?.length ?? 0) >= MAX_DIFFS_PER_ENTITY) {
      console.log(`      ...truncated at ${MAX_DIFFS_PER_ENTITY} field changes`);
    }
  }
  console.log('');
}

const total = added.length + removed.length + changed.length;
console.log(
  total === 0
    ? 'No gameplay data changes.\n'
    : `${plural(total, 'entity', 'entities')} changed: ${added.length} added, ${removed.length} removed, ${changed.length} changed.\n`
);