import { ClashPlayer, ClanWar, WarLogEntry } from '../types/clash';

const BASE_URL = 'https://cocproxy.royaleapi.dev/v1';

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
    return 'Access denied. Your API token may be invalid or lack permission, or the clan\u2019s war log may be private or unavailable (e.g. fewer than 5 recorded wars).';
  }
  if (reason === 'notFound') {
    return 'Not found. The clan tag may be invalid or this resource does not exist.';
  }
  switch (status) {
    case 0:
      return 'Couldn\'t reach the Clash of Clans servers. Check your connection and try again.';
    case 403:
      return 'Access denied. Your API token may be invalid or lack permission, or this clan\u2019s war data may be private or unavailable.';
    case 404:
      return 'Not found. The clan tag may be invalid or this resource no longer exists.';
    case 429:
      return 'Rate limited. Too many requests — wait a moment and pull to refresh.';
    case 502:
    case 503:
      return 'The Clash of Clans API is temporarily unavailable. Try again shortly.';
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
    try {
      res = await fetch(`${BASE_URL}${path}`, { headers: this.headers() });
    } catch (e) {
      throw new ClashAPIError(
        'Couldn\'t reach the Clash of Clans servers. Check your connection and try again.',
        0
      );
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
    return this.fetch(`/players/${encodeURIComponent(tag)}`);
  }

  async searchClans(query: string): Promise<any> {
    return this.fetch(`/clans?name=${encodeURIComponent(query)}&limit=10`);
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
}
