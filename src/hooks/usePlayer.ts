import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClashPlayer, StoredAccount } from '../types/clash';

const PLAYER_TAG_KEY = 'clashprime_player_tag';
const API_TOKEN_KEY = 'clashprime_api_token';
const PLAYER_CACHE_KEY = 'clashprime_player_cache';
const SAVED_BASES_KEY = 'clashprime_saved_bases';
const FAVORITES_KEY = 'clashprime_favorites';
const LAST_MAXED_TH_KEY = 'clashprime_last_maxed_th';
const ACCOUNTS_KEY = 'clashprime_accounts';
const ACTIVE_ACCOUNT_KEY = 'clashprime_active_account';

export interface SavedBase {
  id: string;
  name: string;
  category: string;
  townHallLevel: number;
  rating: number;
  tags: string[];
  thumbnail?: string;
  url?: string;
  copiedAt?: string;
}

function acctKey(base: string, tag: string): string {
  return `${base}_${tag}`;
}

// --- Account Registry ---

export async function getAccounts(): Promise<StoredAccount[]> {
  const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveAccount(account: StoredAccount): Promise<void> {
  const accounts = await getAccounts();
  const idx = accounts.findIndex((a) => a.tag === account.tag);
  if (idx >= 0) {
    accounts[idx] = account;
  } else {
    accounts.push(account);
  }
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function removeAccount(tag: string): Promise<void> {
  const accounts = await getAccounts();
  await AsyncStorage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify(accounts.filter((a) => a.tag !== tag))
  );
  const activeTag = await getActiveAccountTag();
  if (activeTag === tag) {
    await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }
}

export async function getActiveAccountTag(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

export async function setActiveAccountTag(tag: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, tag);
  const accounts = await getAccounts();
  const idx = accounts.findIndex((a) => a.tag === tag);
  if (idx >= 0) {
    accounts[idx].lastUsedAt = new Date().toISOString();
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
}

export async function getActiveAccount(): Promise<StoredAccount | null> {
  const tag = await getActiveAccountTag();
  if (!tag) return null;
  const accounts = await getAccounts();
  return accounts.find((a) => a.tag === tag) || null;
}

// --- Migration ---

export async function migrateToMultiAccount(): Promise<void> {
  const existing = await getAccounts();
  if (existing.length > 0) return;
  const legacyTag = await AsyncStorage.getItem(PLAYER_TAG_KEY);
  if (!legacyTag) return;
  const legacyToken = await AsyncStorage.getItem(API_TOKEN_KEY) || '';
  const account: StoredAccount = {
    tag: legacyTag,
    name: legacyTag,
    townHallLevel: 0,
    addedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };
  const accounts = [account];
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, legacyTag);
  const cache = await AsyncStorage.getItem(PLAYER_CACHE_KEY);
  if (cache) {
    await AsyncStorage.setItem(acctKey(PLAYER_CACHE_KEY, legacyTag), cache);
  }
  const lastMaxed = await AsyncStorage.getItem(LAST_MAXED_TH_KEY);
  if (lastMaxed) {
    await AsyncStorage.setItem(acctKey(LAST_MAXED_TH_KEY, legacyTag), lastMaxed);
  }
  const savedBases = await AsyncStorage.getItem(SAVED_BASES_KEY);
  if (savedBases) {
    await AsyncStorage.setItem(acctKey(SAVED_BASES_KEY, legacyTag), savedBases);
  }
  const favs = await AsyncStorage.getItem(FAVORITES_KEY);
  if (favs) {
    await AsyncStorage.setItem(acctKey(FAVORITES_KEY, legacyTag), favs);
  }
  await AsyncStorage.setItem(acctKey(PLAYER_TAG_KEY, legacyTag), legacyTag);
  await AsyncStorage.setItem(acctKey(API_TOKEN_KEY, legacyTag), legacyToken);
}

// --- Player Tag ---

export async function getPlayerTag(accountTag?: string): Promise<string> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    const namespaced = await AsyncStorage.getItem(acctKey(PLAYER_TAG_KEY, tag));
    if (namespaced) return namespaced;
    if (accountTag) return '';
  }
  const legacy = await AsyncStorage.getItem(PLAYER_TAG_KEY);
  return legacy || '';
}

export async function setPlayerTag(tag: string): Promise<void> {
  await AsyncStorage.setItem(acctKey(PLAYER_TAG_KEY, tag), tag);
  await AsyncStorage.setItem(PLAYER_TAG_KEY, tag);
}

// --- API Token ---

export async function getApiToken(accountTag?: string): Promise<string> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    const namespaced = await AsyncStorage.getItem(acctKey(API_TOKEN_KEY, tag));
    if (namespaced) return namespaced;
    if (accountTag) return '';
  }
  const legacy = await AsyncStorage.getItem(API_TOKEN_KEY);
  return legacy || '';
}

export async function setApiToken(token: string, accountTag?: string): Promise<void> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    await AsyncStorage.setItem(acctKey(API_TOKEN_KEY, tag), token);
  }
  await AsyncStorage.setItem(API_TOKEN_KEY, token);
}

// --- Player Cache ---

export async function getCachedPlayer(accountTag?: string): Promise<ClashPlayer | null> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    const raw = await AsyncStorage.getItem(acctKey(PLAYER_CACHE_KEY, tag));
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    if (accountTag) return null;
  }
  const raw = await AsyncStorage.getItem(PLAYER_CACHE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function cachePlayer(player: ClashPlayer, accountTag?: string): Promise<void> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    await AsyncStorage.setItem(acctKey(PLAYER_CACHE_KEY, tag), JSON.stringify(player));
  }
  await AsyncStorage.setItem(PLAYER_CACHE_KEY, JSON.stringify(player));
}

export async function updatePlayerBuildingLevel(name: string, level: number, accountTag?: string): Promise<void> {
  const player = await getCachedPlayer(accountTag);
  if (!player) return;
  player.buildingLevels = { ...player.buildingLevels, [name]: level };
  await cachePlayer(player, accountTag);
}

export async function setBulkBuildingLevels(levels: Record<string, number>, accountTag?: string): Promise<void> {
  const player = await getCachedPlayer(accountTag);
  if (!player) return;
  player.buildingLevels = { ...(player.buildingLevels || {}), ...levels };
  await cachePlayer(player, accountTag);
}

// --- Last Maxed TH ---

export async function setLastMaxedTH(th: number, accountTag?: string): Promise<void> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    await AsyncStorage.setItem(acctKey(LAST_MAXED_TH_KEY, tag), th.toString());
  }
  await AsyncStorage.setItem(LAST_MAXED_TH_KEY, th.toString());
  const player = await getCachedPlayer(accountTag);
  if (!player) return;
  player.lastMaxedTH = th;
  await cachePlayer(player, accountTag);
}

export async function getLastMaxedTH(accountTag?: string): Promise<number | null> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    const raw = await AsyncStorage.getItem(acctKey(LAST_MAXED_TH_KEY, tag));
    if (raw !== null) return parseInt(raw, 10);
    if (accountTag) return null;
  }
  const raw = await AsyncStorage.getItem(LAST_MAXED_TH_KEY);
  return raw ? parseInt(raw, 10) : null;
}

// --- Saved Bases ---

export async function getSavedBases(accountTag?: string): Promise<SavedBase[]> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    const raw = await AsyncStorage.getItem(acctKey(SAVED_BASES_KEY, tag));
    if (raw) {
      try { return JSON.parse(raw); } catch { return []; }
    }
    if (accountTag) return [];
  }
  const raw = await AsyncStorage.getItem(SAVED_BASES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function saveBase(base: SavedBase, accountTag?: string): Promise<void> {
  const tag = accountTag || await getActiveAccountTag();
  const bases = await getSavedBases(tag || undefined);
  const existing = bases.findIndex((b) => b.id === base.id);
  if (existing >= 0) {
    bases[existing] = base;
  } else {
    bases.unshift(base);
  }
  const key = tag ? acctKey(SAVED_BASES_KEY, tag) : SAVED_BASES_KEY;
  await AsyncStorage.setItem(key, JSON.stringify(bases));
  if (tag && tag !== (await getActiveAccountTag())) {
    await AsyncStorage.setItem(SAVED_BASES_KEY, JSON.stringify(bases));
  }
}

export async function removeBase(id: string, accountTag?: string): Promise<void> {
  const tag = accountTag || await getActiveAccountTag();
  const bases = await getSavedBases(tag || undefined);
  const key = tag ? acctKey(SAVED_BASES_KEY, tag) : SAVED_BASES_KEY;
  await AsyncStorage.setItem(key, JSON.stringify(bases.filter((b) => b.id !== id)));
}

// --- Favorites ---

export async function getFavorites(accountTag?: string): Promise<string[]> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    const raw = await AsyncStorage.getItem(acctKey(FAVORITES_KEY, tag));
    if (raw) {
      try { return JSON.parse(raw); } catch { return []; }
    }
    if (accountTag) return [];
  }
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function toggleFavorite(id: string, accountTag?: string): Promise<boolean> {
  const tag = accountTag || await getActiveAccountTag();
  const favs = await getFavorites(tag || undefined);
  const idx = favs.indexOf(id);
  const key = tag ? acctKey(FAVORITES_KEY, tag) : FAVORITES_KEY;
  if (idx >= 0) {
    favs.splice(idx, 1);
    await AsyncStorage.setItem(key, JSON.stringify(favs));
    return false;
  } else {
    favs.push(id);
    await AsyncStorage.setItem(key, JSON.stringify(favs));
    return true;
  }
}

// --- Backfill account names/TH from cached player data ---

export async function backfillAccountNames(accounts: StoredAccount[]): Promise<void> {
  let changed = false;
  for (const acct of accounts) {
    if (acct.townHallLevel === 0 || acct.name === acct.tag) {
      const cached = await getCachedPlayer(acct.tag);
      if (cached) {
        acct.name = cached.name;
        acct.townHallLevel = cached.townHallLevel;
        changed = true;
      }
    }
  }
  if (changed) {
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
}

// --- Cache & Export ---

const CACHE_KEY_PREFIXES = [
  'troop_detail_v7_',
  'bases_clashly_th_',
  'bases_clashly_bh_',
  'events_data_v1',
  'news_data_v1',
  'clasharmies_',
  'siege_machine_names',
  'pet_names',
  'super_troop_names',
];

export async function clearAppCache(accountTag?: string): Promise<void> {
  const tag = accountTag || await getActiveAccountTag();
  if (tag) {
    await AsyncStorage.removeItem(acctKey(PLAYER_CACHE_KEY, tag));
  } else {
    await AsyncStorage.removeItem(PLAYER_CACHE_KEY);
  }
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) =>
    CACHE_KEY_PREFIXES.some((prefix) => k.startsWith(prefix) || k === prefix)
  );
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}

export async function exportAppData(accountTag?: string): Promise<string> {
  const tag = accountTag || await getActiveAccountTag();
  const [tagVal, player, savedBases, favorites] = await Promise.all([
    getPlayerTag(tag || undefined),
    getCachedPlayer(tag || undefined),
    getSavedBases(tag || undefined),
    getFavorites(tag || undefined),
  ]);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'ClashPrime',
      tag: tagVal,
      player,
      savedBases,
      favorites,
    },
    null,
    2,
  );
}
