import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { TimerReminder } from '../types/clash';
import {
  getReminders,
  createReminder,
  dismissReminder as dismissFromStorage,
  markExpiredReminders,
  requestPermission,
  ensureChannel,
} from './useReminders';

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
  const [reminders, setReminders] = useState<TimerReminder[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const updated = await markExpiredReminders();
    setReminders(updated);
  }, []);

  useEffect(() => {
    (async () => {
      await ensureChannel();
      const perm = await requestPermission();
      setHasPermission(perm);
      await refresh();
    })();
    tickRef.current = setInterval(refresh, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [refresh]);

  const addTimer = useCallback(async (label: string, durationMinutes: number) => {
    await createReminder(label, durationMinutes);
    await refresh();
  }, [refresh]);

  const dismissTimer = useCallback(async (id: string) => {
    await dismissFromStorage(id);
    await refresh();
  }, [refresh]);

  return (
    <TimerContext.Provider value={{ reminders, addTimer, dismissTimer, hasPermission }}>
      {children}
    </TimerContext.Provider>
  );
}
