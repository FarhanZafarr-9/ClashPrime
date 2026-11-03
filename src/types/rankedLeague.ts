export interface RankedLeagueMember {
  playerTag: string;
  playerName?: string;
  leagueTrophies?: number;
  rank?: number;
  placement?: number;
  attackWinCount?: number;
  attackLoseCount?: number;
  defenseWinCount?: number;
  defenseLoseCount?: number;
}

export interface RankedBattleLog {
  opponentName?: string;
  opponentPlayerTag?: string;
  trophies?: number;
  stars?: number;
  destructionPercentage?: number;
  creationTime?: string;
}

export interface RankedLeagueGroup {
  members?: RankedLeagueMember[];
  attackLogs?: RankedBattleLog[];
  defenseLogs?: RankedBattleLog[];
}

export interface RankedLeagueStats {
  members: RankedLeagueMember[];
  attackLogs: RankedBattleLog[] | null;
  defenseLogs: RankedBattleLog[] | null;
  trophies: number | null;
  position: number | null;
  positionIsOfficial: boolean;
  tied: boolean;
  groupSize: number;
  attackWins: number | null;
  attackLosses: number | null;
  defenseWins: number | null;
  defenseLosses: number | null;
}
