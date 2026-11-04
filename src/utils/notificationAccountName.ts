import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StoredAccount } from '../types/clash';

/** Read the destination account, never whichever account happens to be active. */
export async function notificationAccountName(tag: string): Promise<string | null> {
  const normalized = tag.replace(/[^a-z0-9]/gi, '').toUpperCase();
  let account: StoredAccount | undefined;
  try {
    const raw = await AsyncStorage.getItem('clashprime_accounts');
    const accounts: StoredAccount[] = raw ? JSON.parse(raw) : [];
    account = accounts.find(row => row.tag.replace(/[^a-z0-9]/gi, '').toUpperCase() === normalized);
  } catch { /* A cached player can still supply the name. */ }
  try {
    const raw = await AsyncStorage.getItem(`clashprime_player_cache_${account?.tag ?? tag}`);
    const name = raw ? JSON.parse(raw)?.name : null;
    if (typeof name === 'string' && name.trim()) return name.trim();
  } catch { /* Fall back to the account registry. */ }
  return account?.name?.trim() || null;
}

export function upgradeCompletionBody(name: string | null): string {
  return `Upgrade complete${name ? ` for ${name}` : ''}. Open ClashPrime to confirm the level.`;
}
