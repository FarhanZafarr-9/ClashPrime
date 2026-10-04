import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayer } from './usePlayerContext';

const MIN_COUNT = 2;
const MAX_COUNT = 6;
const LEGACY_KEY = 'clashprime_builders';

const countKey = (tag: string) => `clashprime_builders:${tag}`;
const verifiedKey = (tag: string) => `clashprime_builders_verified:${tag}`;

const inRange = (n: number) => Number.isInteger(n) && n >= MIN_COUNT && n <= MAX_COUNT;

const readStored = async (key: string): Promise<number | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return inRange(parseInt(raw ?? '', 10)) ? Number(raw) : null;
  } catch {
    return null;
  }
};

/** Tags are stored uppercase with a leading '#', but normalize anyway so a key
 *  written from a differently-shaped tag still resolves to the same slot. */
const normalize = (tag: string) => {
  const clean = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean ? `#${clean}` : '';
};

/** The count and import baseline actually on disk for one account. Read straight
 *  from storage rather than from the shared snapshot whenever a write must not be
 *  influenced by whichever account happens to be active, or when the active
 *  account has not finished loading - otherwise the placeholder pair
 *  (2 / no baseline) gets written over a real one and the import floor is lost. */
const readPair = async (tag: string): Promise<{ count: number; verified: number | null }> => {
  const [count, verified] = await Promise.all([
    readStored(countKey(tag)),
    readStored(verifiedKey(tag)),
  ]);
  return { count: count ?? MIN_COUNT, verified };
};

interface Snapshot {
  count: number;
  verified: number | null;
  loaded: boolean;
}

/** Builder count is shared app-wide, not per hook call.
 *
 *  Several screens are mounted at once (Settings pushes Import/Export on top of
 *  itself), so if the state lived in each hook instance the writing screen would
 *  update and every other mounted copy would keep showing its stale value until
 *  it happened to remount. A tiny external store keeps all of them in step. */
let snapshot: Snapshot = { count: MIN_COUNT, verified: null, loaded: false };
let activeTag = '';
let loadedTag: string | null = null;
let loadToken = 0;

const listeners = new Set<() => void>();

const emit = (next: Snapshot) => {
  snapshot = next;
  for (const listener of listeners) listener();
};

const getSnapshot = () => snapshot;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export interface BuilderCount {
  /** Current Home Village builder count (2-6, where 6 = O.T.T.O.). */
  count: number;
  loaded: boolean;
  /** The builder count that was auto-detected from a JSON import, or null when
   *  there is no import baseline. Doubles as the floor: the count can be raised
   *  by hand but never dropped below a detected value, because a verified count
   *  is known to be right. */
  verified: number | null;
  /** True only while the current count still equals the detected baseline. */
  isVerified: boolean;
  canDecrease: boolean;
  canIncrease: boolean;
  /** Set the count by hand. Keeps the verified baseline as a floor. */
  setBuilderCount: (n: number, tag?: string) => Promise<void>;
  /** Record `n` as auto-detected from an import: sets it and marks it verified. */
  verifyBuilderCount: (n: number, tag?: string) => Promise<void>;
  /** Drop the import baseline, e.g. after a full re-onboarding. */
  clearVerified: (tag?: string) => Promise<void>;
}

/**
 * Persisted Home Village builder count used to divide building/hero upgrade
 * time when computing "time to max". 2-6 builders are supported (6 = OTTO).
 *
 * Stored per account, so switching accounts does not leak one account's count
 * into another's time-to-max maths. A value written before this was per-account
 * is migrated onto whichever account is active first.
 */
export function useBuilderCount(): BuilderCount {
  const { activeAccount, player } = usePlayer();
  const tag = normalize(activeAccount?.tag || player?.tag || '');

  // Subscribe first so a write from another mounted screen lands immediately.
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    activeTag = tag;
    if (loadedTag === tag) return;
    if (!tag) {
      loadedTag = tag;
      emit({ count: MIN_COUNT, verified: null, loaded: true });
      return;
    }

    // Claim a token only once this is known to be a real switch. Bumping it
    // before the guard above would let a duplicated effect invocation orphan
    // the load it had just started, leaving the account stuck on 'loading'.
    const token = ++loadToken;
    loadedTag = tag;
    // Show the default rather than the account we are switching away from, so
    // one village's numbers never appear under another's row.
    emit({ count: MIN_COUNT, verified: null, loaded: false });

    (async () => {
      try {
        const [rawCount, rawVerified] = await Promise.all([
          AsyncStorage.getItem(countKey(tag)),
          AsyncStorage.getItem(verifiedKey(tag)),
        ]);
        if (token !== loadToken || activeTag !== tag) return;

        let count = inRange(parseInt(rawCount ?? '', 10)) ? Number(rawCount) : MIN_COUNT;

        if (rawCount == null) {
          const legacy = await AsyncStorage.getItem(LEGACY_KEY);
          if (token !== loadToken || activeTag !== tag) return;
          if (inRange(parseInt(legacy ?? '', 10))) {
            count = Number(legacy);
            await AsyncStorage.setItem(countKey(tag), legacy as string);
          }
        }

        const verified = inRange(parseInt(rawVerified ?? '', 10)) ? Number(rawVerified) : null;
        emit({ count: verified !== null ? Math.max(count, verified) : count, verified, loaded: true });
      } catch (e) {
        console.warn('Failed to load builder count', e);
        // Nothing was readable, so fall back to the default with no baseline
        // rather than restoring the account we just switched away from.
        if (token === loadToken) emit({ count: MIN_COUNT, verified: null, loaded: true });
      }
    })();
  }, [tag]);

  const persist = useCallback(async (n: number, verified: number | null, tagOverride?: string) => {
    const target = tagOverride ? normalize(tagOverride) : activeTag;
    // Only mirror into the shared state when the write targets the account on
    // screen - applying an import to another account must not change what the
    // current one shows until it is switched to and reloaded.
    if (!target || target === activeTag) emit({ count: n, verified, loaded: true });
    if (!target) return;
    try {
      await AsyncStorage.setItem(countKey(target), String(n));
      if (verified === null) await AsyncStorage.removeItem(verifiedKey(target));
      else await AsyncStorage.setItem(verifiedKey(target), String(verified));
    } catch (e) {
      console.warn('Failed to save builder count', e);
    }
  }, []);

  const setBuilderCount = useCallback(
    async (n: number, tagOverride?: string) => {
      const target = tagOverride ? normalize(tagOverride) : activeTag;
      const base = target && (target !== activeTag || !snapshot.loaded)
        ? await readPair(target)
        : { count: snapshot.count, verified: snapshot.verified };
      // Never let a manual edit drop below a count an import confirmed.
      const floor = base.verified ?? MIN_COUNT;
      const next = Math.min(Math.max(Math.round(n), floor), MAX_COUNT);
      await persist(next, base.verified, target);
    },
    [persist],
  );

  const verifyBuilderCount = useCallback(
    async (n: number, tagOverride?: string) => {
      const next = Math.min(Math.max(Math.round(n), MIN_COUNT), MAX_COUNT);
      await persist(next, next, tagOverride);
    },
    [persist],
  );

  const clearVerified = useCallback(
    async (tagOverride?: string) => {
      const target = tagOverride ? normalize(tagOverride) : activeTag;
      // Keep whatever count is already stored against the target - only the
      // import baseline goes away, never the number the user picked.
      const base = target && (target !== activeTag || !snapshot.loaded)
        ? await readPair(target)
        : { count: snapshot.count, verified: snapshot.verified };
      await persist(base.count, null, target);
    },
    [persist],
  );

  const floor = snapshot.verified ?? MIN_COUNT;

  return useMemo(
    () => ({
      count: snapshot.count,
      loaded: snapshot.loaded,
      verified: snapshot.verified,
      isVerified: snapshot.verified !== null && snapshot.count === snapshot.verified,
      // Both steppers stay inert until this account's stored values are in, so
      // the placeholder count can never be committed as a real edit.
      canDecrease: snapshot.loaded && snapshot.count > floor,
      canIncrease: snapshot.loaded && snapshot.count < MAX_COUNT,
      setBuilderCount,
      verifyBuilderCount,
      clearVerified,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, setBuilderCount, verifyBuilderCount, clearVerified],
  );
}