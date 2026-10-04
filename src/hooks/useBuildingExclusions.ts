import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'clashprime_excluded_buildings';

/**
 * Persisted set of keys the player does not plan to max (strategic rushing).
 *
 * Two kinds of key live in one global list, like the builder count:
 *   • a building, by display name ("Lab", "Walls", "BB Cannon") — all copies of
 *     it are skipped, and the research buildings additionally gate the pipeline
 *     they run (see utils/exclusions);
 *   • an army item, via `exclusions.armyKey(name)` — one troop, spell, siege,
 *     hero, pet or equipment left out of its pipeline.
 *
 * Everything excluded drops out of every "time to max" computation on the Time
 * to Max screen — pipeline rows, headline, costs, builder split, TH readiness
 * score and the rush comparison.
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

  const toggleExcluded = useCallback((key: string) => {
    setExcludedSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(next);
      return next;
    });
  }, [persist]);

  const setExcludedMany = useCallback((keys: string[], value: boolean) => {
    setExcludedSet((prev) => {
      const next = new Set(prev);
      for (const key of keys) {
        if (value) next.add(key);
        else next.delete(key);
      }
      persist(next);
      return next;
    });
  }, [persist]);

  /**
   * Clear every exclusion, or only the given keys — each village's section
   * passes its own keys so resetting the Builder Base list leaves the Home
   * Village list alone.
   */
  const clearExcluded = useCallback((keys?: string[]) => {
    setExcludedSet((prev) => {
      if (prev.size === 0) return prev;
      const next = keys ? new Set([...prev].filter((k) => !keys.includes(k))) : new Set<string>();
      if (next.size === prev.size) return prev;
      persist(next);
      return next;
    });
  }, [persist]);

  return { excluded: excludedSet, toggleExcluded, setExcludedMany, clearExcluded, loaded };
}
