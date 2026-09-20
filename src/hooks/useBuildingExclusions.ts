import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'clashprime_excluded_buildings';

/**
 * Persisted set of building names the player does not plan to max (strategic
 * rushing). Excluded buildings (all copies) drop out of every "time to max"
 * computation on the Time to Max screen — pipeline rows, headline, costs,
 * builder split, TH readiness score and the rush comparison. Global, like the
 * builder count.
 */
export function useBuildingExclusions() {
  const [excludedSet, setExcludedSet] = useState<ReadonlySet<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw != null) {
          const arr = JSON.parse(raw) as string[];
          if (Array.isArray(arr)) setExcludedSet(new Set(arr.filter((x) => typeof x === 'string')));
        }
      } catch (e) {
        console.warn('Failed to load building exclusions', e);
      }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback((next: ReadonlySet<string>) => {
    AsyncStorage.setItem(KEY, JSON.stringify([...next])).catch((e) => {
      console.warn('Failed to save building exclusions', e);
    });
  }, []);

  const toggleExcluded = useCallback((name: string) => {
    setExcludedSet((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      persist(next);
      return next;
    });
  }, [persist]);

  const setExcludedMany = useCallback((names: string[], value: boolean) => {
    setExcludedSet((prev) => {
      const next = new Set(prev);
      for (const name of names) {
        if (value) next.add(name);
        else next.delete(name);
      }
      persist(next);
      return next;
    });
  }, [persist]);

  const clearExcluded = useCallback(() => {
    setExcludedSet((prev) => {
      if (prev.size === 0) return prev;
      persist(new Set());
      return new Set();
    });
  }, [persist]);

  return { excluded: excludedSet, toggleExcluded, setExcludedMany, clearExcluded, loaded };
}