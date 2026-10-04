import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayer } from './usePlayerContext';

const LEGACY_KEY = 'clashprime_builder_base_builders';
const MIN = 1;
const MAX = 3;

const key = (tag: string) => `clashprime_builder_base_builders:${tag}`;

const inRange = (n: number) => Number.isInteger(n) && n >= MIN && n <= MAX;

/** Tags are stored uppercase with a leading '#', but normalize anyway so a key
 *  written from a differently-shaped tag still resolves to the same slot. */
const normalize = (tag: string) => {
  const clean = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean ? `#${clean}` : '';
};

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
let count = MIN;
let loaded = false;
/** Whether this account has an explicit count, as opposed to the BH default. */
let stored = false;
let derivedBH: number | undefined;
let activeTag = '';
let loadedTag: string | null = null;
let loadToken = 0;

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

/**
 * Persisted Builder Base builder count, kept separate from the Home Village
 * builders. Defaults from the Builder Hall level (reaching BH6 grants a second
 * builder) and supports 1–3 builders. A stored value wins over the default.
 *
 * Stored per account, like the Home Village count: Builder Base progress is
 * account-specific, so a BH6 village must not hand its two builders to a BH4
 * one. A value written before this was per-account is migrated onto whichever
 * account is active first.
 */
export function useBuilderBaseCount(builderHallLevel?: number) {
  const { activeAccount, player } = usePlayer();
  const tag = normalize(activeAccount?.tag || player?.tag || '');
  const value = useSyncExternalStore(subscribe, getCount);
  const isLoaded = useSyncExternalStore(subscribe, getLoaded);

  useEffect(() => {
    activeTag = tag;
    if (loadedTag === tag) return;
    if (!tag) {
      loadedTag = tag;
      stored = false;
      count = MIN;
      loaded = true;
      emit();
      return;
    }

    // Claim a token only once this is known to be a real switch. Bumping it
    // before the guard above would let a duplicated effect invocation orphan
    // the load it had just started, leaving the account stuck on 'loading'.
    const token = ++loadToken;
    loadedTag = tag;
    // Reset to the default rather than keeping the account we are switching away
    // from, so one village's Builder Base builders never appear under another's.
    stored = false;
    count = MIN;
    loaded = false;
    emit();

    (async () => {
      let raw: string | null = null;
      try {
        raw = await AsyncStorage.getItem(key(tag));
        if (token !== loadToken || activeTag !== tag) return;
        if (raw == null) {
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (token !== loadToken || activeTag !== tag) return;
          if (inRange(parseInt(legacy ?? '', 10))) {
            raw = legacy;
            await AsyncStorage.setItem(key(tag), legacy as string);
          }
        }
        if (token !== loadToken || activeTag !== tag) return;
        const n = parseInt(raw ?? '', 10);
        stored = inRange(n);
        count = stored ? n : MIN;
      } catch (e) {
        console.warn('Failed to load Builder Base builder count', e);
      }
      if (token !== loadToken || activeTag !== tag) return;
      // No explicit choice for this account yet, so fall back to what its
      // Builder Hall actually grants.
      if (!stored) count = defaultBuilderBaseCount(derivedBH);
      loaded = true;
      emit();
    })();
  }, [tag]);

  // Keep the un-stored default in sync with the Builder Hall level (e.g. after
  // switching accounts) until the user picks an explicit count. The load above
  // applies the same default for a tag that has no stored count of its own.
  useEffect(() => {
    derivedBH = builderHallLevel;
    if (stored) return;
    const next = defaultBuilderBaseCount(builderHallLevel);
    if (next !== count) {
      count = next;
      emit();
    }
  }, [builderHallLevel]);

  const setBuilderBaseCount = useCallback(async (n: number, tagOverride?: string) => {
    const target = tagOverride ? normalize(tagOverride) : activeTag;
    if (!target) return;
    const clamped = Math.min(MAX, Math.max(MIN, n));
    if (target === activeTag) {
      stored = true;
      count = clamped;
      emit();
    }
    try {
      await AsyncStorage.setItem(key(target), String(clamped));
    } catch (e) {
      console.warn('Failed to save Builder Base builder count', e);
    }
  }, []);

  return { count: value, setBuilderBaseCount, loaded: isLoaded };
}
