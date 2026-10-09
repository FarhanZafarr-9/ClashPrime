/**
 * clash-bases (github.com/nschmeller/clash-bases) is a static, community-editable
 * catalogue of Home Village layouts aggregated from cocbases.com, basemelon.com
 * and blueprintcoc.com. The whole catalogue ships as one JSON file on GitHub raw.
 *
 * It carries what ClashLy lacks — real base names, descriptions, builder credits
 * and free-form tags — but no Builder Base coverage and no popularity metrics, so
 * the Bases tab merges it on top of ClashLy and degrades to ClashLy-only when the
 * fetch fails. The catalog is memoised for the session; per-TH snapshots live in
 * the baseScraper cache like they always have.
 */
const CATALOG_URL =
  'https://raw.githubusercontent.com/nschmeller/clash-bases/main/bases.json';

export interface ClashBasesEntry {
  id: string;
  name: string;
  town_hall: number;
  type: string;
  link: string;
  image: string;
  description?: string;
  builder?: string;
  tags?: string[];
  added?: string;
}

let memo: { entries: ClashBasesEntry[]; fetchedAt: number } | null = null;
const MEMO_TTL_MS = 60 * 60 * 1000;

/**
 * The OpenLayout payload — the base64url blob after the second colon of the
 * `id` query param — identifies a layout everywhere it is catalogued: the same
 * layout shared from the game carries the same payload on ClashLy and on the
 * sites clash-bases mirrors, which is what makes a false-positive-free merge
 * possible. Links without the `TH<n>:<code>:<payload>` shape return null.
 */
export function layoutPayload(link: string): string | null {
  const match = /[?&]id=([^&]+)/.exec(link);
  if (!match) return null;
  try {
    const parts = decodeURIComponent(match[1]).split(':');
    return parts.length >= 3 && parts[2] ? parts[2] : null;
  } catch {
    return null;
  }
}

async function fetchCatalog(): Promise<ClashBasesEntry[]> {
  const res = await fetch(CATALOG_URL);
  if (!res.ok) throw new Error(`clash-bases catalog error: ${res.status}`);
  const parsed: unknown = await res.json();
  // The published file wraps the list as { "bases": [...] }; tolerate a bare
  // array too in case the shape ever changes upstream.
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { bases?: unknown[] })?.bases;
  if (!Array.isArray(list)) throw new Error('clash-bases catalog has no bases array');

  // The upstream validator guarantees a preview image and a well-formed share
  // link, but the file is community-edited, so anything the Bases tab could not
  // render is dropped here rather than surfaced as a broken card.
  return (list as ClashBasesEntry[]).filter(
    (e) =>
      e &&
      typeof e.id === 'string' &&
      typeof e.name === 'string' &&
      typeof e.town_hall === 'number' &&
      typeof e.link === 'string' &&
      layoutPayload(e.link) !== null &&
      typeof e.image === 'string' &&
      e.image.length > 0
  );
}

export async function getClashBasesForTH(thLevel: number): Promise<ClashBasesEntry[]> {
  if (!memo || Date.now() - memo.fetchedAt >= MEMO_TTL_MS) {
    memo = { entries: await fetchCatalog(), fetchedAt: Date.now() };
  }
  return memo.entries.filter((e) => e.town_hall === thLevel);
}
