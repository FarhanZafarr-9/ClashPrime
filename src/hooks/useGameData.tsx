import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSiegeMachineNames, getPetNames, getSuperTroopNames, clearGameDataCache } from '../api/gameData';

interface GameDataContextValue {
  siegeMachineNames: string[];
  petNames: string[];
  superTroopNames: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const GameDataContext = createContext<GameDataContextValue>({
  siegeMachineNames: [],
  petNames: [],
  superTroopNames: [],
  loading: true,
  error: null,
  refresh: async () => {},
});

export function GameDataProvider({ children }: { children: React.ReactNode }) {
  const [siegeMachineNames, setSiegeMachineNames] = useState<string[]>([]);
  const [petNames, setPetNames] = useState<string[]>([]);
  const [superTroopNames, setSuperTroopNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const [siege, pets, supers] = await Promise.all([
        getSiegeMachineNames(force),
        getPetNames(force),
        getSuperTroopNames(force),
      ]);
      setSiegeMachineNames(siege);
      setPetNames(pets);
      setSuperTroopNames(supers);
    } catch (e: any) {
      setError(e.message || 'Failed to load game data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refresh = useCallback(async () => {
    await clearGameDataCache();
    await fetch(true);
  }, [fetch]);

  return (
    <GameDataContext.Provider value={{ siegeMachineNames, petNames, superTroopNames, loading, error, refresh }}>
      {children}
    </GameDataContext.Provider>
  );
}

export function useGameData() {
  return useContext(GameDataContext);
}
