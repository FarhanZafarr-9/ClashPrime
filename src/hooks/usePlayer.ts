import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClashPlayer } from '../types/clash';

const PLAYER_TAG_KEY = 'clashprime_player_tag';
const API_TOKEN_KEY = 'clashprime_api_token';
const PLAYER_CACHE_KEY = 'clashprime_player_cache';
const SAVED_BASES_KEY = 'clashprime_saved_bases';
const FAVORITES_KEY = 'clashprime_favorites';

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

export async function getPlayerTag(): Promise<string> {
  const tag = await AsyncStorage.getItem(PLAYER_TAG_KEY);
  return tag || '';
}

export async function setPlayerTag(tag: string): Promise<void> {
  await AsyncStorage.setItem(PLAYER_TAG_KEY, tag);
}

export async function getApiToken(): Promise<string> {
  const token = await AsyncStorage.getItem(API_TOKEN_KEY);
  return token || '';
}

export async function setApiToken(token: string): Promise<void> {
  await AsyncStorage.setItem(API_TOKEN_KEY, token);
}

export async function getCachedPlayer(): Promise<ClashPlayer | null> {
  const raw = await AsyncStorage.getItem(PLAYER_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cachePlayer(player: ClashPlayer): Promise<void> {
  await AsyncStorage.setItem(PLAYER_CACHE_KEY, JSON.stringify(player));
}

export async function getSavedBases(): Promise<SavedBase[]> {
  const raw = await AsyncStorage.getItem(SAVED_BASES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveBase(base: SavedBase): Promise<void> {
  const bases = await getSavedBases();
  const existing = bases.findIndex((b) => b.id === base.id);
  if (existing >= 0) {
    bases[existing] = base;
  } else {
    bases.unshift(base);
  }
  await AsyncStorage.setItem(SAVED_BASES_KEY, JSON.stringify(bases));
}

export async function removeBase(id: string): Promise<void> {
  const bases = await getSavedBases();
  await AsyncStorage.setItem(
    SAVED_BASES_KEY,
    JSON.stringify(bases.filter((b) => b.id !== id))
  );
}

export async function getFavorites(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FAVORITES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const favs = await getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) {
    favs.splice(idx, 1);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return false;
  } else {
    favs.push(id);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return true;
  }
}

const CACHE_KEY_PREFIXES = [
  'troop_detail_v7_',
  'bases_clashly_th_',
  'events_data_v1',
];

export async function clearAppCache(): Promise<void> {
  await AsyncStorage.removeItem(PLAYER_CACHE_KEY);
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((k) =>
    CACHE_KEY_PREFIXES.some((prefix) => k.startsWith(prefix) || k === prefix)
  );
  if (cacheKeys.length > 0) {
    await AsyncStorage.multiRemove(cacheKeys);
  }
}

export async function exportAppData(): Promise<string> {
  const [tag, player, savedBases, favorites] = await Promise.all([
    getPlayerTag(),
    getCachedPlayer(),
    getSavedBases(),
    getFavorites(),
  ]);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'ClashPrime',
      tag,
      player,
      savedBases,
      favorites,
    },
    null,
    2,
  );
}
