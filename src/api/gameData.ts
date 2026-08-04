import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY_SIEGE = 'siege_machine_names';
const CACHE_KEY_PETS = 'pet_names';
const CACHE_KEY_SUPER_TROOPS = 'super_troop_names';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FANDOM_API = 'https://clashofclans.fandom.com/api.php';
const FETCH_TIMEOUT_MS = 10_000;

interface CacheEntry {
  names: string[];
  timestamp: number;
}

async function fetchCategoryMembers(category: string): Promise<string[]> {
  const members: string[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'categorymembers',
      cmtitle: `Category:${category}`,
      cmlimit: 'max',
      cmtype: 'page',
    });
    if (cmcontinue) params.set('cmcontinue', cmcontinue);

    const url = `${FANDOM_API}?${params}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': 'ClashPrime/1.0 (React Native)' },
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timer);
      break;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) break;

    const data: any = await res.json();

    if (data.query?.categorymembers) {
      for (const m of data.query.categorymembers) {
        members.push(m.title);
      }
    }
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);

  return members;
}

async function getCachedList(cacheKey: string): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.names;
      }
    }
  } catch {}
  return null;
}

async function setCachedList(cacheKey: string, names: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ names, timestamp: Date.now() } as CacheEntry));
  } catch {}
}

export async function getSiegeMachineNames(bypassCache = false): Promise<string[]> {
  if (!bypassCache) {
    const cached = await getCachedList(CACHE_KEY_SIEGE);
    if (cached) return cached;
  }

  const all = await fetchCategoryMembers('Siege_Machines');
  const names = all.filter((n) => n !== 'Siege Machines');
  await setCachedList(CACHE_KEY_SIEGE, names);
  return names;
}

export async function getPetNames(bypassCache = false): Promise<string[]> {
  if (!bypassCache) {
    const cached = await getCachedList(CACHE_KEY_PETS);
    if (cached) return cached;
  }

  const all = await fetchCategoryMembers('Pets');
  const names = all.filter((n) => n !== 'Pets' && n !== 'Pets/Home_Village');
  await setCachedList(CACHE_KEY_PETS, names);
  return names;
}

export async function clearGameDataCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CACHE_KEY_SIEGE, CACHE_KEY_PETS, CACHE_KEY_SUPER_TROOPS]);
  } catch {}
}

export async function getSuperTroopNames(bypassCache = false): Promise<string[]> {
  if (!bypassCache) {
    const cached = await getCachedList(CACHE_KEY_SUPER_TROOPS);
    if (cached) return cached;
  }

  const all = await fetchCategoryMembers('Super_Troops');
  const names = all.filter((n) => !n.includes('/'));
  await setCachedList(CACHE_KEY_SUPER_TROOPS, names);
  return names;
}
