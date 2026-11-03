import type { ImportedUpgrade } from '../types/importedUpgrade';

type TrackedWork = Pick<ImportedUpgrade, 'kind' | 'village' | 'name' | 'storeName' | 'completesAt' | 'confirmed'>;

export function upgradeAvailability(rows: readonly TrackedWork[], builderCount: number | null, now = Date.now()) {
  const home = rows.filter(row => row.village === 'home' && !row.confirmed && Number.isFinite(row.completesAt) && row.completesAt > now);
  const known = home.every(row => row.kind != null && row.kind !== 'other');
  const busy = home.filter(row => row.kind === 'buildings' || row.kind === 'heroes').length;
  const validCapacity = builderCount != null && Number.isInteger(builderCount) && builderCount >= 2 && builderCount <= 6;
  const research = home.some(row => row.kind === 'troops' || row.kind === 'spells');
  const labUpgrading = home.some(row => row.kind === 'buildings' && /^(lab|laboratory)$/i.test(row.storeName ?? row.name));
  return {
    freeBuilders: known && validCapacity ? Math.max(0, builderCount! - busy) : null,
    labIdle: known ? !research && !labUpgrading : null,
  };
}
