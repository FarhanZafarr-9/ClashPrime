import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { TimerReminder } from '../types/clash';

const LEGACY_KEY = 'clashprime_reminders';
const CHANNEL_ID = 'timer-expiry';

function remindersKey(accountTag: string): string {
  if (!accountTag) return LEGACY_KEY;
  return `clashprime_reminders_${accountTag.replace(/[^a-zA-Z0-9]/g, '')}`;
}

let Notifications: any = null;
let SchedulableTriggerInputTypes: any = null;
try {
  Notifications = require('expo-notifications');
  SchedulableTriggerInputTypes = Notifications.SchedulableTriggerInputTypes;
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
// A sticky (non-dismissible) Android notification showing live countdown
// progress for the next active timer. It re-presents itself on a throttle
// window so the progress bar and remaining time stay fresh while the app runs.

const ONGOING_CHANNEL_ID = 'timer-ongoing';
const ONGOING_NOTIFICATION_ID = 'clashprime-ongoing-timer';
const ONGOING_REFRESH_MS = 30_000;

let ongoingChannelReady = false;
let ongoingNotificationId: string | null = null;
let lastOngoingSync = 0;
let lastOngoingSignature = '';

export async function ensureOngoingChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ONGOING_CHANNEL_ID, {
      name: 'Active Timers',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [],
      sound: null,
      lights: false,
      showBadge: false,
      bypassDnd: false,
    });
    ongoingChannelReady = true;
  } catch {}
}

function formatCountdownLabel(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export async function stopOngoingTimerNotification(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  if (!ongoingNotificationId) return;
  try {
    await Notifications.dismissNotificationAsync(ongoingNotificationId);
  } catch {}
  ongoingNotificationId = null;
  lastOngoingSignature = '';
}

export async function syncOngoingTimerNotification(reminders: TimerReminder[]): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;

  const now = Date.now();
  const active = reminders
    .filter((r) => r.status === 'active')
    .map((r) => {
      const total = Math.max(1, new Date(r.targetDate).getTime() - new Date(r.createdAt).getTime());
      const remaining = Math.max(0, new Date(r.targetDate).getTime() - now);
      const pct = Math.min(100, Math.max(0, Math.round(((total - remaining) / total) * 100)));
      return { id: r.id, label: r.label, target: new Date(r.targetDate).getTime(), remaining, pct };
    })
    .sort((a, b) => a.target - b.target);

  if (active.length === 0) {
    await stopOngoingTimerNotification();
    return;
  }

  // Skip re-presenting unless the set/percentages changed or the throttle window passed.
  const signature = active.map((a) => `${a.id}:${a.pct}`).join('|');
  if (signature === lastOngoingSignature && now - lastOngoingSync < ONGOING_REFRESH_MS) {
    return;
  }
  lastOngoingSignature = signature;
  lastOngoingSync = now;

  if (!ongoingChannelReady) await ensureOngoingChannel();

  const next = active[0];
  const barWidth = 12;
  const filled = Math.min(barWidth, Math.round((next.pct / 100) * barWidth));
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  const remainingLabel = next.remaining > 0 ? formatCountdownLabel(next.remaining) : 'done';

  const content: any = {
    title: `Active timer · ${next.label}`,
    body: `${bar} ${next.pct}% — ${remainingLabel}`,
    sound: false,
    sticky: true,
    autoDismiss: false,
    channelId: ONGOING_CHANNEL_ID,
    data: { type: 'timer-ongoing', reminderId: next.id },
  };

  if (ongoingNotificationId) {
    try {
      await Notifications.dismissNotificationAsync(ongoingNotificationId);
    } catch {}
    ongoingNotificationId = null;
  }
  try {
    ongoingNotificationId = await Notifications.scheduleNotificationAsync({
      identifier: ONGOING_NOTIFICATION_ID,
      content,
      trigger: null,
    });
  } catch {}
}

export async function requestPermission(): Promise<boolean> {
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

async function scheduleSystems(reminders: TimerReminder[]) {
  if (!Notifications || !SchedulableTriggerInputTypes) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of reminders) {
      if (r.status !== 'active') continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Builder free!',
          body: `"${r.label}" is done — log in to set your next upgrade.`,
          sound: true,
          ...(Platform.OS === 'android' ? {
            sticky: true,
            autoDismiss: false,
            channelId: CHANNEL_ID,
          } : {}),
        },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(r.targetDate) },
      });
    }
  } catch {}
}

export async function rescheduleReminders(accountTag: string): Promise<void> {
  const reminders = await getReminders(accountTag);
  await scheduleSystems(reminders);
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

  const permission = await requestPermission();
  if (permission) {
    await ensureChannel();
    await scheduleSystems(reminders);
  }

  return reminder;
}

export async function dismissReminder(accountTag: string, id: string): Promise<void> {
  const reminders = await getReminders(accountTag);
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return;
  reminders.splice(idx, 1);
  await saveReminders(accountTag, reminders);
  await scheduleSystems(reminders);
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
