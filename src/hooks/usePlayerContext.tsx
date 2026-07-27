import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ClashPlayer } from '../types/clash';
import {
  getPlayerTag,
  getApiToken,
  getCachedPlayer,
  cachePlayer,
  updatePlayerBuildingLevel,
  setBulkBuildingLevels,
  setLastMaxedTH,
} from './usePlayer';
import { ClashAPI } from '../api/clash';

interface PlayerContextValue {
  player: ClashPlayer | null;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  refresh: () => Promise<void>;
  tagVersion: number;
  upgradeBuilding: (name: string) => Promise<void>;
  setBuildingLevel: (name: string, level: number) => Promise<void>;
  setBulkLevels: (levels: Record<string, number>) => Promise<void>;
  setLastMaxed: (th: number) => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue>({
  player: null,
  loading: true,
  error: null,
  lastSync: null,
  refresh: async () => {},
  tagVersion: 0,
  upgradeBuilding: async () => {},
  setBuildingLevel: async () => {},
  setBulkLevels: async () => {},
  setLastMaxed: async () => {},
});

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<ClashPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [tagVersion, setTagVersion] = useState(0);
  const playerRef = useRef<ClashPlayer | null>(null);

  const fetchPlayer = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      if (!force) {
        const cached = await getCachedPlayer();
        if (cached) {
          setPlayer(cached);
          setLastSync(null);
          setLoading(false);
          return;
        }
        // Retry cache once after a short delay (race condition on first login)
        await new Promise((r) => setTimeout(r, 300));
        const retryCached = await getCachedPlayer();
        if (retryCached) {
          setPlayer(retryCached);
          setLastSync(null);
          setLoading(false);
          return;
        }
      }

      const tag = await getPlayerTag();
      const token = await getApiToken();
      const api = new ClashAPI(token);
      const data = await api.getPlayer(tag);
      const prev = playerRef.current;
      if (prev) {
        data.buildingLevels = prev.buildingLevels;
        data.lastMaxedTH = prev.lastMaxedTH;
      }

      setPlayer(data);
      await cachePlayer(data);
      setLastSync(new Date());
    } catch (e: any) {
      setError(e.message || 'Failed to fetch player data');
      const cached = await getCachedPlayer();
      if (cached) setPlayer(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayer();
  }, [fetchPlayer, tagVersion]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  const refresh = useCallback(async () => {
    await fetchPlayer(true);
  }, [fetchPlayer]);

  const bumpTagVersion = useCallback(() => {
    setTagVersion((v) => v + 1);
  }, []);
  const setBuildingLevel = useCallback(async (name: string, level: number) => {
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      const updated = { ...base, buildingLevels: { ...(base.buildingLevels || {}), [name]: level } };
      cachePlayer(updated);
      return updated;
    });
  }, []);

  const upgradeBuilding = useCallback(async (name: string) => {
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      const current = base.buildingLevels?.[name] ?? 0;
      const updated = { ...base, buildingLevels: { ...(base.buildingLevels || {}), [name]: current + 1 } };
      cachePlayer(updated);
      return updated;
    });
  }, []);

  const setBulkLevels = useCallback(async (levels: Record<string, number>) => {
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      const updated = { ...base, buildingLevels: { ...(base.buildingLevels || {}), ...levels } };
      cachePlayer(updated);
      return updated;
    });
  }, []);

  const setLastMaxed = useCallback(async (th: number) => {
    setLastMaxedTH(th);
    setPlayer((prev) => {
      const base = prev || {} as ClashPlayer;
      return { ...base, lastMaxedTH: th };
    });
  }, []);

  // Expose bumpTagVersion on the context value so Settings can trigger re-fetch
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
