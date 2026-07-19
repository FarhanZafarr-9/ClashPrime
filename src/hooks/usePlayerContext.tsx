import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ClashPlayer } from '../types/clash';
import {
  getPlayerTag,
  getApiToken,
  getCachedPlayer,
  cachePlayer,
} from './usePlayer';
import { ClashAPI } from '../api/clash';

interface PlayerContextValue {
  player: ClashPlayer | null;
  loading: boolean;
  error: string | null;
  lastSync: Date | null;
  refresh: () => Promise<void>;
  tagVersion: number;
}

const PlayerContext = createContext<PlayerContextValue>({
  player: null,
  loading: true,
  error: null,
  lastSync: null,
  refresh: async () => {},
  tagVersion: 0,
});

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<ClashPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [tagVersion, setTagVersion] = useState(0);

  const fetchPlayer = useCallback(async (force = false) => {
    try {
      setLoading(true);
      setError(null);

      if (!force) {
        const cached = await getCachedPlayer();
        if (cached) {
          setPlayer(cached);
          setLoading(false);
          return;
        }
      }

      const tag = await getPlayerTag();
      const token = await getApiToken();
      const api = new ClashAPI(token);
      const data = await api.getPlayer(tag);

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

  const refresh = useCallback(async () => {
    await fetchPlayer(true);
  }, [fetchPlayer]);

  const bumpTagVersion = useCallback(() => {
    setTagVersion((v) => v + 1);
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
