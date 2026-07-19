import { ImageSourcePropType } from 'react-native';
import buildingImagesData from '../data/building-images.json';
import buildingAssets from '../data/buildingAssets';

const images = buildingImagesData.images;
const nameToEntry = new Map(images.map((img) => [img.name.toLowerCase(), img]));

export function getBuildingImageSource(name: string): ImageSourcePropType | null {
  const asset = buildingAssets[name];
  if (asset?.main) return asset.main;
  const entry = nameToEntry.get(name.toLowerCase());
  if (entry?.imageUrl) return { uri: entry.imageUrl };
  return null;
}

export function getBuildingLevelImageSource(name: string, level: number): ImageSourcePropType | null {
  const asset = buildingAssets[name];
  if (asset?.levels?.[level]) return asset.levels[level];
  const entry = nameToEntry.get(name.toLowerCase());
  if (entry?.levels && entry.levels.length > 0) {
    const match = entry.levels.find((l) => l.level === level);
    if (match) return { uri: match.imageUrl };
    const highest = entry.levels.reduce((a, b) => (a.level > b.level ? a : b));
    if (level <= highest.level) return { uri: highest.imageUrl };
  }
  if (asset?.main) return asset.main;
  if (entry?.imageUrl) return { uri: entry.imageUrl };
  return null;
}

export function getBuildingAvailableLevels(name: string): number[] {
  const asset = buildingAssets[name];
  if (asset?.levels) return Object.keys(asset.levels).map(Number).sort((a, b) => a - b);
  const entry = nameToEntry.get(name.toLowerCase());
  if (entry?.levels) return entry.levels.map((l) => l.level).sort((a, b) => a - b);
  return [];
}
