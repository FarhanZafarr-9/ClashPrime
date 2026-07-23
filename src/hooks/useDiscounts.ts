import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'clashprime_discounts';

export interface Discounts {
  costPercent: number;
  timePercent: number;
}

const DEFAULT_DISCOUNTS: Discounts = { costPercent: 0, timePercent: 0 };

let cachedDiscounts: Discounts = { ...DEFAULT_DISCOUNTS };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export async function loadDiscounts() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedDiscounts = {
        costPercent: Math.max(0, Math.min(100, parsed.costPercent ?? 0)),
        timePercent: Math.max(0, Math.min(100, parsed.timePercent ?? 0)),
      };
      notify();
    }
  } catch {
    // use defaults
  }
}

export async function saveDiscounts(d: Discounts) {
  cachedDiscounts = {
    costPercent: Math.max(0, Math.min(100, d.costPercent)),
    timePercent: Math.max(0, Math.min(100, d.timePercent)),
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cachedDiscounts));
  } catch {
    console.warn('Failed to save discounts');
  }
  notify();
}

export function useDiscounts() {
  const [discounts, setDiscounts] = useState<Discounts>(cachedDiscounts);

  useEffect(() => {
    const listener = () => setDiscounts({ ...cachedDiscounts });
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setCostPercent = useCallback((pct: number) => {
    saveDiscounts({ ...cachedDiscounts, costPercent: Math.max(0, Math.min(100, pct)) });
  }, []);

  const setTimePercent = useCallback((pct: number) => {
    saveDiscounts({ ...cachedDiscounts, timePercent: Math.max(0, Math.min(100, pct)) });
  }, []);

  const resetDiscounts = useCallback(() => {
    saveDiscounts({ ...DEFAULT_DISCOUNTS });
  }, []);

  return { discounts, setCostPercent, setTimePercent, resetDiscounts };
}
