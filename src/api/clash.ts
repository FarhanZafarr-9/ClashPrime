import { ClashPlayer } from '../types/clash';

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

  async getPlayer(tag: string): Promise<ClashPlayer> {
    const encoded = encodeURIComponent(tag);
    const res = await fetch(`${BASE_URL}/players/${encoded}`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API Error ${res.status}: ${err}`);
    }
    return res.json();
  }

  async searchClans(query: string): Promise<any> {
    const res = await fetch(
      `${BASE_URL}/clans?name=${encodeURIComponent(query)}&limit=10`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`API Error ${res.status}`);
    return res.json();
  }
}
