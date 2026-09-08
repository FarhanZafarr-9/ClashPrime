import { ClashPlayer, Clan, ClanWar, WarLogEntry } from '../types/clash';

const BASE_URL = 'https://cocproxy.royaleapi.dev/v1';
const FETCH_TIMEOUT_MS = 15_000;

export class ClashAPIError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status: number, reason?: string) {
    super(message);
    this.name = 'ClashAPIError';
    this.status = status;
    this.reason = reason;
  }
}

function friendlyStatusMessage(status: number, reason?: string, body?: string): string {
  if (reason === 'accessDenied') {
    return 'Access denied. Your API token may lack permission for this clan, or its war log is private (war logs become public after roughly 5 recorded wars).';
  }
  if (reason === 'notFound') {
    return 'Not found. Check the player or clan tag — it may be incorrect, or this data is no longer available.';
  }
  switch (status) {
    case 0:
      return 'Couldn\u2019t reach the Clash of Clans servers. Check your connection and try again.';
    case 403:
      return 'Access denied. Verify your API token in Settings, confirm the account has the right permissions, and whitelist IP 45.79.218.79 (the app uses a proxy).';
    case 404:
      return 'Not found. The player or clan tag may be wrong, or this account\u2019s data has changed.';
    case 429:
      return 'Rate limited. Too many requests in a short time — wait a minute, then pull to refresh.';
    case 502:
    case 503:
      return 'The Clash of Clans API is temporarily unavailable (maintenance or overload). Give it a moment and try again.';
    default:
      break;
  }
  const detail = (body && body.trim()) || reason || '';
  return detail ? `API error ${status}: ${detail}` : `API error ${status}`;
}

export class ClashAPI {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };
  }

  private async fetch<T>(path: string): Promise<T> {
    let res: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        headers: this.headers(),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new ClashAPIError('Connection timed out. The Clash of Clans API may be temporarily unavailable. Try again shortly.', 0);
      }
      throw new ClashAPIError(
        'Couldn\'t reach the Clash of Clans servers. Check your connection and try again.',
        0
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      let reason: string | undefined;
      let body: string | undefined;
      try {
        const json = await res.json();
        if (json && typeof json === 'object') {
          reason = (json as any).reason;
          body = (json as any).message;
        }
      } catch {
        body = await res.text();
      }
      throw new ClashAPIError(friendlyStatusMessage(res.status, reason, body), res.status, reason);
    }
    return res.json();
  }

  async getPlayer(tag: string): Promise<ClashPlayer> {
    return this.fetch<ClashPlayer>(`/players/${encodeURIComponent(tag)}`);
  }

  async searchClans(query: string): Promise<any> {
    return this.fetch(`/clans?name=${encodeURIComponent(query)}&limit=10`);
  }

  async getClan(clanTag: string): Promise<Clan> {
    return this.fetch(`/clans/${encodeURIComponent(clanTag)}`);
  }

  async getCurrentWar(clanTag: string): Promise<ClanWar> {
    return this.fetch(`/clans/${encodeURIComponent(clanTag)}/currentwar`);
  }

  async getWarLog(clanTag: string, limit = 25): Promise<{ items: WarLogEntry[] }> {
    const data = await this.fetch<{ items: WarLogEntry[] }>(`/clans/${encodeURIComponent(clanTag)}/warlog?limit=${limit}`);
    return data;
  }

  async getCwlLeagueGroup(clanTag: string): Promise<any> {
    return this.fetch(`/clans/${encodeURIComponent(clanTag)}/currentwar/leaguegroup`);
  }

  async getCwlWar(warTag: string): Promise<ClanWar> {
    return this.fetch(`/clanwarleagues/wars/${encodeURIComponent(warTag)}`);
  }
}
