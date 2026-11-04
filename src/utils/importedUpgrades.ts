import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImportedUpgrade } from '../types/importedUpgrade';
import type { CocImportResult } from '../utils/cocExport';
import { cancelUpgradeAlert, scheduleUpgradeAlert, requestPermission } from '../hooks/useReminders';
import { notificationAccountName } from './notificationAccountName';

interface Snapshot { snapshotAt: number; timestampKnown?: boolean; rows: ImportedUpgrade[] }
const listeners = new Set<() => void>();
let pending: Promise<unknown> = Promise.resolve();
const keyFor = (tag: string) => `clashprime_imported_upgrades_${tag.replace(/[^a-z0-9]/gi, '').toUpperCase()}`;
const alertId = (tag: string, row: ImportedUpgrade) => `${keyFor(tag)}:${row.id}`;
export const subscribeImportedUpgrades = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emit = () => listeners.forEach(fn => fn());
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = pending.then(fn, fn);
  pending = result.catch(() => {});
  return result;
}
async function read(tag: string): Promise<Snapshot> {
  const raw = await AsyncStorage.getItem(keyFor(tag));
  return raw ? JSON.parse(raw) : { snapshotAt: 0, rows: [] };
}
export async function getImportedUpgradeSnapshotInfo(tag: string): Promise<{ snapshotAt: number; timestampKnown: boolean }> {
  await pending;
  const saved = await read(tag);
  return { snapshotAt: saved.snapshotAt, timestampKnown: saved.timestampKnown !== false };
}
export async function getImportedUpgrades(tag: string): Promise<ImportedUpgrade[]> {
  return (await read(tag)).rows;
}
async function syncAlerts(tag: string, before: ImportedUpgrade[], after: ImportedUpgrade[]) {
  const wanted = new Map(after.filter(r => !r.confirmed && r.completesAt > Date.now()).map(r => [r.id, r]));
  for (const row of before) {
    const next = wanted.get(row.id);
    if (!next || next.completesAt !== row.completesAt) await cancelUpgradeAlert(alertId(tag, row)).catch(() => {});
  }
  const name = wanted.size > 0 ? await notificationAccountName(tag) : null;
  for (const row of wanted.values()) await scheduleUpgradeAlert(alertId(tag, row), `${row.name} Lv ${row.targetLevel}`, row.completesAt, tag, name).catch(() => {});
}
export async function importUpgradeSnapshot(tag: string, result: CocImportResult): Promise<void> {
  if (!tag) return;
  return serialize(async () => {
    const previous = await read(tag);
    if (result.snapshotAt < previous.snapshotAt) return;
    // An undated snapshot cannot establish that its timer list is newer.
    if (result.exportedAt === null && previous.snapshotAt > 0) return;
    // Exports do not identify individual building copies. Match their end times,
    // not array positions: when one finishes, the remaining rows shift slots.
    const used = new Set<string>();
    const rows = (result.upgrades ?? []).map((row, index) => {
      const candidates = previous.rows.filter(old => !used.has(old.id) && old.dataId === row.dataId && old.name === row.name && old.level === row.level && old.village === row.village);
      candidates.sort((a, b) => Math.abs(a.completesAt - row.completesAt) - Math.abs(b.completesAt - row.completesAt) || Number(!!a.confirmed) - Number(!!b.confirmed));
      const match = candidates.find(old => Math.abs(old.completesAt - row.completesAt) <= 30000) ?? candidates.find(old => !old.confirmed);
      let id = match?.id ?? row.id;
      if (!match && (used.has(id) || previous.rows.some(old => old.id === id))) id += '@' + result.snapshotAt + ':' + index;
      used.add(id);
      return { ...row, id, confirmed: !!match?.confirmed };
    });
    await AsyncStorage.setItem(keyFor(tag), JSON.stringify({ snapshotAt: result.snapshotAt, timestampKnown: result.exportedAt !== null, rows }));
    emit();
    // Persistence remains useful when permission is denied or native scheduling is unavailable.
    try {
      if (rows.some(r => !r.confirmed && r.completesAt > Date.now())) await requestPermission();
      await syncAlerts(tag, previous.rows, rows);
    } catch { /* Retry scheduling when the account is opened again. */ }
  });
}
export async function confirmImportedUpgrade(tag: string, id: string): Promise<void> {
  return serialize(async () => {
    const snapshot = await read(tag);
    if (snapshot.rows.find(r => r.id === id)?.confirmed) return;
    snapshot.rows = snapshot.rows.map(r => r.id === id ? { ...r, confirmed: true } : r);
    await AsyncStorage.setItem(keyFor(tag), JSON.stringify(snapshot));
    emit();
    const row = snapshot.rows.find(r => r.id === id);
    if (row) await cancelUpgradeAlert(alertId(tag, row)).catch(() => {});
  });
}
export async function restoreUpgradeAlerts(tag: string): Promise<void> {
  const rows = await getImportedUpgrades(tag);
  await syncAlerts(tag, [], rows).catch(() => {});
}

export async function clearImportedUpgrades(tag: string): Promise<void> {
  return serialize(async () => {
    const snapshot = await read(tag);
    await Promise.all(snapshot.rows.map(row => cancelUpgradeAlert(alertId(tag, row)).catch(() => {})));
    await AsyncStorage.removeItem(keyFor(tag));
    emit();
  });
}
