import { ClashPlayer, ClanWar, WarLogEntry } from '../types/clash';

const BASE_URL = 'https://api.clashofclans.com/v1';

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
    const res = await fetch(`${BASE_URL}${path}`, { headers: this.headers() });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API Error ${res.status}: ${err}`);
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
