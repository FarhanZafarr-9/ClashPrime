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
import { useDiscounts } from '../../src/hooks/useDiscounts';
import type { ScopeDiscount } from '../../src/hooks/useDiscounts';
import { applyCostDiscount, applyTimeDiscount } from '../../src/utils/discountUtils';
import DiscountModal from '../../src/components/DiscountModal';

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
  // Builder Base wall columns
  'Cumulative Gold Cost': 'Cum.Gld',
  'Build Cost (Elixir)': 'Cost (Elx)',
  'Cumulative Elixir Cost': 'Cum.Elx',
  'Wall Ring Cost': 'Ring',
};

// Per-column widths, sized to actual content instead of one flat width for every column
// (mirrors how army.tsx sizes its stat table).
const COL_WIDTH: Record<string, number> = {
  'Damage per Second': 40,
  'Damage per Shot': 40,
  'Damage per Hit': 40,
  'Hitpoints': 44,
  'Build Cost': 56,
  'Build Time': 48,
  'Experience': 40,
  'Town Hall Level': 32,
  'Damage when destroyed': 56,
  'Shockwave Damage': 48,
  'Splash Damage**': 48,
  'Repair per Second': 48,
  'Repair per Hit': 44,
  'Capacity': 56,
  'Production Rate': 56,
  'Boost Cost': 56,
  'Time to Fill': 48,
  'Catch-Up Point*': 64,
  'Troop Capacity': 56,
  'Spell Capacity': 56,
  'Siege Machine Capacity': 60,
  'Unlocked Unit': 76,
  'Unlocked Siege Machine': 76,
  'Unlocked Pet': 64,
  'Equipment Unlocked': 72,
  'Spell(s) Unlocked': 72,
  'Spell Storage Capacity': 60,
  'Ore Capacity': 56,
  'Number of Army Camps': 52,
  'Spring Capacity': 56,
  'Damage': 40,
  'Secondary Chain Damage': 52,
  'Burst Fire (Shots)': 48,
  'Spawned Zappies': 48,
  'Total Burn Damage': 52,
  'Burn Damage per Tick': 56,
  'Cumulative Gold Cost': 64,
  'Build Cost (Elixir)': 64,
  'Cumulative Elixir Cost': 64,
  'Wall Ring Cost': 56,
};
const DEFAULT_COL_WIDTH = 56;

const SHOW_CATEGORIES = ['Defenses', 'Resources', 'Traps', 'Army', 'Walls'];

const BB_CATEGORY_MAP: Record<string, string[]> = {
  Defenses: ['BB Archer Tower', 'BB Hidden Tesla', 'Crusher', 'BB Air Bombs', 'Multi Mortar', 'BB Roaster', 'Giant Cannon', 'BB Lava Launcher', 'BB X-Bow'],
  Traps: ['BB Spring Trap', 'Mine', 'Mega Mine'],
  Resources: ['BB Gold Mine', 'BB Elixir Collector', 'BB Gold Storage', 'BB Elixir Storage'],
  Army: ['BB Army Camp'],
  Walls: ['BB Walls'],
};

function buildBBCategories(builderHallLevel: number): Record<string, { level: number | null; isMaxLevel: boolean }> {
  const bbBuildings = (buildingLevelsData as any[]).filter((b: any) => b.village === 'builderBase');
  const entries: Record<string, { level: number | null; isMaxLevel: boolean }> = {};
  for (const building of bbBuildings) {
    const levelsAtOrBelow = building.levels.filter((l: any) => {
      const bh = l['Town Hall Level'];
      return bh != null && bh <= builderHallLevel;
    });
    if (levelsAtOrBelow.length === 0) continue;
    const maxLevel = levelsAtOrBelow.reduce((a: any, b: any) => (a.Level > b.Level ? a : b));
    const isMaxed = building.levels.every((l: any) => {
      const bh = l['Town Hall Level'];
      return bh == null || bh <= builderHallLevel;
    });
    entries[building.name] = { level: maxLevel.Level ?? 0, isMaxLevel: isMaxed };
  }
  return entries;
}

const CATEGORY_ICONS: Record<string, { set: 'ion' | 'mc'; name: string }> = {
  'Defenses': { set: 'ion', name: 'shield-half-outline' },
  'Resources': { set: 'mc', name: 'currency-usd' },
  'Traps': { set: 'mc', name: 'bomb' },
  'Army': { set: 'mc', name: 'sword-cross' },
  'Walls': { set: 'mc', name: 'wall' },
  'Builder Base': { set: 'mc', name: 'castle' },
};

const NAME_FIX: Record<string, string> = {
  'Lab': 'Laboratory',
  'Walls': 'Wall',
  'Builder Hut': "Builder's Hut",
};

function BuildingCard({ name, maxLvl, isMaxed, isBB, discounts }: { name: string; maxLvl: number; isMaxed: boolean; isBB?: boolean; discounts: ScopeDiscount }) {
  const [expanded, setExpanded] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [tableViewportW, setTableViewportW] = useState(0);
  const lookupName = NAME_FIX[name] ?? name;

  const buildingStats = useMemo(() => {
    const match = (buildingLevelsData as any).find((b: any) => {
      const bName = b.name.toLowerCase();
      return bName === name.toLowerCase() || bName === lookupName.toLowerCase();
    });
    return match || null;
  }, [name, lookupName]);

  const mainImgSource = getBuildingLevelImageSource(lookupName, maxLvl);

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

  const statCols = buildingStats ? buildingStats.statsColumns.filter((c: string) => c !== 'Level') : [];
  const showDiscounted = (discounts.costPercent > 0 || discounts.timePercent > 0) && (statCols.includes('Build Cost') || statCols.includes('Build Time'));
  const contentMinW = 46 + statCols.reduce((sum: number, c: string) => sum + (COL_WIDTH[c] || DEFAULT_COL_WIDTH), 0);

  const renderGrid = () => (
    <View style={styles.levelGrid}>
      {displayLevels.map((levelData: any) => {
        const lvl = levelData.Level;
        const cellSource = getBuildingLevelImageSource(lookupName, lvl);
        const isCurrent = lvl === maxLvl;
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
              <View style={styles.levelGridBadge}>
                <Text style={[styles.levelGridBadgeText, isCurrent && styles.levelGridBadgeTextCurrent]}>
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} onLayout={(e) => setTableViewportW(e.nativeEvent.layout.width)}>
              <View style={[styles.buildingStatsTable, { minWidth: Math.max(tableViewportW || contentMinW, contentMinW) }]}>
                <View style={styles.buildingStatRow}>
                  <View style={styles.buildingStatCellIcon}>
                    <Text style={[styles.buildingStatHeader, { color: Colors.textMuted }]}>Lvl</Text>
                  </View>
                  {statCols.map((col: string) => {
                    const label = col === 'Town Hall Level' && isBB ? 'BH' : (COL_ABBREV[col] || col);
                    return (
                      <Text
                        key={col}
                        style={[styles.buildingStatCell, styles.buildingStatHeader, { color: Colors.textMuted, minWidth: COL_WIDTH[col] || DEFAULT_COL_WIDTH }]}
                        numberOfLines={1}
                      >
                        {label}
                      </Text>
                    );
                  })}
                </View>
                {displayLevels.map((levelData: any) => {
                  const lvl = levelData.Level;
                  const isCurrentLevel = lvl === maxLvl;
                  return (
                    <View key={lvl} style={[styles.buildingStatRow, isCurrentLevel && styles.buildingStatRowCurrent]}>
                      <View style={styles.buildingStatCellIcon}>
                        <Text style={[styles.buildingStatLvlNum, isCurrentLevel && styles.buildingStatLvlNumCurrent]}>{lvl}</Text>
                      </View>
                      {
                        statCols.map((col: string) => {
                          const val = levelData[col] ?? '—';
                          const formatted = typeof val === 'number' ? formatCostShort(val) : String(val);
                          const isDiscounted = showDiscounted && (col === 'Build Cost' || col === 'Build Time');
                          const displayVal = isDiscounted
                            ? (col === 'Build Cost'
                              ? applyCostDiscount(formatted, discounts)
                              : applyTimeDiscount(String(val), discounts))
                            : formatted;
                          return (
                            <Text
                              key={col}
                              style={[styles.buildingStatCell, { color: isDiscounted ? Colors.warning : Colors.textSecondary, minWidth: COL_WIDTH[col] || DEFAULT_COL_WIDTH }]}
                              numberOfLines={1}
                            >
                              {displayVal}
                            </Text>
                          );
                        })}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
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
  const { discounts, setBuildingCost, setBuildingTime, resetDiscounts } = useDiscounts();
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const th = player?.townHallLevel ?? 1;
  const bh = player?.builderHallLevel ?? 1;
  const categories = thLevelsData.categories as Record<string, Record<string, Record<string, { level: number | null; isMaxLevel: boolean }>>>;
  const [selectedCat, setSelectedCat] = useState('');

  const bbEntries = useMemo(() => {
    if (!player || th < 6) return [];
    const entries = buildBBCategories(bh);
    return Object.entries(entries).filter(([, entry]) => (entry.level ?? 0) > 0);
  }, [player, th, bh]);

  const availableCats = [
    ...SHOW_CATEGORIES.filter((cat) => {
      const items = categories[cat];
      if (!items) return false;
      return Object.entries(items).some(([, thData]) => {
        const thEntry = thData[String(th)];
        return thEntry != null && (thEntry.level ?? 0) > 0;
      });
    }),
    ...(th >= 6 ? ['Builder Base'] : []),
  ];

  const isBB = selectedCat === 'Builder Base';
  const activeCat = selectedCat || availableCats[0] || '';

  const entries = isBB
    ? bbEntries
    : activeCat
      ? Object.entries(categories[activeCat] ?? {}).filter(([, thData]) => {
        const thEntry = thData[String(th)];
        return thEntry != null && (thEntry.level ?? 0) > 0;
      })
      : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Buildings</Text>
            <Pressable onPress={() => setDiscountModalVisible(true)} hitSlop={8}>
              <Ionicons
                name={discounts.buildings.costPercent > 0 || discounts.buildings.timePercent > 0 ? 'pricetag' : 'pricetag-outline'}
                size={24}
                color={discounts.buildings.costPercent > 0 || discounts.buildings.timePercent > 0 ? Colors.warning : Colors.textSecondary}
              />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            {isBB ? `Max levels for BH${bh} · Builder Base` : `Max levels for TH${th} · Tap to expand`}
          </Text>
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

        {entries.map(([name, entry]) => {
          const maxLvl = isBB ? (entry as any).level ?? 0 : (entry as any)[String(th)]?.level ?? 0;
          const isMaxed = isBB ? (entry as any).isMaxLevel ?? false : (entry as any)[String(th)]?.isMaxLevel ?? false;
          return (
            <BuildingCard
              key={name}
              name={name}
              maxLvl={maxLvl}
              isMaxed={isMaxed}
              isBB={isBB}
              discounts={discounts.buildings}
            />
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      <DiscountModal
        visible={discountModalVisible}
        onClose={() => setDiscountModalVisible(false)}
        scope="buildings"
        buildings={discounts.buildings}
        army={discounts.army}
        onBuildingCostChange={setBuildingCost}
        onBuildingTimeChange={setBuildingTime}
        onArmyCostChange={() => { }}
        onArmyTimeChange={() => { }}
        onReset={resetDiscounts}
      />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderWidth: 0.75,
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
  expandArrow: {
    width: 24,
    textAlign: 'center',
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  levelGridCell: {
    width: '20%',
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
    borderWidth: 0.75,
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
  buildingStatsTable: {
    marginTop: Spacing.sm,
    borderWidth: 0.75,
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