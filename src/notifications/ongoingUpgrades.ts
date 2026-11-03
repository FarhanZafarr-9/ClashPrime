import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import notifee, { AndroidCategory, AndroidImportance, EventType, type Event } from 'react-native-notify-kit';
import type { ImportedUpgrade } from '../types/importedUpgrade';
import { upgradeAvailability } from '../utils/upgradeAvailability';

const STORAGE_KEY = 'clashprime_ongoing_upgrade_source';
const CHANNEL_ID = 'upgrades-ongoing';
const NOTIFICATION_ID = 'clashprime-next-upgrade';
type Upgrade = Pick<ImportedUpgrade, 'id' | 'name' | 'targetLevel' | 'completesAt' | 'confirmed' | 'village' | 'kind' | 'storeName'>;
interface Source { tag: string; name?: string; rows: Upgrade[]; builderCount?: number | null }
let pending: Promise<unknown> = Promise.resolve();

function serialize(work: () => Promise<void>): Promise<void> {
  const result = pending.then(work, work);
  pending = result.catch(() => {});
  return result;
}

async function display(source: Source): Promise<void> {
  const active = source.rows.filter(row => !row.confirmed && Number.isFinite(row.completesAt) && row.completesAt > Date.now()).sort((a, b) => a.completesAt - b.completesAt);
  const next = active[0];
  if (!source.tag || !next) {
    await notifee.cancelNotification(NOTIFICATION_ID);
    return;
  }
  await notifee.createChannel({ id: CHANNEL_ID, name: 'Ongoing Upgrades', importance: AndroidImportance.LOW, vibration: false, lights: false, badge: false });
  const finish = new Date(next.completesAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const capacity = source.builderCount;
  const { freeBuilders } = upgradeAvailability(active, capacity ?? null);
  const builders = freeBuilders == null ? '' : `Home: ${freeBuilders}/${capacity} builders free (tracked) · `;
  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: `Next: ${next.name} · Lv ${next.targetLevel}`,
    body: `${builders}${finish}${active.length > 1 ? ` · ${active.length - 1} more upgrading` : ''}${source.name ? ` · ${source.name}` : ''}`,
    data: { type: 'upgrade-ongoing', accountTag: source.tag, upgradeId: next.id },
    android: {
      channelId: CHANNEL_ID, smallIcon: 'notification_icon', category: AndroidCategory.PROGRESS,
      ongoing: true, autoCancel: false, onlyAlertOnce: true, localOnly: true,
      timestamp: next.completesAt, showChronometer: true, chronometerDirection: 'down',
      pressAction: { id: 'default' },
    },
  });
}

/** Persist the selected account's queue so a completion can advance it headlessly. */
export function syncOngoingUpgradeNotification(tag: string, rows: ImportedUpgrade[], builderCount: number | null = null, name = ''): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  return serialize(async () => {
    const source: Source = { tag, name: name.trim(), builderCount, rows: rows.map(({ id, name, targetLevel, completesAt, confirmed, village, kind, storeName }) => ({ id, name, targetLevel, completesAt, confirmed, village, kind, storeName })) };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(source));
    await display(source);
  });
}

/** Completion alerts already wake Notifee; no polling or extra alarm is needed. */
export function handleOngoingUpgradeEvent(event: Event): Promise<void> {
  if (Platform.OS !== 'android' || event.type !== EventType.DELIVERED || event.detail.notification?.data?.type !== 'imported-upgrade') return Promise.resolve();
  const accountTag = event.detail.notification.data.accountTag;
  return serialize(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const source: Source = JSON.parse(raw);
    // An alert from another account must not replace the selected account's card.
    if (source.tag !== accountTag) return;
    await display(source);
  });
}
