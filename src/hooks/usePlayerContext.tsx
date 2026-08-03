import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ClashPlayer, StoredAccount } from '../types/clash';
import {
  getPlayerTag,
  getApiToken,
  getCachedPlayer,
  cachePlayer,
  updatePlayerBuildingLevel,
  setBulkBuildingLevels,
  setLastMaxedTH,
  getActiveAccountTag,
  getActiveAccount,
  getAccounts,
  setActiveAccountTag,
  migrateToMultiAccount,
  saveAccount,
} from './usePlayer';
import { ClashAPI } from '../api/clash';

interface PlayerContextValue {
  player: ClashPlayer | null;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  refresh: () => Promise<ClashPlayer | undefined>;
  tagVersion: number;
  upgradeBuilding: (name: string) => Promise<void>;
  setBuildingLevel: (name: string, level: number) => Promise<void>;
  setBulkLevels: (levels: Record<string, number>) => Promise<void>;
  setLastMaxed: (th: number) => Promise<void>;
  activeAccount: StoredAccount | null;
  accounts: StoredAccount[];
  switchAccount: (tag: string) => Promise<void>;
  refreshAccounts: () => Promise<void>;
  needsLastMaxed: boolean;
}

const PlayerContext = createContext<PlayerContextValue>({
  player: null,
  loading: true,
  error: null,
  lastSync: null,
  refresh: async () => undefined,
  tagVersion: 0,
  upgradeBuilding: async () => {},
  setBuildingLevel: async () => {},
  setBulkLevels: async () => {},
  setLastMaxed: async () => {},
  activeAccount: null,
  accounts: [],
  switchAccount: async () => {},
  refreshAccounts: async () => {},
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
  const playerRef = useRef<ClashPlayer | null>(null);
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
        data.lastMaxedTH = cached.lastMaxedTH;
      } else {
        const prev = playerRef.current;
        if (prev) {
          data.buildingLevels = prev.buildingLevels;
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

  const refresh = useCallback(async () => {
    return await fetchPlayer(true);
  }, [fetchPlayer]);

  const bumpTagVersion = useCallback(() => {
    setTagVersion((v) => v + 1);
  }, []);

  const setBuildingLevel = useCallback(async (name: string, level: number) => {
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      const updated = { ...base, buildingLevels: { ...(base.buildingLevels || {}), [name]: level } };
      if (base.tag) cachePlayer(updated, base.tag);
      return updated;
    });
  }, []);

  const upgradeBuilding = useCallback(async (name: string) => {
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      const current = base.buildingLevels?.[name] ?? 0;
      const updated = { ...base, buildingLevels: { ...(base.buildingLevels || {}), [name]: current + 1 } };
      if (base.tag) cachePlayer(updated, base.tag);
      return updated;
    });
  }, []);

  const setBulkLevels = useCallback(async (levels: Record<string, number>) => {
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      const updated = { ...base, buildingLevels: { ...(base.buildingLevels || {}), ...levels } };
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
    upgradeBuilding,
    setBuildingLevel,
    setBulkLevels,
    setLastMaxed,
    activeAccount,
    accounts,
    switchAccount,
    refreshAccounts,
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
