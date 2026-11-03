import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { getImportedUpgrades, getImportedUpgradeSnapshotInfo, subscribeImportedUpgrades, restoreUpgradeAlerts, confirmImportedUpgrade } from '../utils/importedUpgrades';
import type { ImportedUpgrade } from '../types/importedUpgrade';

export function useImportedUpgrades(tag: string) {
  const [state, setState] = useState<{ tag: string; rows: ImportedUpgrade[]; snapshotAt: number }>({ tag: '', rows: [], snapshotAt: 0 });
  useEffect(() => {
    let alive = true;
    let revision = 0;
    const reload = async () => {
      const request = ++revision;
      const info = tag ? await getImportedUpgradeSnapshotInfo(tag) : { snapshotAt: 0 };
      const rows = tag ? await getImportedUpgrades(tag) : [];
      if (alive && request === revision) setState({ tag, rows, snapshotAt: info.snapshotAt });
    };
    void reload();
    if (tag) void restoreUpgradeAlerts(tag);
    const unsubscribe = subscribeImportedUpgrades(() => { void reload(); });
    const sub = AppState.addEventListener('change', status => { if (status === 'active') { void reload(); if (tag) void restoreUpgradeAlerts(tag); } });
    return () => { alive = false; unsubscribe(); sub.remove(); };
  }, [tag]);
  const confirm = useCallback((id: string) => confirmImportedUpgrade(tag, id), [tag]);
  return { upgrades: state.tag === tag ? state.rows : [], hasSnapshot: state.tag === tag && state.snapshotAt > 0, confirm };
}
