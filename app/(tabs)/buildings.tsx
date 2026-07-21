import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { getBuildingLevelImageSource, getBuildingAvailableLevels } from '../../src/utils/buildingImages';
import { Card } from '../../src/components/Card';
import { SectionHeader } from '../../src/components/SectionHeader';
import thLevelsData from '../../src/data/th-levels.json';
import buildingLevelsData from '../../src/data/building-levels.json';

const COL_ABBREV: Record<string, string> = {
  'Damage per Second': 'DPS',
  'Damage per Shot': 'DMG',
  'Damage per Hit': 'DMG',
  'Hitpoints': 'HP',
  'Build Cost': 'Cost',
  'Build Time': 'Time',
  'Experience': 'XP',
  'Town Hall Level': 'TH',
  'Damage when destroyed': 'Dmg/Dest',
  'Shockwave Damage': 'Shock',
  'Splash Damage**': 'Splash',
  'Repair per Second': 'Repair',
  'Repair per Hit': 'RPR',
};

// Siege Machines are Workshop-produced home-village troops (shown on the
// Profile troops list), not buildings — excluded here.
const SHOW_CATEGORIES = ['Defenses', 'Resources', 'Traps', 'Army', 'Walls'];

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Defenses': 'shield-checkmark-outline',
  'Resources': 'wallet-outline',
  'Traps': 'warning-outline',
  'Army': 'people-outline',
  'Walls': 'grid-outline',
};

const NAME_FIX: Record<string, string> = {
  'Lab': 'Laboratory',
  'Walls': 'Wall',
  'Builder Hut': "Builder's Hut",
};

function LevelThumb({ name, level, isCurrent }: { name: string; level: number; isCurrent: boolean }) {
  const lookupName = NAME_FIX[name] ?? name;
  const imgSource = getBuildingLevelImageSource(lookupName, level);

  if (imgSource) {
    return (
      <View style={[styles.levelThumbWrap, isCurrent && styles.levelThumbCurrent]}>
        <Image source={imgSource} style={styles.levelThumbImg} resizeMode="contain" />
        <Text style={[styles.levelThumbLabel, isCurrent && styles.levelThumbLabelCurrent]}>
          {level}
        </Text>
      </View>
    );
  }

  const initials = name.split(/[\s.]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[styles.levelThumbWrap, isCurrent && styles.levelThumbCurrent]}>
      <View style={[styles.levelThumbImg, styles.levelThumbFallback]}>
        <Text style={styles.levelThumbFallbackText}>{initials}</Text>
      </View>
      <Text style={[styles.levelThumbLabel, isCurrent && styles.levelThumbLabelCurrent]}>
        {level}
      </Text>
    </View>
  );
}

function BuildingCard({ name, maxLvl, isMaxed, th }: { name: string; maxLvl: number; isMaxed: boolean; th: number }) {
  const [expanded, setExpanded] = useState(false);
  const lookupName = NAME_FIX[name] ?? name;
  const availableLevels = getBuildingAvailableLevels(lookupName);
  const levelsToShow = availableLevels.filter((l) => l <= maxLvl);

  const buildingStats = useMemo(() => {
    const match = (buildingLevelsData as any).find((b: any) => {
      const bName = b.name.toLowerCase();
      return bName === name.toLowerCase() || bName === lookupName.toLowerCase();
    });
    return match || null;
  }, [name, lookupName]);

  const mainImgSource = getBuildingLevelImageSource(lookupName, maxLvl);

  return (
    <Card style={styles.itemCard}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={styles.itemRow}>
          {mainImgSource ? (
            <Image source={mainImgSource} style={styles.itemIcon} resizeMode="contain" />
          ) : (
            <View style={styles.itemIcon}>
              <Text style={styles.itemIconText}>
                {name.split(/[\s.]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
            <Text style={styles.itemLevel}>
              Max Lv {maxLvl}
              {isMaxed ? '  · Maxed' : ''}
              {availableLevels.length > 0 ? `  · ${levelsToShow.length} models` : ''}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={Colors.textTertiary}
            style={styles.expandArrow}
          />
        </View>
      </Pressable>

      {expanded && levelsToShow.length > 0 && (
        <>
          <View style={styles.levelStrip}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelStripContent}>
              {levelsToShow.map((lvl) => (
                <LevelThumb key={lvl} name={name} level={lvl} isCurrent={lvl === maxLvl} />
              ))}
            </ScrollView>
          </View>

          {buildingStats && buildingStats.levels.length > 0 && (
            <View style={styles.buildingStatsTable}>
              {/* Header row */}
              <View style={styles.buildingStatRow}>
                <View style={styles.buildingStatCellIcon}>
                  <Text style={[styles.buildingStatHeader, { color: Colors.textMuted }]}>Lvl</Text>
                </View>
                {buildingStats.statsColumns.filter((c: string) => c !== 'Level').map((col: string) => (
                  <Text key={col} style={[styles.buildingStatCell, styles.buildingStatHeader, { color: Colors.textMuted }]} numberOfLines={1}>
                    {COL_ABBREV[col] || col}
                  </Text>
                ))}
              </View>
              {/* Data rows — use all levels from scraper data, not only image-available levels */}
              {buildingStats.levels.map((levelData: any, _idx: number) => {
                const lvl = levelData.Level;
                const iconSource = getBuildingLevelImageSource(lookupName, lvl);
                return (
                  <View key={lvl} style={styles.buildingStatRow}>
                    <View style={styles.buildingStatCellIcon}>
                      {iconSource ? (
                        <Image source={iconSource} style={styles.buildingStatIcon} resizeMode="contain" />
                      ) : null}
                      <Text style={styles.buildingStatLvlNum}>{lvl}</Text>
                    </View>
                    {buildingStats.statsColumns.filter((c: string) => c !== 'Level').map((col: string) => {
                      const val = levelData[col] ?? '—';
                      const formatted = typeof val === 'number' ? formatCostShort(val) : String(val);
                      return (
                        <Text key={col} style={[styles.buildingStatCell, { color: Colors.textSecondary }]} numberOfLines={1}>
                          {formatted}
                        </Text>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </Card>
  );
}

function formatCostShort(cost: number): string {
  if (cost >= 100000000) return (cost / 1000000).toFixed(0) + 'M';
  if (cost >= 1000000) return (cost / 1000000).toFixed(cost % 1000000 === 0 ? 0 : 1).replace('.0', '') + 'M';
  if (cost >= 1000) return (cost / 1000).toFixed(cost % 1000 === 0 ? 0 : 1).replace('.0', '') + 'K';
  return String(cost);
}

export default function BuildingsScreen() {
  const { player } = usePlayer();
  const th = player?.townHallLevel ?? 1;
  const categories = thLevelsData.categories as any as Record<string, Record<string, Record<string, { level: number | null; isMaxLevel: boolean }>>>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Buildings</Text>
          <Text style={styles.subtitle}>Max levels for TH{th} · Tap to see models</Text>
        </View>

        {SHOW_CATEGORIES.map((cat) => {
          const items = categories[cat];
          if (!items) return null;
          const entries = Object.entries(items).filter(([, thData]) => {
            const thEntry = thData[String(th)];
            return thEntry != null && (thEntry.level ?? 0) > 0;
          });
          if (entries.length === 0) return null;

          return (
            <View key={cat}>
              <SectionHeader icon={CATEGORY_ICONS[cat]} title={cat} />
              {entries.map(([name, thData]) => {
                const thEntry = thData[String(th)];
                const maxLvl = thEntry?.level ?? 0;
                const isMaxed = thEntry?.isMaxLevel ?? false;

                return (
                  <BuildingCard
                    key={name}
                    name={name}
                    maxLvl={maxLvl}
                    isMaxed={isMaxed}
                    th={th}
                  />
                );
              })}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  itemCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    overflow: 'hidden',
  },
  itemIconText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 52,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  itemLevel: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  expandArrow: {
    width: 24,
    textAlign: 'center',
  },
  levelStrip: {
    marginTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  levelStripContent: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
  },
  levelThumbWrap: {
    alignItems: 'center',
    gap: 4,
  },
  levelThumbCurrent: {
    opacity: 1,
  },
  levelThumbImg: {
    width: 52,
    height: 52,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  levelThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelThumbFallbackText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 10,
  },
  levelThumbLabel: {
    color: Colors.textTertiary,
    fontSize: 10,
  },
  levelThumbLabelCurrent: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  buildingStatsTable: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  buildingStatRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  buildingStatCellIcon: {
    width: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
    gap: 2,
  },
  buildingStatCell: {
    flex: 1,
    ...Typography.caption,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    textAlign: 'center',
  },
  buildingStatHeader: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontSize: 9,
  },
  buildingStatIcon: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: Colors.bgSubtle,
  },
  buildingStatLvlNum: {
    fontSize: 8,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
});
