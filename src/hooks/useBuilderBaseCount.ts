import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'clashprime_builder_base_builders';
const MIN = 1;
const MAX = 3;

/** Builder Base builder heads: 1 from BH1–5, 2 from BH6 on (capped at 3). */
export function defaultBuilderBaseCount(builderHallLevel?: number): number {
  const base = (builderHallLevel ?? 1) >= 6 ? 2 : 1;
  return Math.min(MAX, Math.max(MIN, base));
}

/**
 * Persisted Builder Base builder count, kept separate from the Home Village
 * builders. Defaults from the Builder Hall level (reaching BH6 grants a second
 * builder) and supports 1–3 builders. A stored value wins over the default.
 */
export function useBuilderBaseCount(builderHallLevel?: number) {
  const [count, setCount] = useState<number>(defaultBuilderBaseCount(builderHallLevel));
  const [loaded, setLoaded] = useState(false);
  const storedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY);
        if (v != null) {
          const n = parseInt(v, 10);
          if (n >= MIN && n <= MAX) {
            storedRef.current = true;
            setCount(n);
          }
        }
      } catch (e) {
        console.warn('Failed to load Builder Base builder count', e);
      }
      if (!storedRef.current) setCount(defaultBuilderBaseCount(builderHallLevel));
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the un-stored default in sync with the Builder Hall level (e.g. after
  // switching accounts) until the user picks an explicit count.
  useEffect(() => {
    if (!storedRef.current) setCount(defaultBuilderBaseCount(builderHallLevel));
  }, [builderHallLevel]);

  const setBuilderBaseCount = useCallback(async (n: number) => {
    const clamped = Math.min(MAX, Math.max(MIN, n));
    storedRef.current = true;
    setCount(clamped);
    try {
      await AsyncStorage.setItem(KEY, String(clamped));
    } catch (e) {
      console.warn('Failed to save Builder Base builder count', e);
    }
  }, []);

  return { count, setBuilderBaseCount, loaded };
}