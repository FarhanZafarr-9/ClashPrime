import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import notifee from 'react-native-notify-kit';
import { getImportedUpgrades, subscribeImportedUpgrades } from '../utils/importedUpgrades';
import { handleOngoingUpgradeEvent, syncOngoingUpgradeNotification } from '../notifications/ongoingUpgrades';
import { useBuilderCount } from './useBuilderCount';

export function useOngoingUpgradeNotification(tag: string, hasPermission: boolean, name: string): void {
  const { count, loaded } = useBuilderCount();
  // Foreground listeners resolve the native module, so wait until after mount.
  useEffect(() => {
    if (!hasPermission || Platform.OS !== 'android') return;
    return notifee.onForegroundEvent(event => { void handleOngoingUpgradeEvent(event).catch(() => {}); });
  }, [hasPermission]);

  useEffect(() => {
    let alive = true;
    const reload = async () => {
      const rows = tag && hasPermission ? await getImportedUpgrades(tag) : [];
      if (alive) await syncOngoingUpgradeNotification(hasPermission ? tag : '', rows, loaded ? count : null, name);
    };
    const update = () => { void reload().catch(() => {}); };
    update();
    const unsubscribe = subscribeImportedUpgrades(update);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { alive = false; unsubscribe(); subscription.remove(); };
  }, [tag, hasPermission, count, loaded, name]);
}
