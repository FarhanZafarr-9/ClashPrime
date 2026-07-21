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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { getBuildingLevelImageSource, getBuildingAvailableLevels } from '../../src/utils/buildingImages';
import { Card } from '../../src/components/Card';
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
  // Non-defense columns
  'Capacity': 'Cap',
  'Production Rate': 'Rate',
  'Boost Cost': 'Boost',
  'Time to Fill': 'Fill',
  'Catch-Up Point*': 'Catch-Up',
  'Troop Capacity': 'TropCp',
  'Spell Capacity': 'SpellCp',
  'Siege Machine Capacity': 'SiegeCp',
  'Unlocked Unit': 'Unit',
  'Unlocked Siege Machine': 'Siege',
  'Unlocked Pet': 'Pet',
  'Equipment Unlocked': 'Equip',
  'Spell(s) Unlocked': 'Spells',
  'Spell Storage Capacity': 'SpellCp',
  'Ore Capacity': 'OreCp',
  'Number of Army Camps': '#Camps',
  'Spring Capacity': 'SprCap',
  'Damage': 'DMG',
  'Secondary Chain Damage': 'Chain',
  'Burst Fire (Shots)': 'Burst',
  'Spawned Zappies': 'Zap',
  'Total Burn Damage': 'Burn',
  'Burn Damage per Tick': 'Burn/Tk',
};

const SHOW_CATEGORIES = ['Defenses', 'Resources', 'Traps', 'Army', 'Walls'];

const CATEGORY_ICONS: Record<string, { set: 'ion' | 'mc'; name: string }> = {
  'Defenses': { set: 'ion', name: 'shield-half-outline' },
  'Resources': { set: 'mc', name: 'currency-usd' },
  'Traps': { set: 'mc', name: 'bomb' },
  'Army': { set: 'mc', name: 'sword-cross' },
  'Walls': { set: 'mc', name: 'wall' },
};

const NAME_FIX: Record<string, string> = {
  'Lab': 'Laboratory',
  'Walls': 'Wall',
  'Builder Hut': "Builder's Hut",
};

function BuildingCard({ name, maxLvl, isMaxed, th }: { name: string; maxLvl: number; isMaxed: boolean; th: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const lookupName = NAME_FIX[name] ?? name;
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

  const availableLevels = getBuildingAvailableLevels(lookupName);
  const allLevels = buildingStats?.levels ?? availableLevels.map((l) => ({ Level: l }));
  const showExpand = allLevels.length > 3;

  let displayLevels: any[];
  if (!expanded) {
    displayLevels = [];
  } else if (showFull || !showExpand) {
    displayLevels = allLevels;
  } else {
    const currentIdx = allLevels.findIndex((l: any) => l.Level === maxLvl);
    const start = Math.max(0, currentIdx - 1);
    const end = Math.min(allLevels.length, currentIdx + 2);
    displayLevels = allLevels.slice(start, end);
  }

  const renderGrid = () => (
    <View style={styles.levelGrid}>
      {displayLevels.map((levelData: any) => {
        const lvl = levelData.Level;
        const cellSource = getBuildingLevelImageSource(lookupName, lvl);
        const isCurrent = lvl === maxLvl;
        const isNext = lvl === maxLvl + 1 && lvl <= (thNext?.level ?? 0);
        return (
          <View key={lvl} style={[styles.levelGridCell, isCurrent && styles.levelGridCellCurrent]}>
            <View style={styles.levelGridImgWrap}>
              {cellSource ? (
                <Image source={cellSource} style={styles.levelGridImg} resizeMode="contain" />
              ) : (
                <View style={[styles.levelGridImg, styles.levelGridImgFallback]}>
                  <Text style={styles.levelGridFallbackText}>
                    {name.split(/[\s.]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={[styles.levelGridBadge, isNext && styles.levelGridBadgeNext]}>
                <Text style={[styles.levelGridBadgeText, isCurrent && styles.levelGridBadgeTextCurrent, isNext && styles.levelGridBadgeTextNext]}>
                  {lvl}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );

  const toggleExpanded = () => {
    if (expanded) {
      setExpanded(false);
      setShowFull(false);
    } else {
      setExpanded(true);
    }
  };

  return (
    <Card style={styles.itemCard}>
      <Pressable onPress={toggleExpanded}>
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

      {expanded && displayLevels.length > 0 && (
        <>
          {renderGrid()}
          {buildingStats && (
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
              {displayLevels.map((levelData: any) => {
                const lvl = levelData.Level;
                const isCurrentLevel = lvl === maxLvl;
                return (
                  <View key={lvl} style={[styles.buildingStatRow, isCurrentLevel && styles.buildingStatRowCurrent]}>
                    <View style={styles.buildingStatCellIcon}>
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
          {showExpand && !showFull && (
            <Pressable style={styles.expandTableBtn} onPress={() => setShowFull(true)}>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
              <Text style={styles.expandTableText}>Show all {allLevels.length} levels</Text>
            </Pressable>
          )}
          {showExpand && showFull && (
            <Pressable style={styles.expandTableBtn} onPress={() => setShowFull(false)}>
              <Ionicons name="chevron-up" size={14} color={Colors.textSecondary} />
              <Text style={styles.expandTableText}>Show fewer</Text>
            </Pressable>
          )}
        </>
      )}
    </Card>
  );
}

function CategoryIcon({ cat, isActive }: { cat: string; isActive: boolean }) {
  const icon = CATEGORY_ICONS[cat];
  const iconColor = isActive ? Colors.bg : Colors.textSecondary;
  return icon.set === 'mc' ? (
    <MaterialCommunityIcons name={icon.name as any} size={14} color={iconColor} />
  ) : (
    <Ionicons name={icon.name as any} size={14} color={iconColor} />
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
  const [selectedCat, setSelectedCat] = useState('');

  const availableCats = SHOW_CATEGORIES.filter((cat) => {
    const items = categories[cat];
    if (!items) return false;
    return Object.entries(items).some(([, thData]) => {
      const thEntry = thData[String(th)];
      return thEntry != null && (thEntry.level ?? 0) > 0;
    });
  });

  const activeCat = selectedCat || availableCats[0] || '';

  const entries = activeCat ? Object.entries(categories[activeCat] ?? {}).filter(([, thData]) => {
    const thEntry = thData[String(th)];
    return thEntry != null && (thEntry.level ?? 0) > 0;
  }) : [];

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

        <View style={styles.pillRow}>
          {availableCats.map((cat) => {
            const isActive = cat === activeCat;
            return (
              <Pressable
                key={cat}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setSelectedCat(cat)}
              >
                <CategoryIcon cat={cat} isActive={isActive} />
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{cat}</Text>
              </Pressable>
            );
          })}
        </View>

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
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.bg,
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
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  itemIcon: {
    width: 40,
    height: 40,
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
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  levelGridCell: {
    width: '25%',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  levelGridCellCurrent: {
    backgroundColor: Colors.accentGhost,
  },
  levelGridImgWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  levelGridImg: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  levelGridImgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelGridFallbackText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 9,
  },
  levelGridBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 14,
    borderRadius: 3,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  levelGridBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textTertiary,
  },
  levelGridBadgeTextCurrent: {
    color: Colors.textPrimary,
  },
  levelGridBadgeNext: {
    borderColor: Colors.warning,
  },
  levelGridBadgeTextNext: {
    color: Colors.warning,
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
  buildingStatLvlNum: {
    fontSize: 8,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  buildingStatLvlNumCurrent: {
    color: Colors.textPrimary,
  },
  expandTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
  },
  expandTableText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
