import { Platform } from 'react-native';
import notifee from 'react-native-notify-kit';
import { handleOngoingUpgradeEvent } from './ongoingUpgrades';

// Register before Router mounts, including Android headless notification wakes.
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  const handle = async (event: Parameters<typeof handleOngoingUpgradeEvent>[0]) => {
    await handleOngoingUpgradeEvent(event).catch(() => {});
  };
  notifee.onBackgroundEvent(handle);
}
