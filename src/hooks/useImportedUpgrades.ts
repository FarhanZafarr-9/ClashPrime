import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { getImportedUpgrades, subscribeImportedUpgrades, restoreUpgradeAlerts, confirmImportedUpgrade } from '../utils/importedUpgrades';
import type { ImportedUpgrade } from '../types/importedUpgrade';

export function useImportedUpgrades(tag: string) {
  const [state, setState] = useState<{ tag: string; rows: ImportedUpgrade[] }>({ tag: '', rows: [] });
  useEffect(() => {
    let alive = true;
    const reload = async () => {
      const rows = tag ? await getImportedUpgrades(tag) : [];
      if (alive) setState({ tag, rows });
    };
    void reload();
    if (tag) void restoreUpgradeAlerts(tag);
    const unsubscribe = subscribeImportedUpgrades(() => { void reload(); });
    const sub = AppState.addEventListener('change', status => { if (status === 'active') { void reload(); if (tag) void restoreUpgradeAlerts(tag); } });
    return () => { alive = false; unsubscribe(); sub.remove(); };
  }, [tag]);
  const confirm = useCallback((id: string) => confirmImportedUpgrade(tag, id), [tag]);
  return { upgrades: state.tag === tag ? state.rows : [], confirm };
}
