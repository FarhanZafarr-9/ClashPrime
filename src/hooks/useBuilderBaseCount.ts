import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'clashprime_builder_base_builders';
const MIN = 1;
const MAX = 3;

/** Builder Base builder heads: 1 from BH1–5, 2 from BH6 on (capped at 3). */
export function defaultBuilderBaseCount(builderHallLevel?: number): number {
  const base = (builderHallLevel ?? 1) >= 6 ? 2 : 1;
  return Math.min(MAX, Math.max(MIN, base));
}

// The count lives in a module-level store rather than per-component state.
// Settings, Maxtime, import/export and the 6th Builder tab all read and write
// the same value, so a stepper change anywhere is picked up everywhere
// immediately — tabs stay mounted after first visit, so local state would go
// stale and never recover.
let count = 1;
let loaded = false;
let stored = false;
let derivedBH: number | undefined;
let hydration: Promise<void> | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getCount = () => count;
const getLoaded = () => loaded;

function hydrate() {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const v = await AsyncStorage.getItem(KEY);
      if (v != null) {
        const n = parseInt(v, 10);
        if (n >= MIN && n <= MAX) {
          stored = true;
          count = n;
        }
      }
    } catch (e) {
      console.warn('Failed to load Builder Base builder count', e);
    }
    if (!stored) count = defaultBuilderBaseCount(derivedBH);
    loaded = true;
    emit();
  })();
  return hydration;
}

/**
 * Persisted Builder Base builder count, kept separate from the Home Village
 * builders. Defaults from the Builder Hall level (reaching BH6 grants a second
 * builder) and supports 1–3 builders. A stored value wins over the default.
 */
export function useBuilderBaseCount(builderHallLevel?: number) {
  const value = useSyncExternalStore(subscribe, getCount);
  const isLoaded = useSyncExternalStore(subscribe, getLoaded);

  useEffect(() => {
    hydrate();
  }, []);

  // Keep the un-stored default in sync with the Builder Hall level (e.g. after
  // switching accounts) until the user picks an explicit count.
  useEffect(() => {
    derivedBH = builderHallLevel;
    if (stored) return;
    const next = defaultBuilderBaseCount(builderHallLevel);
    if (next !== count) {
      count = next;
      emit();
    }
  }, [builderHallLevel]);

  const setBuilderBaseCount = useCallback(async (n: number) => {
    const clamped = Math.min(MAX, Math.max(MIN, n));
    stored = true;
    count = clamped;
    emit();
    try {
      await AsyncStorage.setItem(KEY, String(clamped));
    } catch (e) {
      console.warn('Failed to save Builder Base builder count', e);
    }
  }, []);

  return { count: value, setBuilderBaseCount, loaded: isLoaded };
}
