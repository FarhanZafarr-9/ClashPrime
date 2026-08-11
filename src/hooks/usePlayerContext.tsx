import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ClashPlayer, StoredAccount } from '../types/clash';
import {
  getPlayerTag,
  getApiToken,
  getCachedPlayer,
  cachePlayer,
  setLastMaxedTH,
  getActiveAccountTag,
  getActiveAccount,
  getAccounts,
  setActiveAccountTag,
  migrateToMultiAccount,
  saveAccount,
} from './usePlayer';
import { ClashAPI } from '../api/clash';
import { toJsonName, toStoreName } from '../utils/buildingCopies';
import { seedBuildingLevelsForTH } from '../utils/seedBuildingLevels';

interface PlayerContextValue {
  player: ClashPlayer | null;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  refresh: () => Promise<ClashPlayer | undefined>;
  tagVersion: number;
  setBuildingCopies: (name: string, levels: number[], maxLevel: number) => Promise<void>;
  setBulkLevels: (levels: Record<string, number>) => Promise<void>;
  setLastMaxed: (th: number) => Promise<void>;
  activeAccount: StoredAccount | null;
  accounts: StoredAccount[];
  switchAccount: (tag: string) => Promise<void>;
  refreshAccounts: () => Promise<void>;
  prefetchAccount: (tag: string, opts?: { token?: string; th?: number }) => Promise<void>;
  syncingTag: string | null;
  needsLastMaxed: boolean;
}

const PlayerContext = createContext<PlayerContextValue>({
  player: null,
  loading: true,
  error: null,
  lastSync: null,
  refresh: async () => undefined,
  tagVersion: 0,
  setBuildingCopies: async () => {},
  setBulkLevels: async () => {},
  setLastMaxed: async () => {},
  activeAccount: null,
  accounts: [],
  switchAccount: async () => {},
  refreshAccounts: async () => {},
  prefetchAccount: async () => {},
  syncingTag: null,
  needsLastMaxed: false,
});

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<ClashPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [tagVersion, setTagVersion] = useState(0);
  const [activeAccount, setActiveAccountState] = useState<StoredAccount | null>(null);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [needsLastMaxed, setNeedsLastMaxed] = useState(false);
  const [syncingTag, setSyncingTag] = useState<string | null>(null);
  const playerRef = useRef<ClashPlayer | null>(null);
  const syncingTagRef = useRef<string | null>(null);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const refreshAccounts = useCallback(async () => {
    const list = await getAccounts();
    setAccounts(list);
    const active = await getActiveAccount();
    setActiveAccountState(active);
  }, []);

  const fetchPlayer = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      const tag = await getPlayerTag();
      const token = await getApiToken();
      if (!tag || !token) {
        setLoading(false);
        return;
      }

      if (!force) {
        const cached = await getCachedPlayer();
        if (cached) {
          setPlayer(cached);
          setNeedsLastMaxed(!cached.lastMaxedTH);
          setLastSync(null);
          setLoading(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
        const retryCached = await getCachedPlayer();
        if (retryCached) {
          setPlayer(retryCached);
          setNeedsLastMaxed(!retryCached.lastMaxedTH);
          setLastSync(null);
          setLoading(false);
          return;
        }
      }

      const api = new ClashAPI(token);
      const data = await api.getPlayer(tag);
      const cached = await getCachedPlayer();
      if (cached) {
        data.buildingLevels = cached.buildingLevels;
        data.buildings = cached.buildings ?? data.buildings;
        data.lastMaxedTH = cached.lastMaxedTH;
      } else {
        const prev = playerRef.current;
        if (prev && prev.tag === tag) {
          data.buildingLevels = prev.buildingLevels;
          data.buildings = prev.buildings ?? data.buildings;
          data.lastMaxedTH = prev.lastMaxedTH;
        }
      }

      setPlayer(data);
      setNeedsLastMaxed(!data.lastMaxedTH);
      await cachePlayer(data);
      const existingAccts = await getAccounts();
      const acct = existingAccts.find((a) => a.tag === tag);
      if (acct) {
        acct.name = data.name;
        acct.townHallLevel = data.townHallLevel;
        await saveAccount(acct);
      }
      setLastSync(new Date());
      return data;
    } catch (e: any) {
      setError(e.message || 'Failed to fetch player data');
      const cached = await getCachedPlayer();
      if (cached) setPlayer(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchAccount = useCallback(async (tag: string) => {
    await setActiveAccountTag(tag);
    await refreshAccounts();
    playerRef.current = null;
    const cached = await getCachedPlayer();
    if (cached) {
      setPlayer(cached);
      setNeedsLastMaxed(!cached.lastMaxedTH);
      setLoading(false);
      setError(null);
    } else {
      setPlayer(null);
      await fetchPlayer(true);
    }
  }, [fetchPlayer, refreshAccounts]);

  const prefetchAccount = useCallback(async (tag: string, opts: { token?: string; th?: number } = {}) => {
    if (syncingTagRef.current === tag) return;
    syncingTagRef.current = tag;
    setSyncingTag(tag);
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);

    const finish = () => {
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
      if (syncingTagRef.current === tag) {
        syncingTagRef.current = null;
        setSyncingTag(null);
      }
    };

    prefetchTimerRef.current = setTimeout(() => {
      finish();
      (async () => {
        const accts = await getAccounts();
        if (accts.some((a) => a.tag === tag)) {
          await switchAccount(tag).catch(() => {});
        }
      })();
    }, 60000);

    try {
      const token = opts.token ?? (await getApiToken(tag));
      if (!token) {
        finish();
        return;
      }
      const api = new ClashAPI(token);
      const data = await api.getPlayer(tag);
      const th = opts.th && opts.th > 0 ? opts.th : data.townHallLevel;
      data.buildingLevels = seedBuildingLevelsForTH(data, th);
      data.lastMaxedTH = th;
      await cachePlayer(data, tag);
      const accts = await getAccounts();
      const acct = accts.find((a) => a.tag === tag);
      if (acct) {
        acct.name = data.name;
        acct.townHallLevel = data.townHallLevel;
        await saveAccount(acct);
      }
      await refreshAccounts();
      finish();
      await switchAccount(tag);
    } catch {
      // Fetch failed; the 60s timeout still switches so the account isn't locked forever.
    }
  }, [switchAccount, refreshAccounts]);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    (async () => {
      await migrateToMultiAccount();
      await refreshAccounts();
      await fetchPlayer();
    })();
  }, [fetchPlayer, refreshAccounts]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => () => {
    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
  }, []);

  const refresh = useCallback(async () => {
    return await fetchPlayer(true);
  }, [fetchPlayer]);

  const bumpTagVersion = useCallback(() => {
    setTagVersion((v) => v + 1);
  }, []);

  const setBuildingCopies = useCallback(async (name: string, levels: number[], maxLevel: number) => {
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      const jsonName = toJsonName(name);
      const storeName = toStoreName(name);
      const buildings = (base.buildings ?? []).filter((b) => b.name.toLowerCase() !== jsonName.toLowerCase());
      const copies = levels.map((level) => ({ name: jsonName, level, maxLevel }));
      const updated = { ...base, buildings: [...buildings, ...copies] };
      const rep = levels.filter((l) => l > 0).sort((a, b) => b - a)[0] ?? 0;
      updated.buildingLevels = { ...(base.buildingLevels || {}), [storeName]: rep };
      if (base.tag) cachePlayer(updated, base.tag);
      return updated;
    });
  }, []);

  const setBulkLevels = useCallback(async (levels: Record<string, number>) => {
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      const updated = { ...base, buildingLevels: { ...(base.buildingLevels || {}), ...levels } };
      if (base.buildings?.length) {
        updated.buildings = base.buildings.map((b) =>
          levels[b.name] != null ? { ...b, level: levels[b.name] } : b,
        );
      }
      if (base.tag) cachePlayer(updated, base.tag);
      return updated;
    });
  }, []);

  const setLastMaxed = useCallback(async (th: number) => {
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      if (base.tag) setLastMaxedTH(th, base.tag);
      setNeedsLastMaxed(false);
      return { ...base, lastMaxedTH: th };
    });
  }, []);

  const value: PlayerContextValue & { bumpTagVersion: () => void } = {
    player,
    loading,
    error,
    lastSync,
    refresh,
    tagVersion,
    bumpTagVersion,
    setBuildingCopies,
    setBulkLevels,
    setLastMaxed,
    activeAccount,
    accounts,
    switchAccount,
    refreshAccounts,
    prefetchAccount,
    syncingTag,
    needsLastMaxed,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return useContext(PlayerContext);
}

export function usePlayerActions() {
  const ctx = useContext(PlayerContext);
  return {
    refresh: ctx.refresh,
    bumpTagVersion: (ctx as any).bumpTagVersion,
  };
}
