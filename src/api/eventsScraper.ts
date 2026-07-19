import AsyncStorage from '@react-native-async-storage/async-storage';

const EVENTS_URL = 'https://www.clash.ninja/guides/when-are-the-next-ingame-events';
const CACHE_KEY = 'events_data_v1';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export interface ClashEvent {
  name: string;
  endDate: number;
  remainingSeconds: number;
  description: string;
  isActive: boolean;
}

interface CacheEntry {
  data: ClashEvent[];
  timestamp: number;
}

const EVENT_DESCRIPTIONS: Record<string, string> = {
  'Raid Weekend': 'Weekly clan capital raid weekend. Attack other clans\' capitals to earn raid medals for the trader.',
  'Trader Refresh': 'The Trader\'s stock refreshes with new magic items available for purchase with raid medals or gems.',
  'Clan Games': 'Cooperative clan challenges run from the 22nd-28th of each month. Earn points to unlock rewards.',
  'Season End': 'The monthly season ends. Season bank loot is paid out and the new season begins.',
  'CWL': 'Clan War Leagues sign-up starts on the 1st of each month. 8v8 wars over 7 days for league medals.',
  'League Reset': 'Every 28 days all players become unranked. Legends League players reset to 5000 trophies.',
};

function parseEventsHTML(html: string): ClashEvent[] {
  const events: ClashEvent[] = [];
  const eventRegex = /class="[^"]*event-holder[^"]*"[^>]*data-ed="(\d+)"[^>]*data-remaining="(\d+)"[\s\S]*?<h3>([\s\S]*?)<\/h3>/g;
  let match;
  while ((match = eventRegex.exec(html)) !== null) {
    const endDate = parseInt(match[1], 10);
    const remainingSeconds = parseInt(match[2], 10);
    const rawName = match[3].replace(/<[^>]+>/g, '').trim();
    const isActive = /\(Active Until\)/i.test(match[3]);
    const name = rawName.replace(/\(Active Until\)/i, '').trim();
    events.push({
      name,
      endDate,
      remainingSeconds,
      description: EVENT_DESCRIPTIONS[name] || '',
      isActive,
    });
  }
  return events;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Now';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export { formatCountdown };

export async function fetchEvents(): Promise<{ events: ClashEvent[]; fromCache: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return { events: entry.data, fromCache: true };
      }
    }
  } catch {}

  try {
    const res = await fetch(EVENTS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const events = parseEventsHTML(html);
    if (events.length > 0) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: events, timestamp: Date.now() } as CacheEntry));
      } catch {}
      return { events, fromCache: false };
    }
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      return { events: entry.data, fromCache: true };
    }
  } catch {}

  return { events: [], fromCache: false };
}
