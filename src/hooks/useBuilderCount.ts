import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'clashprime_builders';
const DEFAULT_COUNT = 3;

/**
 * Persisted Home Village builder count used to divide building/hero upgrade
 * time when computing "time to max". 2–6 builders are supported (6 = OTTO).
 */
export function useBuilderCount() {
  const [count, setCount] = useState<number>(DEFAULT_COUNT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(KEY);
        if (v != null) {
          const n = parseInt(v, 10);
          if (n >= 1 && n <= 6) setCount(n);
        }
      } catch (e) {
        console.warn('Failed to load builder count', e);
      }
      setLoaded(true);
    })();
  }, []);

  const setBuilderCount = useCallback(async (n: number) => {
    setCount(n);
    try {
      await AsyncStorage.setItem(KEY, String(n));
    } catch (e) {
      console.warn('Failed to save builder count', e);
    }
  }, []);

  return { count, setBuilderCount, loaded };
}
