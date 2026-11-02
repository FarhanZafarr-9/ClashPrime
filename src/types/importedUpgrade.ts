export interface ImportedUpgrade {
  id: string;
  dataId: number;
  kind: 'buildings' | 'heroes' | 'troops' | 'spells' | 'pets' | 'other';
  village: 'home' | 'builderBase';
  name: string;
  storeName?: string;
  level: number;
  targetLevel: number;
  /** Ordinal among timer rows with the same entity and level. */
  copy: number;
  baselineTargetCopies: number;
  completesAt: number;
  snapshotAt: number;
  confirmed?: boolean;
}
