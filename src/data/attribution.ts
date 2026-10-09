/**
 * Every public project ClashPrime draws content from, surfaced both in
 * Settings → About / Credits and on the final onboarding slide. Kept in one
 * place so the two never drift apart.
 */
export type DataSourceGroup = 'usage' | 'inspiration';

export interface DataSource {
  name: string;
  use: string;
  url: string;
  group: DataSourceGroup;
}

export const DATA_SOURCES: DataSource[] = [
  { name: 'Clash of Clans API', use: 'Player stats & progress', url: 'https://developer.clashofclans.com', group: 'usage' },
  { name: 'RoyaleAPI', use: 'Dynamic-IP developer proxy', url: 'https://docs.royaleapi.com/proxy.html', group: 'usage' },
  { name: 'ClashLy', use: 'Base layouts & ratings', url: 'https://clashly.com', group: 'usage' },
  { name: 'Clash Bases', use: 'Open-source layout catalogue', url: 'https://github.com/nschmeller/clash-bases', group: 'usage' },
  { name: 'ClashArmies', use: 'Community armies & sharing', url: 'https://clasharmies.com', group: 'usage' },
  { name: 'clash-of-clans-data (npm)', use: 'Troop, hero & building data', url: 'https://www.npmjs.com/package/clash-of-clans-data', group: 'usage' },
  { name: 'clash.ninja', use: 'Events & max-level fallback', url: 'https://clash.ninja', group: 'usage' },
  { name: 'Supercell Fan Kit', use: 'Official game art & assets', url: 'https://fankit.supercell.com/d/vkEdmkUCngKw/game-assets', group: 'usage' },
  { name: 'Zapquaker', use: 'Zap & Quake combo calculator', url: 'https://zapquaker.netlify.app/', group: 'inspiration' },
  { name: 'Otaku Planner', use: 'Giant Arrow path planner', url: 'https://otakuplanner.com/tools/coc-arrow-path', group: 'inspiration' },
];

export const DATA_SOURCE_GROUPS: { key: DataSourceGroup; label: string; sources: DataSource[] }[] = [
  { key: 'usage', label: 'Usage', sources: DATA_SOURCES.filter((s) => s.group === 'usage') },
  { key: 'inspiration', label: 'Inspirations', sources: DATA_SOURCES.filter((s) => s.group === 'inspiration') },
];

export const SUPERCELL_NOTICE =
  'This content is not affiliated with, endorsed, sponsored, or specifically approved by Supercell and Supercell is not responsible for it. For more information see Supercell\u2019s Fan Content Policy: www.supercell.com/fan-content-policy.';
