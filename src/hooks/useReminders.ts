import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { TimerReminder } from '../types/clash';

const REMINDERS_KEY = 'clashprime_reminders';
const CHANNEL_ID = 'timer-expiry';

let Notifications: any = null;
let SchedulableTriggerInputTypes: any = null;
try {
  Notifications = require('expo-notifications');
  SchedulableTriggerInputTypes = Notifications.SchedulableTriggerInputTypes;
} catch {}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
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

export async function requestPermission(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch { return false; }
}

export async function getReminders(): Promise<TimerReminder[]> {
  const raw = await AsyncStorage.getItem(REMINDERS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as TimerReminder[];
}

async function saveReminders(reminders: TimerReminder[]): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
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
          title: 'Timer Expired',
          body: `"${r.label}" — the time is up!`,
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

export async function createReminder(label: string, durationMinutes: number): Promise<TimerReminder> {
  const now = Date.now();
  const targetDate = new Date(now + durationMinutes * 60_000);
  const reminder: TimerReminder = {
    id: generateId(),
    label,
    targetDate: targetDate.toISOString(),
    createdAt: new Date(now).toISOString(),
    status: 'active',
  };

  const reminders = await getReminders();
  reminders.push(reminder);
  await saveReminders(reminders);

  const permission = await requestPermission();
  if (permission) {
    await ensureChannel();
    await scheduleSystems(reminders);
  }

  return reminder;
}

export async function dismissReminder(id: string): Promise<void> {
  const reminders = await getReminders();
  const idx = reminders.findIndex((r) => r.id === id);
  if (idx === -1) return;
  reminders.splice(idx, 1);
  await saveReminders(reminders);
  await scheduleSystems(reminders);
}

export async function markExpiredReminders(): Promise<TimerReminder[]> {
  const reminders = await getReminders();
  const now = Date.now();
  let changed = false;
  for (const r of reminders) {
    if (r.status === 'active' && new Date(r.targetDate).getTime() <= now) {
      r.status = 'expired';
      changed = true;
    }
  }
  if (changed) await saveReminders(reminders);
  return reminders;
}
