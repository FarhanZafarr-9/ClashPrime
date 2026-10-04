import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import PressableRipple from '../../src/components/PressableRipple';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, clashFontFamily } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import {
  getBuildingLevelImageSource,
  getBuildingImageSource,
  getTownHallImageSource,
  getBuildingAvailableLevels,
  getBuildingEffectiveMax,
  parseCost,
  parseTimeToSeconds,
  formatCost as fmtCost,
  formatTime as fmtTime,
} from '../../src/utils/buildingImages';
import { getBuildingCopies, getCountAtTH, getCountAtBH } from '../../src/utils/buildingCopies';
import type { BuildingCopies } from '../../src/utils/buildingCopies';
import {
  BUILDING_RESOURCE_META,
  getBuildingCategories,
  getBBCategories,
  getBuildingDetail,
  getBuildingItemImage,
} from '../../src/utils/buildingData';
import type { BuildingCostResource } from '../../src/utils/buildingData';
import { PACKAGE_RESOURCE_IMAGES } from '../../src/data/packageImages';

import { useDiscounts } from '../../src/hooks/useDiscounts';
import { useBuilderCount } from '../../src/hooks/useBuilderCount';
import { useDialog } from '../../src/components/AlertDialog';
import type { ScopeDiscount } from '../../src/hooks/useDiscounts';
import { applyCostDiscount, applyTimeDiscount } from '../../src/utils/discountUtils';
import { buildingUpgradeChainTimes, scheduleChains } from '../../src/utils/upgradeCosts';
import BottomSheet from '../../src/components/BottomSheet';
import { ItemCard } from '../../src/components/ItemCard';

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
  'Unlocked Spell': 'Spell',
  'Unlocked Hero': 'Hero',
  'Hero Slots': 'Hrs',
  'Boost Duration': 'Boost',
  'Health Recovery': 'Heal',
  'Troop Level': 'TrpLvl',
  'Spawn Count': 'Spawn',
  'Max Buildings': 'MaxBld',
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
  'Unlocked Spell': 72,
  'Unlocked Hero': 64,
  'Hero Slots': 48,
  'Boost Duration': 64,
  'Health Recovery': 64,
  'Troop Level': 64,
  'Spawn Count': 60,
  'Max Buildings': 64,
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

// Per-resource cost rows (icon image + colored amount), shared by the per-building
// and per-section "Remaining" tables. Resources without a package icon fall back
// to a colored dot.
function renderResourceRows(
  byResource: Record<string, number>,
  showDiscounted: boolean,
  discount: ScopeDiscount,
  fontSize = 11,
) {
  const entries = (Object.entries(byResource).filter(([, v]) => v > 0) as [string, number][])
    .filter(([r]) => r !== 'Unknown');
  if (entries.length === 0) {
    return <Text style={{ color: Colors.textSecondary, fontWeight: '600', fontSize }}>—</Text>;
  }
  return (
    <>
      {entries.map(([res, amt]) => {
        const icon = PACKAGE_RESOURCE_IMAGES[res];
        const meta = BUILDING_RESOURCE_META[res as BuildingCostResource];
        return (
          <View key={res} style={styles.resourceSumRow}>
            {icon ? (
              <Image source={icon} style={styles.resourceSumIcon} resizeMode="contain" />
            ) : (
              <View style={[styles.resourceSumDot, { backgroundColor: meta?.color ?? '#94A3B8' }]} />
            )}
            <Text
              style={{
                color: showDiscounted ? Colors.warning : (meta?.color ?? Colors.textSecondary),
                fontWeight: '600',
                fontSize,
                fontFamily: clashFontFamily(500),
              }}
            >
              {discountedCost(amt, showDiscounted, discount)}
            </Text>
          </View>
        );
      })}
    </>
  );
}

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

/** Two-letter fallback shown when a building has no image. */
function getInitials(name: string): string {
  return name.split(/[\s.]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const isMaxed = (level: number, max: number) => level >= max;

/** The halls gate themselves, so both villages list them under these names. */
const isHallName = (name: string) => name === 'Town Hall' || name === 'Builder Hall';

/** Highest level the package data carries for a building, e.g. 15 for the Town Hall. */
function getGlobalMaxLevel(lookupName: string, fallback: number): number {
  const levels = getBuildingAvailableLevels(lookupName);
  const max = levels.length > 0 ? levels[levels.length - 1] : 0;
  return max > 0 ? max : fallback;
}

/**
 * Max level of a building in the active village. The halls self-gate — at TH/BH n
 * the hall is level n — so they use the data's global max instead, which keeps
 * the future halls (and their costs) visible to a mid-game player.
 */
function getSectionMaxLevel(name: string, maxLvl: number, isBB: boolean, th: number, bh: number): number {
  const lookupName = NAME_FIX[name] ?? name;
  if (isHallName(name)) return getGlobalMaxLevel(lookupName, maxLvl);
  return maxLvl > 0 ? maxLvl : getBuildingEffectiveMax(lookupName, isBB ? bh : th);
}

const discountedCost = (amt: number, on: boolean, d: ScopeDiscount) =>
  on ? applyCostDiscount(fmtCost(amt), d) : fmtCost(amt);
const discountedTime = (sec: number, on: boolean, d: ScopeDiscount) =>
  on ? applyTimeDiscount(fmtTime(sec), d) : fmtTime(sec);

/** Stat table setup shared by the single-building card and the section. */
function useBuildingStats(lookupName: string, isBB: boolean | undefined, discounts: ScopeDiscount) {
  const buildingStats = useMemo(() => getBuildingDetail(lookupName, { builderBase: isBB }), [lookupName, isBB]);
  const statCols = buildingStats ? buildingStats.statsColumns.filter((c: string) => c !== 'Level') : [];
  const showDiscounted = (discounts.costPercent > 0 || discounts.timePercent > 0) && (statCols.includes('Build Cost') || statCols.includes('Build Time'));
  return {
    buildingStats,
    statCols,
    showDiscounted,
    fmtTimeD: (sec: number) => discountedTime(sec, showDiscounted, discounts),
    fmtCostD: (amt: number) => discountedCost(amt, showDiscounted, discounts),
  };
}

/** Level grid cells (image + level badge, condensed with an ellipsis). */
function renderLevelGridCells({ levels, expand, lookupName, fallbackName, isCurrent }: {
  levels: any[];
  expand: boolean;
  lookupName: string;
  fallbackName: string;
  isCurrent: (lvl: number) => boolean;
}) {
  return condenseLevels(levels, 2, 3, expand).map((item) => {
    if (item.kind === 'ellipsis') {
      return (
        <View key="ellipsis" style={styles.levelGridCell}>
          <View style={styles.levelGridEllipsisWrap}>
            <Text style={styles.levelGridEllipsisText}>...</Text>
          </View>
        </View>
      );
    }
    const lvl = item.data.Level;
    const cellSource = getBuildingLevelImageSource(lookupName, lvl);
    const current = isCurrent(lvl);
    return (
      <View key={lvl} style={[styles.levelGridCell, current && styles.levelGridCellCurrent]}>
        <View style={styles.levelGridImgWrap}>
          {cellSource ? (
            <Image source={cellSource} style={styles.levelGridImg} resizeMode="contain" />
          ) : (
            <View style={[styles.levelGridImg, styles.levelGridImgFallback]}>
              <Text style={styles.levelGridFallbackText}>{getInitials(fallbackName)}</Text>
            </View>
          )}
          <View style={[styles.levelGridBadge, current && styles.levelGridBadgeCurrent]}>
            <Text style={styles.levelGridBadgeText}>{lvl}</Text>
          </View>
        </View>
      </View>
    );
  });
}

/** Per-level stats table. `richCost` adds the resource icon + colour to the Build Cost column. */
function StatsTable({ levels, expand, statCols, isBB, isCurrent, showDiscounted, discounts, richCost }: {
  levels: any[];
  expand: boolean;
  statCols: string[];
  isBB?: boolean;
  isCurrent: (lvl: number) => boolean;
  showDiscounted: boolean;
  discounts: ScopeDiscount;
  richCost?: boolean;
}) {
  const [viewportW, setViewportW] = useState(0);
  const contentMinW = 46 + statCols.reduce((sum: number, c: string) => sum + (COL_WIDTH[c] || DEFAULT_COL_WIDTH), 0);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} onLayout={(e) => setViewportW(e.nativeEvent.layout.width)}>
      <View style={[styles.buildingStatsTable, { minWidth: Math.max(viewportW || contentMinW, contentMinW) }]}>
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
        {condenseLevels(levels, 2, 3, expand).map((item) => {
          if (item.kind === 'ellipsis') {
            return (
              <View key="ellipsis" style={styles.buildingStatRow}>
                <View style={[styles.buildingStatCell, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: Colors.textMuted, fontSize: 11 }}>...</Text>
                </View>
              </View>
            );
          }
          const levelData = item.data;
          const lvl = levelData.Level;
          const current = isCurrent(lvl);
          return (
            <View key={lvl} style={[styles.buildingStatRow, current && styles.buildingStatRowCurrent]}>
              <View style={styles.buildingStatCellIcon}>
                <Text style={[styles.buildingStatLvlNum, current && styles.buildingStatLvlNumCurrent]}>{lvl}</Text>
              </View>
              {statCols.map((col: string) => {
                const val = levelData[col] ?? '—';
                const formatted = typeof val === 'number' ? formatCostShort(val) : String(val);
                const isDiscounted = showDiscounted && (col === 'Build Cost' || col === 'Build Time');
                const resColor = richCost && col === 'Build Cost'
                  ? BUILDING_RESOURCE_META[(levelData['Build Cost Resource'] as BuildingCostResource) ?? 'Unknown']?.color
                  : undefined;
                const displayVal = isDiscounted
                  ? (col === 'Build Cost'
                    ? applyCostDiscount(formatted, discounts)
                    : applyTimeDiscount(String(val), discounts))
                  : formatted;
                if (richCost && col === 'Build Cost') {
                  const res = (levelData['Build Cost Resource'] as BuildingCostResource) ?? 'Unknown';
                  const icon = PACKAGE_RESOURCE_IMAGES[res];
                  const color = isDiscounted ? Colors.warning : (resColor ?? Colors.textSecondary);
                  return (
                    <View
                      key={col}
                      style={[styles.buildingStatCell, styles.buildingStatCostCell, { minWidth: COL_WIDTH[col] || DEFAULT_COL_WIDTH }]}
                    >
                      {icon ? <Image source={icon} style={styles.buildingStatCostIcon} resizeMode="contain" /> : null}
                      <Text style={{ color, fontSize: 11, fontWeight: '500', fontFamily: clashFontFamily(500, 11) }} numberOfLines={1}>{displayVal}</Text>
                    </View>
                  );
                }
                return (
                  <Text
                    key={col}
                    style={[styles.buildingStatCell, { color: isDiscounted ? Colors.warning : (resColor ?? Colors.textSecondary), minWidth: COL_WIDTH[col] || DEFAULT_COL_WIDTH }]}
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
  );
}

/** "Remaining" summary table. The section variant is denser and may add a Distributed column. */
function RemainingTable({ variant, levelsText, byResource, timeText, distributedText, showDiscounted, discounts }: {
  variant: 'card' | 'section';
  levelsText: string;
  byResource: Record<string, number>;
  timeText: string;
  distributedText?: string;
  showDiscounted: boolean;
  discounts: ScopeDiscount;
}) {
  const section = variant === 'section';
  const headStyle = section ? styles.sectionRemainingHead : styles.remainingHead;
  const cellStyle = section ? styles.sectionRemainingTotalCell : styles.remainingTotalCell;
  return (
    <View style={section ? styles.buildingSectionRemaining : styles.remainingTable}>
      <View style={styles.remainingRow}>
        <Text style={[headStyle, { flex: 1 }]}>Remaining</Text>
        <Text style={[headStyle, { flex: 1 }]}>Cost</Text>
        <Text style={[headStyle, { flex: 1 }]}>Time</Text>
        {distributedText !== undefined && <Text style={[headStyle, { flex: 1 }]}>Distributed</Text>}
      </View>
      <View style={styles.remainingTotalRow}>
        <Text style={[cellStyle, { flex: 1 }]}>{levelsText}</Text>
        <View style={[cellStyle, { flex: 1 }]}>
          {renderResourceRows(byResource, showDiscounted, discounts, section ? 10 : 11)}
        </View>
        <Text style={[cellStyle, { flex: 1 }]}>{timeText}</Text>
        {distributedText !== undefined && <Text style={[cellStyle, { flex: 1 }]}>{distributedText}</Text>}
      </View>
    </View>
  );
}

function ExpandToggle({ open, total, onPress }: { open: boolean; total: number; onPress: () => void }) {
  return (
    <PressableRipple style={styles.expandTableBtn} onPress={onPress}>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textSecondary} />
      <Text style={styles.expandTableText}>{open ? 'Show fewer' : `Show all ${total} levels`}</Text>
    </PressableRipple>
  );
}

function ActionButton({ label, onPress, onLongPress }: { label: string; onPress: () => void; onLongPress?: () => void }) {
  return (
    <PressableRipple style={styles.upgradeBtn} onPress={onPress} onLongPress={onLongPress}>
      <Text style={styles.upgradeBtnText}>{label}</Text>
      <Ionicons name="arrow-forward" size={14} color={Colors.bg} />
    </PressableRipple>
  );
}

function BuildingCard({ name, copyIndex, count, copies, effectiveMax, isBB, discounts, isFirst, isLast, showDescription, inSection, onOpen, inSheet, hideHeader }: {
  name: string;
  copyIndex: number;
  count: number;
  copies: BuildingCopies;
  effectiveMax: number;
  isBB?: boolean;
  discounts: ScopeDiscount;
  isFirst?: boolean;
  isLast?: boolean;
  showDescription?: boolean;
  inSection?: boolean;
  onOpen?: () => void;
  inSheet?: boolean;
  /** Skip the item card, e.g. when the sheet header already shows the same row. */
  hideHeader?: boolean;
}) {
  const { setBuildingCopies } = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const lookupName = NAME_FIX[name] ?? name;

  const { buildingStats, statCols, showDiscounted, fmtTimeD, fmtCostD } = useBuildingStats(lookupName, isBB, discounts);

  const currentLevel = copies.levels[copyIndex] ?? 0;
  const isFullyMaxed = isMaxed(currentLevel, effectiveMax);
  const isLocked = currentLevel === 0;

  const mainImgSource = getBuildingLevelImageSource(lookupName, Math.max(currentLevel, 1));

  const availableLevels = getBuildingAvailableLevels(lookupName);
  // Only show levels the player can actually reach at their TH/BH — no stats
  // rows or level images for unreachable future levels. The self-gated halls
  // (Town Hall, Builder Hall) are always maxed, so keep one future level
  // visible to hint their next upgrade.
  const viewCap = name === 'Town Hall' || name === 'Builder Hall' ? effectiveMax + 1 : effectiveMax;
  const allLevels: any[] = (buildingStats?.levels ?? availableLevels.map((l) => ({ Level: l })))
    .filter((l: any) => effectiveMax <= 0 || l.Level <= viewCap);
  const showExpand = allLevels.length > 3;
  const isExpanded = inSheet || expanded;

  let displayLevels: any[];
  if (!isExpanded) {
    displayLevels = [];
  } else if (showFull || !showExpand) {
    displayLevels = allLevels;
  } else {
    const currentIdx = allLevels.findIndex((l: any) => l.Level === currentLevel);
    const start = Math.max(0, currentIdx - 1);
    const end = Math.min(allLevels.length, currentIdx + 2);
    displayLevels = allLevels.slice(start, end);
  }

  const remainingLevels = allLevels.filter((l: any) => l.Level > currentLevel && l.Level <= effectiveMax);
  let totalCost = 0;
  let totalTime = 0;
  const remainingByResource: Record<string, number> = {};
  for (const lvl of remainingLevels) {
    if (lvl['Build Cost']) {
      const amt = parseCost(String(lvl['Build Cost']));
      totalCost += amt;
      const res = lvl['Build Cost Resource'] ?? 'Unknown';
      remainingByResource[res] = (remainingByResource[res] ?? 0) + amt;
    }
    if (lvl['Build Time']) totalTime += parseTimeToSeconds(String(lvl['Build Time']));
  }
  const hasRemaining = remainingLevels.length > 0 && totalCost > 0;

  const setCopyLevel = (level: number) => {
    const next = [...copies.levels];
    next[copyIndex] = level;
    setBuildingCopies(lookupName, next, copies.maxLevel);
  };

  const hideMaxLevelCell = isFullyMaxed && currentLevel > 1;

  const renderGrid = () => {
    const gridLevels = hideMaxLevelCell
      ? allLevels.slice(-3)
      : displayLevels;
    const cells = renderLevelGridCells({
      levels: gridLevels,
      expand: showFull,
      lookupName,
      fallbackName: name,
      isCurrent: (lvl) => lvl === currentLevel,
    });

    if (hideMaxLevelCell) {
      return (
        <View style={styles.levelGridBorder}>
          <View style={styles.levelGrid}>
            {cells}
            <PressableRipple
              onPress={() => setCopyLevel(currentLevel - 1)}
              style={styles.levelGridDowngrade}
              accessibilityLabel={`Downgrade ${name} copy ${copyIndex + 1}`}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={16} color={Colors.bg} />
            </PressableRipple>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.levelGridBorder}>
        <View style={styles.levelGrid}>
          {cells}
        </View>
      </View>
    );
  };

  const toggleExpanded = () => {
    if (inSection) return;
    if (inSheet) return;
    if (onOpen) {
      onOpen();
      return;
    }
    if (expanded) {
      setExpanded(false);
      setShowFull(false);
    } else {
      setExpanded(true);
    }
  };

  return (
    <View style={[
      styles.itemCard,
      inSheet && styles.itemCardInSheet,
      inSection && styles.itemCardInSection,
      hideHeader && styles.itemCardBodyOnly,
      isFirst && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
      isLast && !expanded && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
    ]}>
      {!hideHeader && (
      <ItemCard
        name={name}
        subtitle={inSection ? `Copy ${copyIndex + 1}${isFullyMaxed ? '' : ` · ${fmtTimeD(totalTime)}`}` : undefined}
        level={currentLevel}
        maxLevel={effectiveMax}
        iconSource={mainImgSource ?? undefined}
        locked={isLocked}
        costLabel={inSection && hasRemaining ? fmtCostD(totalCost) : undefined}
        onPress={toggleExpanded}
        isFirst={isFirst}
        isLast={isLast && !expanded}
        actionIcon={isFullyMaxed
          ? count === 1 ? 'checkmark-circle' : undefined
          : count > 1 ? 'chevron-up' : undefined}
        onActionPress={count > 1 ? () => setCopyLevel(Math.min(currentLevel + 1, effectiveMax)) : undefined}
        actionAccessibilityLabel={`Upgrade ${name} copy ${copyIndex + 1}`}
        actionColor={isFullyMaxed && count === 1 ? Colors.warning : Colors.textPrimary}
        actionIcon2={count > 1 && currentLevel > 1 ? 'chevron-down' : undefined}
        onActionPress2={() => setCopyLevel(Math.max(currentLevel - 1, 1))}
        actionAccessibilityLabel2={`Downgrade ${name} copy ${copyIndex + 1}`}
        actionColor2={Colors.textPrimary}
        subtitleWithBar
        hideLevelBadge={isFullyMaxed}
      />
      )}

      {isLocked && effectiveMax > 0 && !inSection && (
        <View style={styles.expandedSection}>
          <Text style={styles.buildingDesc} numberOfLines={3}>This building is available at your Town Hall level. Tap to unlock it.</Text>
          <ActionButton label={`Unlock ${name}`} onPress={() => setCopyLevel(1)} />
        </View>
      )}

      {!isLocked && !inSection && isExpanded && displayLevels.length > 0 && (
        <View style={[styles.expandedSection, hideHeader && styles.expandedSectionBodyOnly]}>
          {showDescription && buildingStats?.description ? (
            <Text style={styles.buildingDesc} numberOfLines={3}>{buildingStats.description}</Text>
          ) : null}
          {renderGrid()}
          {hasRemaining && (
            <RemainingTable
              variant="card"
              levelsText={`${remainingLevels.length} levels`}
              byResource={remainingByResource}
              timeText={fmtTimeD(totalTime)}
              showDiscounted={showDiscounted}
              discounts={discounts}
            />
          )}
          {buildingStats && (
            <StatsTable
              levels={displayLevels}
              expand={showFull}
              statCols={statCols}
              isBB={isBB}
              isCurrent={(lvl) => lvl === currentLevel}
              showDiscounted={showDiscounted}
              discounts={discounts}
              richCost
            />
          )}
          {showExpand && (
            <ExpandToggle open={showFull} total={allLevels.length} onPress={() => setShowFull(!showFull)} />
          )}
          {(hasRemaining || (currentLevel > 1 && !isFullyMaxed)) && (
            <View style={styles.upgradeRow}>
              {hasRemaining && (
                <ActionButton
                  label={`Upgrade to Lv${currentLevel + 1}`}
                  onPress={() => setCopyLevel(currentLevel + 1)}
                  onLongPress={() => setCopyLevel(effectiveMax)}
                />
              )}
              {currentLevel > 1 && (
                <PressableRipple
                  style={styles.downgradeBtn}
                  onPress={() => setCopyLevel(currentLevel - 1)}
                >
                  <Ionicons name="arrow-back" size={16} color={Colors.bg} />
                </PressableRipple>
              )}
              {!isFullyMaxed && (
                <PressableRipple
                  style={styles.maxBtn}
                  onPress={() => setCopyLevel(effectiveMax)}
                >
                  <Ionicons name="arrow-up-circle" size={16} color={Colors.bg} />
                </PressableRipple>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function LevelGroupPresets({
  value,
  onUpgrade,
}: {
  value: number;
  onUpgrade: (count: number) => void;
}) {
  const presets = [1, 10, 50, value];
  const labels = ['+1', '+10', '+50', 'All'];
  return (
    <View style={styles.presetRow}>
      {presets.map((p, i) => (
        <PressableRipple
          key={labels[i]}
          style={[
            styles.presetBtn,
            (value <= 0 || (p === value && labels[i] !== 'All')) && styles.presetBtnDisabled,
          ]}
          onPress={() => onUpgrade(Math.min(p, value))}
          disabled={value <= 0}
          accessibilityLabel={`Upgrade ${labels[i]}`}
        >
          <Text style={styles.presetBtnText}>{labels[i]}</Text>
        </PressableRipple>
      ))}
    </View>
  );
}

function BuildingCollapsibleSection({
  title,
  count,
  copies,
  effectiveMax,
  isBB,
  discounts,
  isFirst,
  isLast,
  onOpen,
  groupByLevel,
  inSheet,
  children,
}: {
  title: string;
  count: number;
  copies: BuildingCopies;
  effectiveMax: number;
  isBB: boolean;
  discounts: ScopeDiscount;
  isFirst: boolean;
  isLast: boolean;
  onOpen?: () => void;
  groupByLevel?: boolean;
  inSheet?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [showAllLevels, setShowAllLevels] = useState(false);
  const { setBuildingCopies } = usePlayer();
  const { count: builderCount } = useBuilderCount();
  const totalLevel = copies.levels.reduce((s, l) => s + l, 0);
  const totalMax = copies.levels.length * effectiveMax;
  const isSectionMaxed = totalMax > 0 && isMaxed(totalLevel, totalMax);
  const isOpen = inSheet || open;
  const toggle = () => {
    if (inSheet) return;
    if (onOpen) {
      onOpen();
      return;
    }
    setOpen(!open);
  };
  const lookupName = NAME_FIX[title] ?? title;
  const upgradeAllCopiesByOne = () => {
    const next = copies.levels.map((l) => (l <= 0 ? l : Math.min(l + 1, effectiveMax)));
    setBuildingCopies(lookupName, next, copies.maxLevel);
  };
  const maxAllCopies = () => {
    const next = copies.levels.map((l) => (l <= 0 ? l : effectiveMax));
    setBuildingCopies(lookupName, next, copies.maxLevel);
  };
  const downgradeAllCopiesByOne = () => {
    const next = copies.levels.map((l) => (l <= 1 ? l : l - 1));
    setBuildingCopies(lookupName, next, copies.maxLevel);
  };
  const canDowngrade = copies.levels.some((l) => l > 1);

  // Group copies by their current level so high-count buildings (e.g. Walls)
  // collapse into one row per distinct level instead of N individual cards.
  const levelGroups = useMemo(() => {
    const map = new Map<number, number>();
    for (const lvl of copies.levels) {
      if (lvl <= 0) continue;
      map.set(lvl, (map.get(lvl) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([level, numCopies]) => ({ level, numCopies }));
  }, [copies.levels]);

  // Upgrade up to `count` copies sitting at `level` by one level. Used by the
  // per-group quick-upgrade preset buttons (+1/+10/+50/All).
  const upgradeLevelCopies = (level: number, count: number) => {
    const next = [...copies.levels];
    let moved = 0;
    for (let i = 0; i < next.length && moved < count; i++) {
      if (next[i] === level) {
        next[i] = Math.min(level + 1, effectiveMax);
        moved++;
      }
    }
    if (moved > 0) setBuildingCopies(lookupName, next, copies.maxLevel);
  };

  const buildLevelGroups = () => (
    <View>
      {levelGroups.map((g, i) => {
        const isLastGroup = i === levelGroups.length - 1;
        const imgSource = getBuildingLevelImageSource(lookupName, g.level);
        const groupMaxed = isMaxed(g.level, effectiveMax);
        return (
          <ItemCard
            key={g.level}
            name={`${title} ×${g.numCopies}`}
            level={g.level}
            maxLevel={effectiveMax}
            iconSource={imgSource ?? undefined}
            isLast={isLastGroup}
            hideLevelBadge={groupMaxed}
            footer={groupMaxed ? undefined :
              <LevelGroupPresets
                value={g.numCopies}
                onUpgrade={(n) => upgradeLevelCopies(g.level, n)}
              />
            }
          />
        );
      })}
    </View>
  );
  const availableCopyLevels = copies.levels.filter((l) => l > 0);
  const icon = getBuildingLevelImageSource(lookupName, availableCopyLevels.length > 0 ? Math.min(...availableCopyLevels) : 1);

  const { buildingStats, statCols, showDiscounted, fmtTimeD } = useBuildingStats(lookupName, isBB, discounts);

  // Format large level counts as rounded thousands (e.g. 2000 -> "2K").
  const fmtLevels = (n: number): string => {
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return n.toString();
  };

  // Aggregate remaining levels/cost/time across every copy.
  const aggregate = useMemo(() => {
    let remainingLevels = 0;
    let totalCost = 0;
    let totalTime = 0;
    const byResource: Record<string, number> = {};
    const lookupName = NAME_FIX[title] ?? title;
    const availableLevels = getBuildingAvailableLevels(lookupName);
    const allLevels: any[] = (buildingStats?.levels ?? availableLevels.map((l) => ({ Level: l })))
      .filter((l: any) => effectiveMax <= 0 || l.Level <= effectiveMax);
    for (const lvl of copies.levels) {
      if (lvl <= 0) continue;
      const rem = allLevels.filter((l: any) => l.Level > lvl && l.Level <= effectiveMax);
      remainingLevels += rem.length;
      for (const l of rem) {
        if (l['Build Cost']) {
          const amt = parseCost(String(l['Build Cost']));
          totalCost += amt;
          const res = l['Build Cost Resource'] ?? 'Unknown';
          byResource[res] = (byResource[res] ?? 0) + amt;
        }
        if (l['Build Time']) totalTime += parseTimeToSeconds(String(l['Build Time']));
      }
    }
    return { remainingLevels, totalCost, totalTime, byResource };
  }, [title, copies, effectiveMax, buildingStats]);

  // Wall-clock time to finish all remaining levels across every copy, using the
  // chosen builder count. Per-copy serial chains are LPT bin-packed across the
  // builders, yielding the makespan — a naive total/builders is wrong because a
  // single long chain can't be split across builders.
  const distributedTime = useMemo(() => {
    if (builderCount <= 1) return aggregate.totalTime;
    const chains = buildingUpgradeChainTimes(NAME_FIX[title] ?? title, copies.levels, effectiveMax);
    if (chains.length === 0) return 0;
    return scheduleChains(chains, builderCount);
  }, [builderCount, aggregate.totalTime, title, copies.levels, effectiveMax]);
  const hasRemaining = aggregate.remainingLevels > 0 && aggregate.totalCost > 0;

  // Merged level grid + stats table across every copy. Concise state shows a
  // span from just below the lowest copy level up to 2 levels ahead of the
  // highest (clamped to effectiveMax); "show all" expands to the full range.
  const availableLevels = getBuildingAvailableLevels(lookupName);
  const allLevels: any[] = (buildingStats?.levels ?? availableLevels.map((l) => ({ Level: l })))
    .filter((l: any) => effectiveMax <= 0 || l.Level <= effectiveMax);
  const posLevels = copies.levels.filter((l) => l > 0);
  const minCopyLevel = posLevels.length > 0 ? Math.min(...posLevels) : 1;
  const maxCopyLevel = posLevels.length > 0 ? Math.max(...posLevels) : effectiveMax;
  const spanMin = Math.max(1, minCopyLevel - 1);
  const spanMax = Math.max(maxCopyLevel, Math.min(effectiveMax, maxCopyLevel + 2));
  const showLevelSpan = allLevels.length > (spanMax - spanMin + 1);
  const mergedDisplayLevels = showAllLevels
    ? allLevels
    : allLevels.filter((l: any) => l.Level >= spanMin && l.Level <= spanMax);
  const mergedGridLevels = isSectionMaxed ? allLevels.slice(-3) : mergedDisplayLevels;

  return (
    <>
      {!inSheet && (
        <View style={{ marginHorizontal: 15 }}>
          <ItemCard
            name={title}
            level={totalLevel}
            maxLevel={totalMax}
            iconSource={icon}
            onPress={toggle}
            isFirst={isFirst || isOpen}
            isLast={isLast && !isOpen}
            actionText={isSectionMaxed ? undefined : String(count)}
            actionIcon={isSectionMaxed ? 'checkmark-circle' : undefined}
            actionColor={Colors.warning}
            actionPosition={isSectionMaxed ? 'after' : 'before'}
            onActionPress={undefined}
            hideLevelBadge={isSectionMaxed}
          />
        </View>
      )}
      {isOpen && (
        <View style={styles.buildingSectionBody}>
          {buildingStats?.description ? (
            <Text style={styles.buildingSectionDescText} numberOfLines={3}>{buildingStats.description}</Text>
          ) : null}
          {(hasRemaining || !isSectionMaxed) && (
            <View style={styles.buildingSectionRemainingRow}>
              {hasRemaining && (
                <RemainingTable
                  variant="section"
                  levelsText={`${fmtLevels(aggregate.remainingLevels)} levels`}
                  byResource={aggregate.byResource}
                  timeText={fmtTimeD(aggregate.totalTime)}
                  distributedText={builderCount > 0 ? fmtTimeD(distributedTime) : undefined}
                  showDiscounted={showDiscounted}
                  discounts={discounts}
                />
              )}
              {!isSectionMaxed && (
                <View style={styles.buildingSectionQuickBtns}>
                  <PressableRipple
                    onPress={upgradeAllCopiesByOne}
                    onLongPress={maxAllCopies}
                    style={styles.buildingSectionQuickBtn}
                    hitSlop={4}
                    accessibilityLabel={`Upgrade all ${title} copies by one. Hold to max all out`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="arrow-up-circle" size={20} color={Colors.textSecondary} />
                  </PressableRipple>
                  {canDowngrade && (
                    <PressableRipple
                      onPress={downgradeAllCopiesByOne}
                      style={styles.buildingSectionQuickBtn}
                      hitSlop={4}
                      accessibilityLabel={`Downgrade all ${title} copies by one`}
                      accessibilityRole="button"
                    >
                      <Ionicons name="arrow-down-circle" size={20} color={Colors.textSecondary} />
                    </PressableRipple>
                  )}
                </View>
              )}
            </View>
          )}
          {mergedDisplayLevels.length > 0 && (
            <View>
              <View style={styles.levelGridBorder}>
                <View style={styles.levelGrid}>
                  {renderLevelGridCells({
                    levels: mergedGridLevels,
                    expand: showAllLevels,
                    lookupName,
                    fallbackName: title,
                    isCurrent: (lvl) => copies.levels.includes(lvl),
                  })}
                  {isSectionMaxed && (
                    <PressableRipple
                      onPress={downgradeAllCopiesByOne}
                      style={styles.levelGridDowngrade}
                      accessibilityLabel={`Downgrade all ${title} copies by one`}
                      accessibilityRole="button"
                    >
                      <Ionicons name="arrow-down-circle" size={20} color={Colors.bg} />
                    </PressableRipple>
                  )}
                </View>
              </View>
              {buildingStats && (
                <StatsTable
                  levels={mergedDisplayLevels}
                  expand={showAllLevels}
                  statCols={statCols}
                  isBB={isBB}
                  isCurrent={(lvl) => copies.levels.includes(lvl)}
                  showDiscounted={showDiscounted}
                  discounts={discounts}
                />
              )}
              {showLevelSpan && !isSectionMaxed && (
                <ExpandToggle open={showAllLevels} total={allLevels.length} onPress={() => setShowAllLevels(!showAllLevels)} />
              )}
            </View>
          )}
          {groupByLevel
            ? buildLevelGroups()
            : children}
          {!isLast && !inSheet && <View style={styles.buildingSectionSeparator} />}
        </View>
      )}
    </>
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

// Category pills sit two to a row, matching the Army tab chips. Wider than the
// previous three-up, which left the longer labels and their "N types" subtitles
// truncated.
const PILL_COLUMNS = 2;

/**
 * Seamless-grid corner rounding, matching the Army tab chips: the pills read as
 * one rounded block, so only the four outermost corners take the large radius
 * and the interior seams stay at Radius.sm.
 *
 * Derived from the cell index rather than hardcoded, because the pill count
 * varies with the player's village and the last row is often partial. A cell can
 * be simultaneously the first and last of its row, and both the top and bottom of
 * the block (single row, or a lone trailing pill), so each corner is tested
 * independently instead of by a single "is this a corner cell" branch.
 */
function pillCornerStyle(index: number, total: number, columns = PILL_COLUMNS) {
  const outer = Radius.xl * 1.25;
  const firstRowCount = Math.min(columns, total);
  const lastRowStart = Math.floor((total - 1) / columns) * columns;
  return {
    ...(index === 0 && { borderTopLeftRadius: outer }),
    ...(index === firstRowCount - 1 && { borderTopRightRadius: outer }),
    ...(index === lastRowStart && { borderBottomLeftRadius: outer }),
    ...(index === total - 1 && { borderBottomRightRadius: outer }),
  };
}

/**
 * The same seamless treatment for a single horizontal row of segments (the
 * Home Village / Builder Base switch). Only the two ends are outer corners, so
 * there is no row wrapping to derive the position from.
 */
function segCornerStyle(index: number, total: number) {
  // A single row is a grid with as many columns as segments.
  return pillCornerStyle(index, total, total);
}

type CondensedLevel = { kind: 'row'; data: any } | { kind: 'ellipsis' };

function condenseLevels(levels: any[], head = 2, tail = 3, expand = false): CondensedLevel[] {
  if (expand || levels.length <= head + tail + 1) {
    return levels.map((data) => ({ kind: 'row', data }));
  }
  const out: CondensedLevel[] = [];
  for (let i = 0; i < head; i++) out.push({ kind: 'row', data: levels[i] });
  out.push({ kind: 'ellipsis' });
  for (let i = levels.length - tail; i < levels.length; i++) out.push({ kind: 'row', data: levels[i] });
  return out;
}

function formatCostShort(cost: number): string {
  if (cost >= 100000000) return (cost / 1000000).toFixed(0) + 'M';
  if (cost >= 1000000) return (cost / 1000000).toFixed(cost % 1000000 === 0 ? 0 : 1).replace('.0', '') + 'M';
  if (cost >= 1000) return (cost / 1000).toFixed(cost % 1000 === 0 ? 0 : 1).replace('.0', '') + 'K';
  return String(cost);
}

export default function BuildingsScreen() {
  const router = useRouter();
  const { cat: initialCat } = useLocalSearchParams<{ cat?: string }>();
  const { player, setBuildingCopies } = usePlayer();
  const { show: showDialog, Dialog } = useDialog();
  const { discounts } = useDiscounts();
  const th = player?.townHallLevel ?? 1;
  const bh = player?.builderHallLevel ?? 1;
  const categories = getBuildingCategories(th);
  const bbCategories = useMemo(() => getBBCategories(bh), [bh]);
  // Back-compat with old deep links: ?cat=Builder Base now means "switch to Builder Base".
  const [village, setVillage] = useState<'home' | 'builder'>(initialCat === 'Builder Base' ? 'builder' : 'home');
  const [selectedCat, setSelectedCat] = useState(initialCat && initialCat !== 'Builder Base' ? initialCat : '');
  const [sheetName, setSheetName] = useState<string | null>(null);

  const [prevSheetScope, setPrevSheetScope] = useState(`${initialCat === 'Builder Base' ? 'builder' : 'home'}|${initialCat && initialCat !== 'Builder Base' ? initialCat : ''}`);
  const sheetScope = `${village}|${selectedCat}`;
  if (sheetScope !== prevSheetScope) {
    setPrevSheetScope(sheetScope);
    setSheetName(null);
  }

  const showBB = th >= 6;
  const isBB = village === 'builder' && showBB;
  const activeData = isBB ? bbCategories : categories;
  const levelKey = isBB ? bh : th;

  const availableCats = useMemo(() => SHOW_CATEGORIES.filter((cat) => {
    const items = activeData[cat];
    if (!items) return false;
    return Object.entries(items).some(([, data]) => {
      const entry = data[String(levelKey)];
      return entry != null && (entry.level ?? 0) > 0;
    });
  }), [activeData, levelKey]);

  const activeCat = selectedCat && availableCats.includes(selectedCat)
    ? selectedCat
    : availableCats[0] || '';

  // Pills are chunked into explicit rows rather than left to flex-wrap on a fixed
  // percentage width, so each pill can be flex: 1 and fill its row exactly. The gap
  // is the only spacing, and a partial trailing row (the Walls pill) spans it whole.
  const pillRows = useMemo(() => {
    const rows: string[][] = [];
    for (let i = 0; i < availableCats.length; i += PILL_COLUMNS) {
      rows.push(availableCats.slice(i, i + PILL_COLUMNS));
    }
    return rows;
  }, [availableCats]);

  // Each category pill leads with a real building the player actually owns in the
  // active village, drawn at the highest level among its copies, and counts how
  // many of its types are already fully maxed. Builder Base names are stored
  // prefixed ("BB Cannon") and resolve through NAME_FIX and toPackageName, so the
  // same lookup works for both villages.
  const catMeta = useMemo(() => {
    const out: Record<string, { image: number | null; types: number; maxed: number }> = {};
    for (const cat of SHOW_CATEGORIES) {
      const items = activeData[cat] ?? {};
      const owned = Object.entries(items).filter(([, data]) => {
        const entry = data[String(levelKey)];
        return entry != null && (entry.level ?? 0) > 0;
      });
      let image: number | null = null;
      let levelImageFound = false;
      let maxed = 0;
      for (const [name, data] of owned) {
        const lookupName = NAME_FIX[name] ?? name;
        const maxLvl = (data as any)[String(levelKey)]?.level ?? 0;
        const effectiveMax = getSectionMaxLevel(name, maxLvl, isBB, th, bh);
        const count = isBB ? getCountAtBH(lookupName, bh) : getCountAtTH(lookupName, th);
        const copies = getBuildingCopies(
          lookupName,
          player?.buildingLevels,
          player?.buildings,
          effectiveMax,
          count,
          player?.lastMaxedTH,
          isBB ? undefined : th,
        );
        // A type counts as maxed once every copy sits at its max level, the same
        // test the list uses to sort maxed buildings to the bottom.
        if (copies.levels.length > 0 && effectiveMax > 0 && copies.levels.every((l) => l >= effectiveMax)) {
          maxed++;
        }
        // Highest level across the building's copies. A building the player has
        // none of yet (all copies locked at 0) is skipped, so the pill never shows
        // a level the account does not own.
        const maxCopyLevel = copies.levels.reduce((m, l) => (l > 0 && l > m ? l : m), 0);
        if (!levelImageFound && maxCopyLevel > 0) {
          const src = getBuildingLevelImageSource(lookupName, maxCopyLevel);
          if (src) {
            image = src;
            levelImageFound = true;
          }
        }
        // Nothing placed yet: fall back to the generic building art.
        if (!levelImageFound && image == null) image = getBuildingImageSource(lookupName) ?? null;
      }
      out[cat] = { image, types: owned.length, maxed };
    }
    return out;
  }, [activeData, levelKey, isBB, th, bh, player]);

  // The village switch leads with the halls the player are actually at.
  const thHallImage = getTownHallImageSource(th);
  const bhHallImage = getBuildingItemImage('Builder Hall', bh, true);

  const [prevInitialCat, setPrevInitialCat] = useState(initialCat);
  if (initialCat !== prevInitialCat) {
    setPrevInitialCat(initialCat);
    if (initialCat && initialCat !== 'Builder Base' && availableCats.includes(initialCat)) {
      setSelectedCat(initialCat);
    }
  }

  const entries = useMemo(() => activeCat
    ? Object.entries(activeData[activeCat] ?? {}).filter(([, data]) => {
      const entry = data[String(levelKey)];
      return entry != null && (entry.level ?? 0) > 0;
    })
    : [], [activeCat, activeData, levelKey]);

  // Flatten each building type into one card per copy, sorted so buildings with
  // fewer copies come first (higher count sinks lower in the list). Copies of the
  // same building are grouped together and ordered by level so higher-level
  // copies sink lower within the group.
  // Group buildings into collapsible sections. Buildings with more copies sink
  // lower in the list. Single-copy buildings are rendered directly.
  const buildingSections = useMemo(() => {
    type Section = {
      name: string;
      count: number;
      copies: BuildingCopies;
      effectiveMax: number;
      copyIndices: number[];
    };
    const sections: Section[] = [];
    const singles: Section[] = [];
    for (const [name, entry] of entries) {
      const lookupName = NAME_FIX[name] ?? name;
      const maxLvl = (entry as any)[String(levelKey)]?.level ?? 0;
      const effectiveMax = getSectionMaxLevel(name, maxLvl, isBB, th, bh);
      const count = isBB ? getCountAtBH(lookupName, bh) : getCountAtTH(lookupName, th);
      const copies = getBuildingCopies(
        lookupName,
        player?.buildingLevels,
        player?.buildings,
        effectiveMax,
        count,
        player?.lastMaxedTH,
        isBB ? undefined : th,
      );
      const copyIndices = copies.levels
        .map((_, i) => i)
        .sort((a, b) => (copies.levels[a] ?? 0) - (copies.levels[b] ?? 0));
      const section = { name, count, copies, effectiveMax, copyIndices };
      if (count > 1) {
        sections.push(section);
      } else {
        singles.push(section);
      }
    }
    const isSectionMaxed = (s: Section) =>
      s.copies.levels.length > 0 &&
      s.effectiveMax > 0 &&
      s.copies.levels.every((l) => l >= s.effectiveMax);
    sections.sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
    singles.sort((a, b) => a.name.localeCompare(b.name));
    const nonMaxed = [...singles.filter((s) => !isSectionMaxed(s)), ...sections.filter((s) => !isSectionMaxed(s))];
    const maxed = [...singles.filter(isSectionMaxed), ...sections.filter(isSectionMaxed)];
    return [...nonMaxed, ...maxed];
  }, [entries, isBB, levelKey, th, bh, player]);

  const maxOutAllBuildings = () => {
    const summary = SHOW_CATEGORIES.map((cat) => {
      const items = categories[cat] ?? {};
      const types = Object.entries(items).filter(([, thData]) => {
        const thEntry = thData[String(th)];
        return thEntry != null && (thEntry.level ?? 0) > 0;
      });
      return { cat, types };
    }).filter((s) => s.types.length > 0);
    const totalTypes = summary.reduce((s, g) => s + g.types.length, 0);

    showDialog({
      title: 'Max out all buildings?',
      message: (
        <View style={styles.dialogMessage}>
          <Text style={styles.dialogMessageText}>
            Sets every Home Village building to its max level for TH{th}. This cannot be undone.
          </Text>
          <View style={styles.dialogSummary}>
            {summary.map(({ cat, types }) => (
              <View key={cat} style={styles.dialogSummaryRow}>
                <Text style={styles.dialogSummaryCat}>{cat}</Text>
                <Text style={styles.dialogSummaryCount}>{types.length} types</Text>
              </View>
            ))}
            <View style={styles.dialogSummaryTotal}>
              <Text style={styles.dialogSummaryCat}>Total</Text>
              <Text style={styles.dialogSummaryCount}>{totalTypes} building types</Text>
            </View>
          </View>
        </View>
      ),
      actions: [
        { label: 'Cancel', onPress: () => { } },
        {
          label: 'Max Out',
          destructive: true,
          onPress: () => {
            for (const cat of SHOW_CATEGORIES) {
              const items = categories[cat] ?? {};
              for (const [name, thData] of Object.entries(items)) {
                const thEntry = thData[String(th)];
                if (thEntry == null || (thEntry.level ?? 0) <= 0) continue;
                const lookupName = NAME_FIX[name] ?? name;
                const effectiveMax = getBuildingEffectiveMax(lookupName, th);
                const count = getCountAtTH(lookupName, th);
                const copies = getBuildingCopies(
                  lookupName,
                  player?.buildingLevels,
                  player?.buildings,
                  effectiveMax,
                  count,
                  player?.lastMaxedTH,
                  th,
                );
                const next = copies.levels.map(() => effectiveMax);
                setBuildingCopies(lookupName, next, copies.maxLevel);
              }
            }
          },
        },
      ],
    });
  };

  const sheetSection = sheetName
    ? buildingSections.find((s) => s.name === sheetName) ?? null
    : null;

  const renderSheetHeader = (section: NonNullable<typeof sheetSection>) => {
    const lookupName = NAME_FIX[section.name] ?? section.name;
    const posLevels = section.copies.levels.filter((l) => l > 0);
    const minLevel = posLevels.length > 0 ? Math.min(...posLevels) : 1;
    const headerIcon = getBuildingLevelImageSource(lookupName, minLevel);
    const totalLevel = section.copies.levels.reduce((s, l) => s + l, 0);
    const totalMax = section.copies.levels.length * section.effectiveMax;
    return (
      <View style={{ flex: 1 }}>
        <ItemCard
          name={section.name}
          level={totalLevel}
          maxLevel={totalMax}
          iconSource={headerIcon}
          subtitle={`${isBB ? `BH${bh}` : `TH${th}`} · ${section.count} ${section.count > 1 ? 'copies' : 'copy'}`}
          actionIcon="close"
          actionColor={Colors.textPrimary}
          onActionPress={() => setSheetName(null)}
          actionAccessibilityLabel="Close"
          subtitleWithBar
          hideLevelBadge={totalMax > 0 && totalLevel >= totalMax}
        />
      </View>
    );
  };

  const renderSheetBody = (section: NonNullable<typeof sheetSection>) => {
    const isWalls = section.name === 'Walls' || section.name === 'BB Walls';
    if (section.count > 1) {
      return (
        <BuildingCollapsibleSection
          title={section.name}
          count={section.count}
          copies={section.copies}
          effectiveMax={section.effectiveMax}
          isBB={isBB}
          discounts={discounts.buildings}
          isFirst={false}
          isLast={false}
          groupByLevel={isWalls}
          inSheet
        >
          {!isWalls && section.copyIndices.map((copyIndex) => (
            <BuildingCard
              key={copyIndex}
              name={section.name}
              copyIndex={copyIndex}
              count={section.count}
              copies={section.copies}
              effectiveMax={section.effectiveMax}
              isBB={isBB}
              discounts={discounts.buildings}
              inSection
              inSheet
              isLast={copyIndex === section.copyIndices[section.copyIndices.length - 1]}
            />
          ))}
        </BuildingCollapsibleSection>
      );
    }
    return (
      <BuildingCard
        name={section.name}
        copyIndex={section.copyIndices[0] ?? 0}
        count={1}
        copies={section.copies}
        effectiveMax={section.effectiveMax}
        isBB={isBB}
        discounts={discounts.buildings}
        isFirst={false}
        isLast={false}
        showDescription
        inSheet
        hideHeader
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Buildings</Text>
            <View style={styles.headerActions}>
              <PressableRipple onPress={maxOutAllBuildings} hitSlop={8} style={styles.headerBtn}>
                <Ionicons name="rocket-outline" size={20} color={Colors.textSecondary} />
              </PressableRipple>
              <PressableRipple onPress={() => router.push(`/onboarding?mode=reset&th=${th}`)} hitSlop={8} style={styles.headerBtn}>
                <Ionicons name="flag-outline" size={20} color={Colors.textSecondary} />
              </PressableRipple>
            </View>
          </View>
          <Dialog />
          <Text style={styles.subtitle}>
            {isBB ? `Max levels for BH${bh} · Builder Base` : `Max levels for TH${th} · Tap to expand`}
          </Text>
        </View>

        {showBB && (
          <View style={styles.villageToggle}>
            <PressableRipple
              style={[
                styles.villageToggleItem,
                segCornerStyle(0, 2),
                !isBB && styles.villageToggleActive,
              ]}
              onPress={() => setVillage('home')}
            >
              {thHallImage ? (
                <Image source={thHallImage} style={styles.villageToggleImg} resizeMode="contain" />
              ) : (
                <Ionicons
                  name="home-outline"
                  size={13}
                  color={!isBB ? Colors.bg : Colors.textSecondary}
                />
              )}
              <Text style={[styles.villageToggleText, !isBB && styles.villageToggleTextActive]}>
                {`TH${th}`}
              </Text>
            </PressableRipple>
            <PressableRipple
              style={[
                styles.villageToggleItem,
                segCornerStyle(1, 2),
                isBB && styles.villageToggleActive,
              ]}
              onPress={() => setVillage('builder')}
            >
              {bhHallImage ? (
                <Image source={bhHallImage} style={styles.villageToggleImg} resizeMode="contain" />
              ) : (
                <Ionicons
                  name="hammer-outline"
                  size={13}
                  color={isBB ? Colors.bg : Colors.textSecondary}
                />
              )}
              <Text style={[styles.villageToggleText, isBB && styles.villageToggleTextActive]}>
                {`BH${bh}`}
              </Text>
            </PressableRipple>
          </View>
        )}

        <View style={styles.pillRow}>
          {pillRows.map((row) => (
            <View key={row[0]} style={styles.pillLine}>
              {row.map((cat) => {
                const isActive = cat === activeCat;
                const meta = catMeta[cat];
                return (
                  <PressableRipple
                    key={cat}
                    style={[
                      styles.pill,
                      pillCornerStyle(availableCats.indexOf(cat), availableCats.length),
                      isActive && styles.pillActive,
                    ]}
                    onPress={() => setSelectedCat(cat)}
                  >
                    {meta?.image != null ? (
                      <Image source={meta.image} style={styles.pillImg} resizeMode="contain" />
                    ) : (
                      <CategoryIcon cat={cat} isActive={isActive} />
                    )}
                    <View style={styles.pillTextCol}>
                      <Text
                        style={[styles.pillText, isActive && styles.pillTextActive]}
                        numberOfLines={1}
                      >
                        {cat}
                      </Text>
                      <Text
                        style={[styles.pillSubText, isActive && styles.pillSubTextActive]}
                        numberOfLines={1}
                      >
                        {`${meta?.types ?? 0} types · ${meta?.maxed ?? 0} maxed`}
                      </Text>
                    </View>
                  </PressableRipple>
                );
              })}
            </View>
          ))}
        </View>

        {buildingSections.map((section, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === buildingSections.length - 1;
          const isWalls = section.name === 'Walls' || section.name === 'BB Walls';
          if (section.count > 1) {
            return (
              <BuildingCollapsibleSection
                key={section.name}
                title={section.name}
                count={section.count}
                copies={section.copies}
                effectiveMax={section.effectiveMax}
                isBB={isBB}
                discounts={discounts.buildings}
                isFirst={isFirst}
                isLast={isLast}
                groupByLevel={isWalls}
                onOpen={() => setSheetName(section.name)}
              >
                {!isWalls && section.copyIndices.map((copyIndex) => (
                  <BuildingCard
                    key={copyIndex}
                    name={section.name}
                    copyIndex={copyIndex}
                    count={section.count}
                    copies={section.copies}
                    effectiveMax={section.effectiveMax}
                    isBB={isBB}
                    discounts={discounts.buildings}
                    inSection
                    isLast={copyIndex === section.copyIndices[section.copyIndices.length - 1]}
                  />
                ))}
              </BuildingCollapsibleSection>
            );
          }
          return (
            <BuildingCard
              key={section.name}
              name={section.name}
              copyIndex={section.copyIndices[0] ?? 0}
              count={1}
              copies={section.copies}
              effectiveMax={section.effectiveMax}
              isBB={isBB}
              discounts={discounts.buildings}
              isFirst={isFirst}
              isLast={isLast}
              showDescription
              onOpen={() => setSheetName(section.name)}
            />
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomSheet
        visible={sheetName !== null}
        onClose={() => setSheetName(null)}
        header={sheetSection ? renderSheetHeader(sheetSection) : undefined}
      >
        {sheetSection ? renderSheetBody(sheetSection) : null}
      </BottomSheet>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
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
  dialogMessage: {
    gap: Spacing.md,
  },
  dialogMessageText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  dialogSummary: {
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  dialogSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  dialogSummaryTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgSubtle,
  },
  dialogSummaryCat: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dialogSummaryCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  pillRow: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pillLine: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  pill: {
    // flex: 1 rather than a hardcoded percentage width, so a pair of pills shares
    // the row exactly (gap-only spacing) and a lone trailing pill fills the row.
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  pillImg: {
    width: 18,
    height: 18,
  },
  pillTextCol: {
    flex: 1,
    minWidth: 0,
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.bg,
  },
  pillSubText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  pillSubTextActive: {
    color: Colors.bg,
    opacity: 0.7,
  },
  villageToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 4,
    marginTop: Spacing.sm,
    padding: 3,
    borderRadius: Radius.xl * 1.25,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  villageToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  villageToggleImg: {
    width: 16,
    height: 16,
  },
  villageToggleActive: {
    backgroundColor: Colors.textPrimary,
  },
  villageToggleText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  villageToggleTextActive: {
    color: Colors.bg,
  },
  itemCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
  },
  itemCardInSheet: {
    marginHorizontal: 0,
    paddingLeft: 0,
    backgroundColor: Colors.bgCard,
  },
  itemCardInSection: {
    marginHorizontal: 0,
  },
  itemCardBodyOnly: {
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 6,
  },
  presetBtn: {
    paddingHorizontal: 8,
    height: 24,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnDisabled: {
    opacity: 0.4,
  },
  presetBtnText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  buildingDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  remainingTable: {
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  remainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  remainingHead: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  remainingTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  remainingTotalCell: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '700',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    textAlign: 'center',
    fontSize: 11,
  },
  resourceSumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 1,
  },
  resourceSumIcon: {
    width: 14,
    height: 14,
  },
  resourceSumDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  upgradeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  upgradeBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  downgradeBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    opacity: 0.85,
  },
  maxBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    opacity: 0.85,
  },
  buildingSectionQuickBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingSectionBody: {
    paddingTop: 0,
  },
  buildingSectionDescText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  buildingSectionRemainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  buildingSectionRemaining: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  sectionRemainingHead: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    paddingVertical: 2,
    paddingHorizontal: 5,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  sectionRemainingTotalCell: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '700',
    paddingVertical: 2,
    paddingHorizontal: 5,
    textAlign: 'center',
    fontSize: 10,
  },
  buildingSectionQuickBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  buildingSectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    margin: Spacing.lg,
  },
  levelGridBorder: {
    borderRadius: Radius.sm,
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  levelGridCell: {
    width: '19.99%',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  levelGridDowngrade: {
    width: 48,
    height: 44,
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
    opacity: 0.85,
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
  levelGridEllipsisWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  levelGridEllipsisText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '700',
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
  levelGridBadgeCurrent: {
    backgroundColor: Colors.textPrimary,
  },
  buildingStatsTable: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
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
  buildingStatCostCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  buildingStatCostIcon: {
    width: 14,
    height: 14,
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
  expandedSection: {
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  expandedSectionBodyOnly: {
    borderTopWidth: 0,
  },
  expandTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  expandTableText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});