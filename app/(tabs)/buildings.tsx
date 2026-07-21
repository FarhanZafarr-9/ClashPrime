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

function LevelThumb({ name, level, isCurrent, isNextTH }: { name: string; level: number; isCurrent: boolean; isNextTH?: boolean }) {
  const lookupName = NAME_FIX[name] ?? name;
  const imgSource = getBuildingLevelImageSource(lookupName, level);

  if (imgSource) {
    return (
      <View style={[styles.levelThumbWrap, isCurrent && styles.levelThumbCurrent, isNextTH && styles.levelThumbNextTH]}>
        <Image source={imgSource} style={styles.levelThumbImg} resizeMode="contain" />
        <Text style={[styles.levelThumbLabel, isCurrent && styles.levelThumbLabelCurrent, isNextTH && styles.levelThumbLabelNextTH]}>
          {level}
        </Text>
      </View>
    );
  }

  const initials = name.split(/[\s.]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[styles.levelThumbWrap, isCurrent && styles.levelThumbCurrent, isNextTH && styles.levelThumbNextTH]}>
      <View style={[styles.levelThumbImg, styles.levelThumbFallback]}>
        <Text style={styles.levelThumbFallbackText}>{initials}</Text>
      </View>
      <Text style={[styles.levelThumbLabel, isCurrent && styles.levelThumbLabelCurrent, isNextTH && styles.levelThumbLabelNextTH]}>
        {level}
      </Text>
    </View>
  );
}

function BuildingCard({ name, maxLvl, isMaxed, th }: { name: string; maxLvl: number; isMaxed: boolean; th: number }) {
  const [expanded, setExpanded] = useState(false);
  const lookupName = NAME_FIX[name] ?? name;
  const availableLevels = getBuildingAvailableLevels(lookupName);
  const levelsToShow = availableLevels.filter((l) => l <= maxLvl + 1);

  const buildingStats = useMemo(() => {
    const match = (buildingLevelsData as any).find((b: any) => {
      const bName = b.name.toLowerCase();
      return bName === name.toLowerCase() || bName === lookupName.toLowerCase();
    });
    return match || null;
  }, [name, lookupName]);

  const mainImgSource = getBuildingLevelImageSource(lookupName, maxLvl);

  const thNext = useMemo(() => {
    const cats = thLevelsData.categories as Record<string, Record<string, Record<string, { level: number | null; isMaxLevel: boolean }>>>;
    for (const cat of Object.values(cats)) {
      if (cat[name]) {
        const thData = cat[name][String(th + 1)];
        if (thData) return thData;
      }
    }
    return null;
  }, [name, th]);

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
            <View style={styles.levelBadgeRow}>
              <Text style={styles.itemLevel}>
                Max Lv {maxLvl}
              </Text>
              {isMaxed && (
                <View style={styles.maxedBadge}>
                  <Text style={styles.maxedText}>Maxed</Text>
                </View>
              )}
              {thNext && (
                <View style={styles.nextTHBadge}>
                  <Text style={styles.nextTHText}>TH{th + 1}</Text>
                </View>
              )}
            </View>
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
                <LevelThumb key={lvl} name={name} level={lvl} isCurrent={lvl === maxLvl} isNextTH={lvl === maxLvl + 1 && lvl <= (thNext?.level ?? 0)} />
              ))}
            </ScrollView>
          </View>

          {buildingStats && buildingStats.levels.length > 0 && (
            <View style={styles.buildingStatsTable}>
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
              {buildingStats.levels.map((levelData: any, _idx: number) => {
                const lvl = levelData.Level;
                const iconSource = getBuildingLevelImageSource(lookupName, lvl);
                const isCurrentLevel = lvl === maxLvl;
                const isNextLevel = lvl === maxLvl + 1;
                return (
                  <View key={lvl} style={[styles.buildingStatRow, isCurrentLevel && styles.buildingStatRowCurrent]}>
                    <View style={styles.buildingStatCellIcon}>
                      {iconSource ? (
                        <Image source={iconSource} style={styles.buildingStatIcon} resizeMode="contain" />
                      ) : null}
                      <Text style={[styles.buildingStatLvlNum, isCurrentLevel && styles.buildingStatLvlNumCurrent]}>{lvl}</Text>
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
  const categories = thLevelsData.categories as Record<string, Record<string, Record<string, { level: number | null; isMaxLevel: boolean }>>>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Buildings</Text>
          <Text style={styles.subtitle}>Max levels for TH{th} · Tap to expand</Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotCurrent]} />
              <Text style={styles.legendText}>Current max</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotNext]} />
              <Text style={styles.legendText}>Unlocks at TH{th + 1}</Text>
            </View>
          </View>
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
  legendRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginTop: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDotCurrent: {
    backgroundColor: Colors.textPrimary,
  },
  legendDotNext: {
    backgroundColor: Colors.warning,
  },
  legendText: {
    ...Typography.caption,
    color: Colors.textMuted,
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
  levelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  itemLevel: {
    ...Typography.footnote,
    color: Colors.textTertiary,
  },
  maxedBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  maxedText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  nextTHBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Colors.warning,
  },
  nextTHText: {
    ...Typography.caption,
    color: Colors.bg,
    fontSize: 9,
    fontWeight: '700',
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
  levelThumbNextTH: {
    opacity: 0.7,
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
  levelThumbLabelNextTH: {
    color: Colors.warning,
    fontWeight: '600',
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
  buildingStatRowCurrent: {
    backgroundColor: Colors.accentGhost,
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
  buildingStatLvlNumCurrent: {
    color: Colors.textPrimary,
  },
});
