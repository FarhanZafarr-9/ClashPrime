import { APP_VERSION } from '../constants/appVersion';

const GITHUB_API = 'https://api.github.com/repos/FarhanZafarr-9/ClashPrime/tags';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let cachedResult: { hasUpdate: boolean; latestVersion: string; currentVersion: string; checkedAt: number } | null = null;

function parseVersion(v: string): number[] {
  return v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export async function checkForUpdate(): Promise<{ hasUpdate: boolean; latestVersion: string; currentVersion: string }> {
  const now = Date.now();
  if (cachedResult && now - cachedResult.checkedAt < CHECK_INTERVAL_MS) {
    return { hasUpdate: cachedResult.hasUpdate, latestVersion: cachedResult.latestVersion, currentVersion: cachedResult.currentVersion };
  }

  try {
    const res = await fetch(GITHUB_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const tags: { name: string }[] = await res.json();
    const latest = tags
      .map(t => t.name.replace(/^v/, ''))
      .sort((a, b) => compareVersions(a, b))
      .pop() ?? '0.0.0';
    const current = APP_VERSION;
    const hasUpdate = compareVersions(latest, current) > 0;

    cachedResult = { hasUpdate, latestVersion: latest, currentVersion: current, checkedAt: now };
    return { hasUpdate, latestVersion: latest, currentVersion: current };
  } catch (e) {
    console.warn('[versionCheck] failed:', e);
    return { hasUpdate: false, latestVersion: APP_VERSION, currentVersion: APP_VERSION };
  }
}

export async function probeGitHubOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch('https://api.github.com/', { method: 'HEAD', signal: controller.signal });
    return res.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function clearVersionCache() {
  cachedResult = null;
}