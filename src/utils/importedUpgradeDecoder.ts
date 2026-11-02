import { COC_UNIT_IDS } from '../data/cocUnitIds';
import { COC_HOME_BUILDING_IDS, COC_BUILDER_BUILDING_IDS, COC_CRAFTED_MODULE_IDS } from '../data/cocBuildingIds';
import { toStoreName } from './buildingCopies';
import { isBuilderName } from './buildingData';
import type { ImportedUpgrade } from '../types/importedUpgrade';

export function exportSnapshotAt(raw: unknown, now = Date.now()): number {
  const numeric = typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
  const parsed = typeof numeric === 'number' ? (numeric < 1e12 ? numeric * 1000 : numeric) : typeof raw === 'string' ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : now;
}

/** Export timers are seconds remaining at the snapshot, never at paste time. */
export function decodeImportedUpgrades(data: Record<string, unknown>, now = Date.now()): ImportedUpgrade[] {
  const snapshotAt = exportSnapshotAt(data.timestamp, now);
  const rows: ImportedUpgrade[] = [];
  const ordinals = new Map<string, number>();
  const visit = (value: unknown, source: string, parent = '') => {
    if (Array.isArray(value)) { value.forEach(v => visit(v, source, parent)); return; }
    if (!value || typeof value !== 'object') return;
    const entry = value as Record<string, unknown>;
    const id = typeof entry.data === 'number' ? entry.data : NaN;
    const unit = COC_UNIT_IDS[id];
    const builder = source.endsWith('2') || unit?.village === 'builderBase';
    const rawBuilding = (builder ? COC_BUILDER_BUILDING_IDS : COC_HOME_BUILDING_IDS)[id];
    const building = rawBuilding ? (builder && !isBuilderName(rawBuilding) ? `BB ${rawBuilding === 'Wall' ? 'Walls' : rawBuilding}` : rawBuilding) : undefined;
    const moduleName = COC_CRAFTED_MODULE_IDS[id];
    const name = unit?.name ?? building ?? (moduleName ? `${parent} · ${moduleName}` : `Unknown upgrade (${id})`);
    if (Number.isFinite(id) && typeof entry.timer === 'number' && Number.isFinite(entry.timer) && entry.timer > 0) {
      const level = typeof entry.lvl === 'number' && Number.isFinite(entry.lvl) ? Math.max(0, entry.lvl) : 0;
      const kind = unit?.kind ?? (building ? 'buildings' : 'other');
      const village = builder ? 'builderBase' : 'home';
      const key = `${village}:${source}:${id}:${level}:${parent}`;
      const copy = ordinals.get(key) ?? 0;
      ordinals.set(key, copy + 1);
      rows.push({ id: `${key}:${copy}`, dataId: id, kind, village, name, storeName: building ? toStoreName(building) : undefined, level, targetLevel: level + 1, copy, baselineTargetCopies: 0, completesAt: snapshotAt + entry.timer * 1000, snapshotAt });
    }
    for (const [key, child] of Object.entries(entry)) {
      if (Array.isArray(child)) visit(child, source, building ?? parent ?? key);
    }
  };
  for (const [key, value] of Object.entries(data)) if (Array.isArray(value)) visit(value, key);
  // Preserve how many copies already exceeded this level in the snapshot.
  // Confirmations then advance only the outstanding copies, even when confirmed out of order.
  for (const row of rows.filter(r => r.kind === 'buildings')) {
    for (const [source, entries] of Object.entries(data)) {
      if (!Array.isArray(entries) || (source.endsWith('2') ? 'builderBase' : 'home') !== row.village) continue;
      for (const entry of entries) {
        if (entry?.data === row.dataId && typeof entry.lvl === 'number' && entry.lvl >= row.targetLevel) row.baselineTargetCopies += typeof entry.cnt === 'number' ? entry.cnt : 1;
      }
    }
  }
  return rows.sort((a, b) => a.completesAt - b.completesAt);
}
