import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'clashprime_builders';
const VERIFIED_KEY = 'clashprime_builders_verified';
const DEFAULT_COUNT = 2;

/**
 * Persisted Home Village builder count used to divide building/hero upgrade
 * time when computing "time to max". 2–6 builders are supported (6 = OTTO).
 * verified flag means the count was auto-detected from a JSON import.
 */
export function useBuilderCount() {
  const [count, setCount] = useState<number>(DEFAULT_COUNT);
  const [verified, setVerified] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [v, ver] = await Promise.all([
          AsyncStorage.getItem('clashprime_builders'),
          AsyncStorage.getItem('clashprime_builders_verified'),
        ]);
        if (v != null) {
          const n = parseInt(v, 10);
          if (n >= 2 && n <= 6) setCount(n);
        }
        if (ver === 'true') setVerified(true);
      } catch (e) {
        console.warn('Failed to load builder count', e);
      }
      setLoaded(true);
    })();
  }, []);

  const setBuilderCount = useCallback(async (n: number) => {
    setCount(n);
    try {
      await AsyncStorage.setItem('clashprime_builders', String(n));
    } catch (e) {
      console.warn('Failed to save builder count', e);
    }
  }, []);

  const setBuilderVerified = useCallback(async (verified: boolean) => {
    setVerified(verified);
    try {
      await AsyncStorage.setItem('clashprime_builders_verified', verified ? 'true' : 'false');
    } catch (e) {
      console.warn('Failed to save builder verified flag', e);
    }
  }, []);

  return { count, setBuilderCount, loaded, verified, setBuilderVerified };
}