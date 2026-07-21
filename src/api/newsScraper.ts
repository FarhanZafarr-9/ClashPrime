import AsyncStorage from '@react-native-async-storage/async-storage';

const RSS_URL = 'https://about.clashly.app/feed/';
const CACHE_KEY = 'news_data_v1';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export interface NewsItem {
  title: string;
  link: string;
  pubDate: number;
  description: string;
  category: string;
  author: string;
}

interface CacheEntry {
  data: NewsItem[];
  timestamp: number;
}

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const block = itemMatch[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const rawDate = extractTag(block, 'pubDate');
    const description = extractTag(block, 'description');
    const category = extractTag(block, 'category');
    const author = extractCDATA(block, 'dc:creator');
    const pubDate = rawDate ? new Date(rawDate).getTime() : 0;
    if (title) {
      items.push({
        title: decodeEntities(title),
        link: link || '',
        pubDate,
        description: decodeEntities(stripHTML(description)),
        category: category || 'News',
        author: author || 'ClashLy',
      });
    }
  }
  return items;
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  let m = regex.exec(xml);
  if (m) return m[1].trim();
  const regex2 = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  m = regex2.exec(xml);
  return m ? m[1].trim() : '';
}

function extractCDATA(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const m = regex.exec(xml);
  return m ? m[1].trim() : '';
}

function stripHTML(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&#\d+;/g, '').trim();
}

function decodeEntities(text: string): string {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&#8230;/g, '…');
}

export async function fetchNews(): Promise<NewsItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    }
  } catch {}

  try {
    const res = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRSS(xml);
    if (items.length > 0) {
      try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: items, timestamp: Date.now() } as CacheEntry));
      } catch {}
    }
    return items;
  } catch {}

  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      return entry.data;
    }
  } catch {}

  return [];
}
