/**
 * fetch-bb-images.js
 *
 * Fetches level image URLs for Builder Base buildings from the Fandom wiki
 * MediaWiki API and outputs JSON entries compatible with building-images.json.
 *
 * Usage: node scripts/fetch-bb-images.js
 * Output: JSON array to stdout (pipe into building-images.json manually)
 */
const https = require('https');
const http = require('http');

// Map of app building name → Fandom page slug
const BUILDING_PAGES = {
  'BB Cannon': 'Cannon/Builder_Base',
  'Double Cannon': 'Double_Cannon',
  'Guard Post': 'Guard_Post',
  "O.T.T.O's Outpost": "O.T.T.O%27s_Outpost",
  'Mega Tesla': 'Mega_Tesla',
  'Push Trap': 'Push_Trap',
  'Builder Hall': 'Builder_Hall',
  'Gem Mine': 'Gem_Mine',
  'B.O.B Control': 'B.O.B_Control',
  'Builder Barracks': 'Builder_Barracks',
  'Star Laboratory': 'Star_Laboratory',
  'Battle Machine Altar': 'Battle_Machine_Altar',
  'Reinforcement Camp': 'Reinforcement_Camp',
  'Healing Hut': 'Healing_Hut',
  'Battle Copter Altar': 'Battle_Copter_Altar',
  "Builder's Hut": "Builder%27s_Hut",
  'Clock Tower': 'Clock_Tower',
  "B.O.T.O's Shack": "B.O.T.O%27s_Shack",
  'Elixir Cart': 'Elixir_Cart',
};

const BASE = 'https://clashofclans.fandom.com';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'ClashPrime/1.0' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse JSON from ${url}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchPageImages(pageTitle) {
  const apiUrl = `${BASE}/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text%7Cimages&format=json&origin=*`;
  const result = await fetchJSON(apiUrl);

  if (result.error) {
    console.warn(`  [WARN] API error for "${pageTitle}": ${result.error.info}`);
    return null;
  }

  const html = result.parse.text['*'];
  const imageNames = result.parse.images || [];

  // Try to extract level image URLs from the page HTML.
  // Look for <a> tags with images in the gallery section that contain level numbers.
  const levelImages = [];
  const galleryRegex = /<div class="wikia-gallery[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
  let galleryMatch;
  while ((galleryMatch = galleryRegex.exec(html)) !== null) {
    const galleryHtml = galleryMatch[1];
    const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(galleryHtml)) !== null) {
      levelImages.push(imgMatch[1]);
    }
  }

  // Fallback: look for level thumbnails in the page (standard image pattern)
  if (levelImages.length === 0) {
    const thumbRegex = /<a[^>]+class="image"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<\/a>/g;
    let thumbMatch;
    while ((thumbMatch = thumbRegex.exec(html)) !== null) {
      const url = thumbMatch[1];
      // Filter out icons, badges, small images
      if (url.includes('/scale-to-width-down/') && !url.includes('Icon') && !url.includes('Site-logo')) {
        levelImages.push(url);
      }
    }
  }

  // Deduplicate
  const unique = [...new Set(levelImages)]
    .filter((u) => !u.includes('data:image'))
    .map((u) => u
      .replace(/\/revision\/latest\/scale-to-width-down\/\d+/, '/revision/latest')
      .replace(/\/revision\/latest\/scale-to-width-down$/, '/revision/latest')
    );

  // Assign levels by sorting and using position
  const sorted = unique.sort((a, b) => {
    const na = parseInt(a.match(/(\d+)[^/\s]*\.png/i)?.[1] || '0', 10);
    const nb = parseInt(b.match(/(\d+)[^/\s]*\.png/i)?.[1] || '0', 10);
    return na - nb;
  });

  // Try to extract a "main" image (the first non-gallery image on the page)
  const mainImageMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*>/);
  const mainImage = mainImageMatch
    ? mainImageMatch[1]
        .replace(/\/revision\/latest\/scale-to-width-down\/\d+/, '/revision/latest')
        .replace(/\/revision\/latest\/scale-to-width-down$/, '/revision/latest')
    : null;

  return {
    name: pageTitle,
    rawImages: imageNames,
    levelUrls: sorted.slice(0, 15).map((url, i) => ({ level: i + 1, url })),
    mainImage,
  };
}

async function main() {
  const entries = [];

  for (const [appName, slug] of Object.entries(BUILDING_PAGES)) {
    console.error(`Fetching ${slug}...`);
    const data = await fetchPageImages(slug);
    if (!data) {
      console.error(`  SKIPPED`);
      continue;
    }

    const entry = {
      name: appName,
      imageUrl: data.mainImage || data.levelUrls[0]?.url || '',
      levels: data.levelUrls.map((l) => ({
        level: l.level,
        imageUrl: l.url,
      })),
    };

    entries.push(entry);
    console.error(`  → ${data.levelUrls.length} level images found`);
  }

  // Output JSON
  console.log(JSON.stringify({ images: entries }, null, 2));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
