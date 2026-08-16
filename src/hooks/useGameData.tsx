import React, { createContext, useContext } from 'react';
import { getArmyNameSets } from '../utils/armyData';

interface GameDataContextValue {
  siegeMachineNames: string[];
  petNames: string[];
  superTroopNames: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const nameSets = getArmyNameSets();

const GameDataContext = createContext<GameDataContextValue>({
  siegeMachineNames: nameSets.siege,
  petNames: nameSets.pets,
  superTroopNames: nameSets.superTroops,
  loading: false,
  error: null,
  refresh: async () => {},
});

export function GameDataProvider({ children }: { children: React.ReactNode }) {
  const value: GameDataContextValue = {
    siegeMachineNames: nameSets.siege,
    petNames: nameSets.pets,
    superTroopNames: nameSets.superTroops,
    loading: false,
    error: null,
    refresh: async () => {},
  };

  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
}

export function useGameData() {
  return useContext(GameDataContext);
}
