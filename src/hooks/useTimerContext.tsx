import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { TimerReminder } from '../types/clash';
import {
  createReminder,
  dismissReminder as dismissFromStorage,
  markExpiredReminders,
  rescheduleReminders,
  migrateLegacyReminders,
  requestPermission,
  ensureChannel,
  ensureOngoingChannel,
  syncOngoingTimerNotification,
} from './useReminders';
import { usePlayer } from './usePlayerContext';

interface TimerContextValue {
  reminders: TimerReminder[];
  addTimer: (label: string, durationMinutes: number) => Promise<void>;
  dismissTimer: (id: string) => Promise<void>;
  hasPermission: boolean;
}

const TimerContext = createContext<TimerContextValue>({
  reminders: [],
  addTimer: async () => {},
  dismissTimer: async () => {},
  hasPermission: false,
});

export function useTimers() {
  return useContext(TimerContext);
}

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const { activeAccount } = usePlayer();
  const [reminders, setReminders] = useState<TimerReminder[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const tagRef = useRef('');
  const permRef = useRef(false);

  const tag = activeAccount?.tag || '';
  tagRef.current = tag;

  // Reload from storage, flip expired statuses and refresh the pinned
  // notification. Called on account change, timer changes and foreground
  // resume — never on a timer loop (the countdown ticks natively).
  const reload = useCallback(async (accountTag: string) => {
    const updated = await markExpiredReminders(accountTag);
    setReminders(updated);
    if (permRef.current) {
      await syncOngoingTimerNotification(updated);
    }
    return updated;
  }, []);

  useEffect(() => {
    (async () => {
      await ensureChannel();
      await ensureOngoingChannel();
      const perm = await requestPermission();
      permRef.current = perm;
      setHasPermission(perm);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!tag) return;
      await migrateLegacyReminders(tag);
      await reload(tag);
      await rescheduleReminders(tag);
    })();
  }, [tag, reload]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reload(tagRef.current);
      }
    });
    return () => sub.remove();
  }, [reload]);

  const addTimer = useCallback(async (label: string, durationMinutes: number) => {
    await createReminder(tagRef.current, label, durationMinutes);
    await reload(tagRef.current);
  }, [reload]);

  const dismissTimer = useCallback(async (id: string) => {
    await dismissFromStorage(tagRef.current, id);
    await reload(tagRef.current);
  }, [reload]);

  return (
    <TimerContext.Provider value={{ reminders, addTimer, dismissTimer, hasPermission }}>
      {children}
    </TimerContext.Provider>
  );
}
