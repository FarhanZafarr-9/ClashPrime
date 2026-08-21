import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import notifee, { AndroidCategory, AndroidImportance, AuthorizationStatus, TriggerType } from 'react-native-notify-kit';
import { TimerReminder } from '../types/clash';

const LEGACY_KEY = 'clashprime_reminders';
const CHANNEL_ID = 'timer-expiry';

let notifeeLinked = false;
try {
  notifeeLinked = !!(
    NativeModules?.NotifeeApiModule ||
    TurboModuleRegistry?.get?.('NotifeeApiModule')
  );
} catch {}

function remindersKey(accountTag: string): string {
  if (!accountTag) return LEGACY_KEY;
  return `clashprime_reminders_${accountTag.replace(/[^a-zA-Z0-9]/g, '')}`;
}

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch {}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensureChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Timer Expiry',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF3B30',
      bypassDnd: false,
    });
  } catch {}
}

// ── Ongoing pinned timer notification ─────────────────────────────────────────
// A sticky (non-dismissible) Android notification showing a live countdown for
// the next active timer. The per-second ticking is rendered natively by Android
// (showChronometer + chronometerDirection 'down'), so it keeps counting even
// when the app is killed and costs no battery — JS only re-posts when the set
// of active timers changes. A timestamp trigger scheduled at the earliest end
// time swaps the card for the next timer (or a quiet "finished" card) without
// the app ever needing to run.

const ONGOING_CHANNEL_ID = 'timer-ongoing';
const ONGOING_NOTIFICATION_ID = 'clashprime-ongoing-timer';

let ongoingChannelReady = false;
let lastOngoingSignature = '';

export async function ensureOngoingChannel(): Promise<void> {
  if (!notifeeLinked || Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: ONGOING_CHANNEL_ID,
      name: 'Active Timers',
      importance: AndroidImportance.LOW,
      vibration: false,
      lights: false,
      badge: false,
      bypassDnd: false,
    });
    ongoingChannelReady = true;
  } catch {}
}

function formatEndTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface ActiveTimer {
  id: string;
  label: string;
  target: number;
  totalMs: number;
}

function getActiveTimers(reminders: TimerReminder[]): ActiveTimer[] {
  const now = Date.now();
  return reminders
    .filter((r) => r.status === 'active' && new Date(r.targetDate).getTime() > now)
    .map((r) => ({
      id: r.id,
      label: r.label,
      target: new Date(r.targetDate).getTime(),
      totalMs: Math.max(1, new Date(r.targetDate).getTime() - new Date(r.createdAt).getTime()),
    }))
    .sort((a, b) => a.target - b.target);
}

export async function stopOngoingTimerNotification(): Promise<void> {
  if (!notifeeLinked || Platform.OS !== 'android') return;
  try {
    await notifee.cancelNotification(ONGOING_NOTIFICATION_ID);
  } catch {}
  lastOngoingSignature = '';
}

async function displayOngoingFor(next: ActiveTimer, moreCount: number): Promise<void> {
  if (!ongoingChannelReady) await ensureOngoingChannel();
  const elapsed = Math.max(0, next.totalMs - (next.target - Date.now()));
  const pct = Math.min(100, Math.max(0, Math.round((elapsed / next.totalMs) * 100)));
  await notifee.displayNotification({
    id: ONGOING_NOTIFICATION_ID,
    title: `${next.label}`,
    body: `Ends ${formatEndTime(next.target)}${moreCount > 0 ? ` · ${moreCount} more active` : ''}`,
    data: { type: 'timer-ongoing', reminderId: next.id },
    android: {
      channelId: ONGOING_CHANNEL_ID,
      smallIcon: 'notification_icon',
      category: AndroidCategory.PROGRESS,
      ongoing: true,
      autoCancel: false,
      onlyAlertOnce: true,
      localOnly: true,
      timestamp: next.target,
      showChronometer: true,
      chronometerDirection: 'down',
      progress: { current: pct, max: 100, indeterminate: false },
    },
  });
}

export async function syncOngoingTimerNotification(reminders: TimerReminder[]): Promise<void> {
  if (!notifeeLinked || Platform.OS !== 'android') return;

  const active = getActiveTimers(reminders);

  // Nothing active → clear the pinned card and any pending swap trigger.
  if (active.length === 0) {
    await stopOngoingTimerNotification();
    return;
  }

  // Only touch the notification when the timer set actually changed — the
  // countdown itself ticks natively without our involvement.
  const signature = active.map((a) => `${a.id}@${a.target}`).join('|');
  if (signature === lastOngoingSignature) return;
  lastOngoingSignature = signature;

  try {
    const [next, ...rest] = active;

    // Post the pinned live-countdown card.
    await displayOngoingFor(next, rest.length);

    // Schedule a native swap at the moment this timer ends: promote the next
    // timer into the pinned slot, or fire a sounding "finished" alert.
    const followUp = rest[0];
    const followUpPct = followUp
      ? Math.min(100, Math.max(0, Math.round(((followUp.target - next.target) / followUp.totalMs) * 100)))
      : 0;
    await notifee.createTriggerNotification(
      followUp
        ? {
            id: ONGOING_NOTIFICATION_ID,
            title: `${followUp.label}`,
            body: `Ends ${formatEndTime(followUp.target)}${rest.length > 1 ? ` · ${rest.length - 1} more active` : ''}`,
            data: { type: 'timer-ongoing', reminderId: followUp.id },
            android: {
              channelId: ONGOING_CHANNEL_ID,
              smallIcon: 'notification_icon',
              category: AndroidCategory.PROGRESS,
              ongoing: true,
              autoCancel: false,
              onlyAlertOnce: true,
              localOnly: true,
              timestamp: followUp.target,
              showChronometer: true,
              chronometerDirection: 'down',
              progress: { current: Math.max(0, followUpPct), max: 100, indeterminate: false },
            },
          }
        : {
            id: ONGOING_NOTIFICATION_ID,
            title: `${next.label} — finished!`,
            body: 'Builder is free — log in to set your next upgrade.',
            data: { type: 'timer-ongoing', reminderId: next.id },
            android: {
              channelId: CHANNEL_ID,
              smallIcon: 'notification_icon',
              ongoing: false,
              autoCancel: true,
              onlyAlertOnce: true,
              localOnly: true,
            },
          },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: next.target + 1000,
        alarmManager: { allowWhileIdle: true },
      } as any,
    );
  } catch {}
}

export async function requestPermission(): Promise<boolean> {
  if (notifeeLinked) {
    try {
      const settings = await notifee.requestPermission();
      return (
        settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
        settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
      );
    } catch {}
    return false;
  }
  if (!Notifications) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function getReminders(accountTag: string): Promise<TimerReminder[]> {
  const raw = await AsyncStorage.getItem(remindersKey(accountTag));
  if (!raw) return [];
  return JSON.parse(raw) as TimerReminder[];
}

async function saveReminders(accountTag: string, reminders: TimerReminder[]): Promise<void> {
  await AsyncStorage.setItem(remindersKey(accountTag), JSON.stringify(reminders));
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function rescheduleReminders(accountTag: string): Promise<void> {
  // Expiry alerts are handled natively by Notifee timestamp triggers
  // (scheduled in syncOngoingTimerNotification) — nothing to re-register here.
}

export async function migrateLegacyReminders(accountTag: string): Promise<void> {
  if (!accountTag) return;
  const key = remindersKey(accountTag);
  if (key === LEGACY_KEY) return;
  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (!legacy) return;
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    await AsyncStorage.removeItem(LEGACY_KEY);
    return;
  }
  await AsyncStorage.setItem(key, legacy);
  await AsyncStorage.removeItem(LEGACY_KEY);
}

export async function createReminder(accountTag: string, label: string, durationMinutes: number): Promise<TimerReminder> {
  const now = Date.now();
  const targetDate = new Date(now + durationMinutes * 60_000);
  const reminder: TimerReminder = {
    id: generateId(),
    label,
    targetDate: targetDate.toISOString(),
    createdAt: new Date(now).toISOString(),
    status: 'active',
  };

  const reminders = await getReminders(accountTag);
  reminders.push(reminder);
  await saveReminders(accountTag, reminders);

  await requestPermission();

  return reminder;
}

export async function dismissReminder(accountTag: string, id: string): Promise<void> {
  const reminders = await getReminders(accountTag);
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return;
  reminders.splice(idx, 1);
  await saveReminders(accountTag, reminders);
}

export async function markExpiredReminders(accountTag: string): Promise<TimerReminder[]> {
  const reminders = await getReminders(accountTag);
  const now = Date.now();
  let changed = false;
  for (const r of reminders) {
    if (r.status === 'active' && new Date(r.targetDate).getTime() <= now) {
      r.status = 'expired';
      changed = true;
    }
  }
  if (changed) await saveReminders(accountTag, reminders);
  return reminders;
}
