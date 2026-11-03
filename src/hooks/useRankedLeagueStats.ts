import type { RankedLeagueGroup, RankedLeagueStats } from '../types/rankedLeague';
import { getRankedProjectionRules, type RankedProjectionRules } from '../utils/rankedLeagueRules';
import { projectRankedLeague, type RankedProjection } from '../utils/rankedLeagueProjection';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { ClashAPI } from '../api/clash';
import { getApiToken } from './usePlayer';
import { rankedLeagueStats } from '../utils/rankedLeagueStats';
import type { ClashPlayer } from '../types/clash';


export interface RankedStatsState {
  updatedAt?: string;
  reload: () => void;
  rules: RankedProjectionRules | null;
  projection: RankedProjection | null;
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  stats: RankedLeagueStats | null;
  message: string;
}

// Share short-lived requests between Home and its pushed tournament screen.
const requests = new Map<string, { at: number; promise: Promise<RankedLeagueGroup> }>();
function loadGroup(key: string, tag: string, groupTag: string, seasonId: number): Promise<RankedLeagueGroup> {
  const cached = requests.get(key);
  if (cached && Date.now() - cached.at < 30000) return cached.promise;
  const promise = (async () => {
    const token = await getApiToken(tag);
    if (!token) throw new Error('No API token');
    return new ClashAPI(token).getPlayerLeagueGroup(groupTag, seasonId, tag);
  })();
  requests.set(key, { at: Date.now(), promise });
  if (requests.size > 16) requests.delete(requests.keys().next().value!);
  promise.catch(() => { if (requests.get(key)?.promise === promise) requests.delete(key); });
  return promise;
}

/** Refresh alongside player sync; discard responses after an account/group switch. */
export function useRankedLeagueStats(player: ClashPlayer | null, lastSync: Date | null): RankedStatsState {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const tag = player?.tag ?? '';
  const leagueName = player?.leagueTier?.name ?? player?.league?.name;
  const rules = useMemo(() => getRankedProjectionRules(leagueName), [leagueName]);
  const groupTag = player?.currentLeagueGroupTag;
  const seasonId = player?.currentLeagueSeasonId;
  const syncVersion = lastSync?.getTime() ?? 0;
  const key = [tag, groupTag, seasonId, syncVersion, leagueName, revision].join(':');
  const [state, setState] = useState<Omit<RankedStatsState, 'rules' | 'projection' | 'reload'> & { key: string }>({ key: '', status: 'unavailable', stats: null, message: 'No active ranked group' });
  useEffect(() => {
    if (!tag || !groupTag || seasonId == null) return;
    let alive = true;
    const load = async () => {
      try {
        const group = await loadGroup(key, tag, groupTag, seasonId);
        const stats = rankedLeagueStats(group, tag);
        if (alive) setState({ key, updatedAt: new Date(requests.get(key)?.at ?? Date.now()).toISOString(), status: stats ? 'ready' : 'unavailable', stats, message: stats ? 'Current ranked tournament' : 'Player not listed in the ranked group' });
      } catch {
        if (alive) setState({ key, status: 'error', stats: null, message: 'Ranked stats unavailable · pull to retry' });
      }
    };
    void load();
    return () => { alive = false; };
  }, [tag, groupTag, seasonId, syncVersion, key]);
  const projection = useMemo(() => state.key === key && state.stats ? projectRankedLeague(state.stats, rules, tag) : null, [state, key, rules, tag]);
  if (!tag || !groupTag || seasonId == null) return { status: 'unavailable', stats: null, rules, reload, projection: null, message: 'No active ranked group' };
  return state.key === key ? { ...state, rules, projection, reload } : { status: 'loading', stats: null, rules, reload, projection: null, message: 'Loading ranked stats…' };
}
