import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'clashprime_discounts';

export interface ScopeDiscount {
  costPercent: number;
  timePercent: number;
}

export interface Discounts {
  buildings: ScopeDiscount;
  army: ScopeDiscount;
}

const DEFAULT_SCOPE: ScopeDiscount = { costPercent: 0, timePercent: 0 };
const DEFAULT_DISCOUNTS: Discounts = { buildings: { ...DEFAULT_SCOPE }, army: { ...DEFAULT_SCOPE } };

let cachedDiscounts: Discounts = {
  buildings: { ...DEFAULT_SCOPE },
  army: { ...DEFAULT_SCOPE },
};
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function clamp(pct: number) {
  return Math.max(0, Math.min(100, pct));
}

export async function loadDiscounts() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const b = parsed.buildings || {};
      const a = parsed.army || {};
      cachedDiscounts = {
        buildings: { costPercent: clamp(b.costPercent), timePercent: clamp(b.timePercent) },
        army: { costPercent: clamp(a.costPercent), timePercent: clamp(a.timePercent) },
      };
      notify();
    }
  } catch {
    // use defaults
  }
}

async function persist() {
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
    const listener = () => setDiscounts({ ...cachedDiscounts, buildings: { ...cachedDiscounts.buildings }, army: { ...cachedDiscounts.army } });
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setBuildingCost = useCallback((pct: number) => {
    cachedDiscounts = { ...cachedDiscounts, buildings: { ...cachedDiscounts.buildings, costPercent: clamp(pct) } };
    persist();
  }, []);

  const setBuildingTime = useCallback((pct: number) => {
    cachedDiscounts = { ...cachedDiscounts, buildings: { ...cachedDiscounts.buildings, timePercent: clamp(pct) } };
    persist();
  }, []);

  const setArmyCost = useCallback((pct: number) => {
    cachedDiscounts = { ...cachedDiscounts, army: { ...cachedDiscounts.army, costPercent: clamp(pct) } };
    persist();
  }, []);

  const setArmyTime = useCallback((pct: number) => {
    cachedDiscounts = { ...cachedDiscounts, army: { ...cachedDiscounts.army, timePercent: clamp(pct) } };
    persist();
  }, []);

  const resetDiscounts = useCallback(() => {
    cachedDiscounts = { buildings: { ...DEFAULT_SCOPE }, army: { ...DEFAULT_SCOPE } };
    persist();
  }, []);

  return { discounts, setBuildingCost, setBuildingTime, setArmyCost, setArmyTime, resetDiscounts };
}