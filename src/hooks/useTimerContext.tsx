import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { TimerReminder } from '../types/clash';
import {
  createReminder,
  dismissReminder as dismissFromStorage,
  markExpiredReminders,
  rescheduleReminders,
  migrateLegacyReminders,
  requestPermission,
  ensureChannel,
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
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tag = activeAccount?.tag || '';
  tagRef.current = tag;

  const reload = useCallback(async (accountTag: string) => {
    const updated = await markExpiredReminders(accountTag);
    setReminders(updated);
  }, []);

  useEffect(() => {
    (async () => {
      await ensureChannel();
      const perm = await requestPermission();
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
    tickRef.current = setInterval(async () => {
      await reload(tagRef.current);
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
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
