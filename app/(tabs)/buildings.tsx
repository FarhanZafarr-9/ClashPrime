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
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import {
  getBuildingLevelImageSource,
  getBuildingAvailableLevels,
  getBuildingData,
  getBuildingEffectiveMax,
  parseCost,
  parseTimeToSeconds,
  formatCost as fmtCost,
  formatTime as fmtTime,
} from '../../src/utils/buildingImages';
import { getBuildingCopies, getCountAtTH, getCountAtBH } from '../../src/utils/buildingCopies';
import type { BuildingCopies } from '../../src/utils/buildingCopies';
import buildingLevelsData from '../../src/data/building-levels.json';
import thLevelsData from '../../src/data/th-levels.json';

import { useDiscounts } from '../../src/hooks/useDiscounts';
import type { ScopeDiscount } from '../../src/hooks/useDiscounts';
import { applyCostDiscount, applyTimeDiscount } from '../../src/utils/discountUtils';

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

// Fandom wiki page slugs for Builder Base buildings.
// Used to construct detail-page URLs for stat scraping.
const BB_FANDOM_URLS: Record<string, string> = {
  'BB Cannon': 'https://clashofclans.fandom.com/wiki/Cannon/Builder_Base',
  'Double Cannon': 'https://clashofclans.fandom.com/wiki/Double_Cannon',
  'BB Archer Tower': 'https://clashofclans.fandom.com/wiki/Archer_Tower/Builder_Base',
  'BB Hidden Tesla': 'https://clashofclans.fandom.com/wiki/Hidden_Tesla/Builder_Base',
  'BB Air Bombs': 'https://clashofclans.fandom.com/wiki/Firecrackers',
  'Crusher': 'https://clashofclans.fandom.com/wiki/Crusher/Builder_Base',
  'Guard Post': 'https://clashofclans.fandom.com/wiki/Guard_Post',
  'Multi Mortar': 'https://clashofclans.fandom.com/wiki/Multi_Mortar/Builder_Base',
  "O.T.T.O's Outpost": "https://clashofclans.fandom.com/wiki/O.T.T.O's_Outpost",
  'BB Roaster': 'https://clashofclans.fandom.com/wiki/Roaster/Builder_Base',
  'Giant Cannon': 'https://clashofclans.fandom.com/wiki/Giant_Cannon/Builder_Base',
  'Mega Tesla': 'https://clashofclans.fandom.com/wiki/Mega_Tesla',
  'BB Lava Launcher': 'https://clashofclans.fandom.com/wiki/Lava_Launcher/Builder_Base',
  'BB X-Bow': 'https://clashofclans.fandom.com/wiki/X-Bow/Builder_Base',
  'BB Walls': 'https://clashofclans.fandom.com/wiki/Walls/Builder_Base',
  'BB Spring Trap': 'https://clashofclans.fandom.com/wiki/Spring_Trap/Builder_Base',
  'Mine': 'https://clashofclans.fandom.com/wiki/Mine/Builder_Base',
  'Mega Mine': 'https://clashofclans.fandom.com/wiki/Mega_Mine/Builder_Base',
  'Push Trap': 'https://clashofclans.fandom.com/wiki/Push_Trap',
  'Builder Hall': 'https://clashofclans.fandom.com/wiki/Builder_Hall',
  'BB Gold Mine': 'https://clashofclans.fandom.com/wiki/Gold_Mine/Builder_Base',
  'BB Elixir Collector': 'https://clashofclans.fandom.com/wiki/Elixir_Collector/Builder_Base',
  'BB Gold Storage': 'https://clashofclans.fandom.com/wiki/Gold_Storage/Builder_Base',
  'BB Elixir Storage': 'https://clashofclans.fandom.com/wiki/Elixir_Storage/Builder_Base',
  'Gem Mine': 'https://clashofclans.fandom.com/wiki/Gem_Mine',
  'B.O.B Control': 'https://clashofclans.fandom.com/wiki/B.O.B_Control',
  'Builder Barracks': 'https://clashofclans.fandom.com/wiki/Builder_Barracks',
  'BB Army Camp': 'https://clashofclans.fandom.com/wiki/Army_Camp/Builder_Base',
  'Star Laboratory': 'https://clashofclans.fandom.com/wiki/Star_Laboratory',
  'Battle Machine Altar': 'https://clashofclans.fandom.com/wiki/Battle_Machine_Altar',
  'Reinforcement Camp': 'https://clashofclans.fandom.com/wiki/Reinforcement_Camp',
  'Healing Hut': 'https://clashofclans.fandom.com/wiki/Healing_Hut',
  'Battle Copter Altar': 'https://clashofclans.fandom.com/wiki/Battle_Copter_Altar',
  'Clock Tower': 'https://clashofclans.fandom.com/wiki/Clock_Tower',
  "B.O.T.O's Shack": "https://clashofclans.fandom.com/wiki/B.O.T.O's_Shack",
  'Elixir Cart': 'https://clashofclans.fandom.com/wiki/Elixir_Cart',
};

// Per-BH max-level data for BB buildings missing from building-levels.json.
// Maps building name → { BH level → max levels available at that BH }.
const BB_LEVEL_SUPPLEMENT: Record<string, Record<number, number>> = {
  'BB Cannon':     { 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  'Double Cannon': { 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  'Guard Post':    { 6: 1, 7: 2, 8: 3, 9: 4, 10: 5 },
  "O.T.T.O's Outpost": { 10: 3 },
  'Mega Tesla':    { 9: 1, 10: 3 },
  'Push Trap':     { 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  'Builder Hall':  { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
  'Gem Mine':      { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 7, 10: 9 },
  'B.O.B Control': { 9: 1, 10: 2 },
  'Builder Barracks':  { 2: 2, 3: 4, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 12 },
  'Star Laboratory':   { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7 },
  'Battle Machine Altar':  { 5: 1, 6: 5, 7: 10, 8: 15, 9: 20, 10: 25 },
  'Reinforcement Camp':  { 8: 1, 9: 2, 10: 3 },
  'Healing Hut':         { 8: 1, 9: 2, 10: 3 },
  'Battle Copter Altar': { 9: 1, 10: 10 },
  'Clock Tower':    { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7 },
  "B.O.T.O's Shack": { 10: 1 },
  'Elixir Cart': { 1: 1 },
};

function buildBBCategories(builderHallLevel: number): Record<string, { level: number | null; isMaxLevel: boolean }> {
  const entries: Record<string, { level: number | null; isMaxLevel: boolean }> = {};

  // 1. Read existing JSON data for buildings with full stats.
  const bbBuildings = (buildingLevelsData as any[]).filter((b: any) => b.village === 'builderBase');
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

  // 2. Fill gaps from the supplement for buildings not already covered.
  for (const [name, bhs] of Object.entries(BB_LEVEL_SUPPLEMENT)) {
    if (entries[name]) continue;
    const sortedBHs = Object.keys(bhs).map(Number).sort((a, b) => a - b);
    const maxBH = sortedBHs[sortedBHs.length - 1];
    let level = 0;
    for (const bh of sortedBHs) {
      if (bh <= builderHallLevel) level = bhs[bh];
    }
    entries[name] = { level, isMaxLevel: builderHallLevel >= maxBH };
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

function BuildingCard({ name, copyIndex, count, copies, effectiveMax, isBB, discounts, isFirst, isLast, showDescription, inSection }: {
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
}) {
  const { setBuildingCopies } = usePlayer();
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

  const currentLevel = copies.levels[copyIndex] ?? 0;
  const progress = effectiveMax > 0 ? currentLevel / effectiveMax : 0;
  const isFullyMaxed = currentLevel >= effectiveMax;
  const isLocked = currentLevel === 0;

  const mainImgSource = getBuildingLevelImageSource(lookupName, Math.max(currentLevel, 1));

  const availableLevels = getBuildingAvailableLevels(lookupName);
  // Only show levels the player can actually reach at their TH/BH — no stats
  // rows or level images for unreachable future levels.
  const allLevels = (buildingStats?.levels ?? availableLevels.map((l) => ({ Level: l })))
    .filter((l: any) => effectiveMax <= 0 || l.Level <= effectiveMax);
  const showExpand = allLevels.length > 3;

  let displayLevels: any[];
  if (!expanded) {
    displayLevels = [];
  } else if (showFull || !showExpand) {
    displayLevels = allLevels;
  } else {
    const currentIdx = allLevels.findIndex((l: any) => l.Level === currentLevel);
    const start = Math.max(0, currentIdx - 1);
    const end = Math.min(allLevels.length, currentIdx + 2);
    displayLevels = allLevels.slice(start, end);
  }

  const statCols = buildingStats ? buildingStats.statsColumns.filter((c: string) => c !== 'Level') : [];
  const showDiscounted = (discounts.costPercent > 0 || discounts.timePercent > 0) && (statCols.includes('Build Cost') || statCols.includes('Build Time'));
  const contentMinW = 46 + statCols.reduce((sum: number, c: string) => sum + (COL_WIDTH[c] || DEFAULT_COL_WIDTH), 0);

  const remainingLevels = allLevels.filter((l: any) => l.Level > currentLevel && l.Level <= effectiveMax);
  let totalCost = 0;
  let totalTime = 0;
  for (const lvl of remainingLevels) {
    if (lvl['Build Cost']) totalCost += parseCost(String(lvl['Build Cost']));
    if (lvl['Build Time']) totalTime += parseTimeToSeconds(String(lvl['Build Time']));
  }
  const hasRemaining = remainingLevels.length > 0 && totalCost > 0;

  const setCopyLevel = (level: number) => {
    const next = [...copies.levels];
    next[copyIndex] = level;
    setBuildingCopies(lookupName, next, copies.maxLevel);
  };

  const renderGrid = () => (
    <View style={styles.levelGridBorder}>
      <View style={styles.levelGrid}>
      {displayLevels.map((levelData: any) => {
        const lvl = levelData.Level;
        const cellSource = getBuildingLevelImageSource(lookupName, lvl);
        const isCurrent = lvl === currentLevel;
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
              <View style={[styles.levelGridBadge, isCurrent && styles.levelGridBadgeCurrent]}>
                <Text style={[styles.levelGridBadgeText]}>
                  {lvl}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
      </View>
    </View>
  );

  const toggleExpanded = () => {
    if (inSection) return;
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
      isFirst && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
      isLast && !expanded && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
    ]}>
      <View style={styles.itemRow}>
        <PressableRipple onPress={toggleExpanded} style={styles.itemCardTouchable}>
          <View style={styles.itemRowInner}>
            {mainImgSource ? (
              <Image source={mainImgSource} style={[styles.itemIcon, isFirst && { borderTopLeftRadius: Radius.lg }, isLast && !expanded && { borderBottomLeftRadius: Radius.lg }]} resizeMode="contain" />
            ) : (
              <View style={[styles.itemIcon, isFirst && { borderTopLeftRadius: Radius.lg }, isLast && !expanded && { borderBottomLeftRadius: Radius.lg }]}>
                <Text style={styles.itemIconText}>
                  {name.split(/[\s.]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.itemInfo}>
              <View style={styles.itemNameRow}>
                <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
                {count > 1 && (
                  <View style={styles.copyCountChip}>
                    <Text style={styles.copyCountChipText}>({copyIndex + 1})</Text>
                  </View>
                )}
              </View>
              {isLocked ? (
                <Text style={styles.lockedText}>Locked</Text>
              ) : inSection ? (
                <View style={styles.itemProgressRow}>
                  <View style={[styles.progressTrack, styles.progressTrackFlex]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(progress, 1) * 100}%`,
                          backgroundColor: isFullyMaxed ? Colors.warning : Colors.textSecondary,
                        },
                      ]}
                    />
                  </View>
                  {hasRemaining && (
                    <Text style={styles.itemProgressMeta} numberOfLines={1}>
                      {showDiscounted ? applyCostDiscount(fmtCost(totalCost), discounts) : fmtCost(totalCost)}
                      {' · '}
                      {showDiscounted ? applyTimeDiscount(fmtTime(totalTime), discounts) : fmtTime(totalTime)}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(progress, 1) * 100}%`,
                        backgroundColor: isFullyMaxed ? Colors.warning : Colors.textSecondary,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          </View>
        </PressableRipple>
        <View style={styles.right}>
          {isLocked ? (
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedBadgeText}>Locked</Text>
            </View>
          ) : (
              <View style={styles.rightBtns}>
                <View style={[
                  styles.levelBadgeContainer,
                  isFullyMaxed && styles.levelBadgeMaxed,
                ]}>
                  <Text style={[styles.levelBadgeText, isFullyMaxed && styles.levelBadgeTextMaxed]}>
                    {currentLevel}
                  </Text>
                  <Text style={[styles.levelBadgeLabel, isFullyMaxed && styles.levelBadgeTextMaxed]}>
                    / {effectiveMax}
                  </Text>
                </View>
                {count > 1 && (
                  <View style={styles.quickBtnRow}>
                    <PressableRipple
                      onPress={() => setCopyLevel(Math.min(currentLevel + 1, effectiveMax))}
                      onLongPress={() => setCopyLevel(effectiveMax)}
                      disabled={isFullyMaxed}
                      style={[styles.quickBtn, isFullyMaxed && styles.quickBtnDisabled]}
                      hitSlop={4}
                      accessibilityLabel={`Upgrade ${name} copy ${copyIndex + 1}`}
                      accessibilityRole="button"
                    >
                      <Ionicons name="chevron-up" size={14} color={isFullyMaxed ? Colors.textTertiary : Colors.textPrimary} />
                    </PressableRipple>
                    <PressableRipple
                      onPress={() => setCopyLevel(Math.max(currentLevel - 1, 1))}
                      disabled={currentLevel <= 1}
                      style={[styles.quickBtn, currentLevel <= 1 && styles.quickBtnDisabled]}
                      hitSlop={4}
                      accessibilityLabel={`Downgrade ${name} copy ${copyIndex + 1}`}
                      accessibilityRole="button"
                    >
                      <Ionicons name="chevron-down" size={14} color={currentLevel <= 1 ? Colors.textTertiary : Colors.textPrimary} />
                    </PressableRipple>
                  </View>
                )}
              </View>
          )}
        </View>
      </View>

      {isLocked && effectiveMax > 0 && !inSection && (
        <View style={styles.expandedSection}>
          <Text style={styles.buildingDesc} numberOfLines={3}>This building is available at your Town Hall level. Tap to unlock it.</Text>
          <PressableRipple style={styles.upgradeBtn} onPress={() => setCopyLevel(1)}>
            <Text style={styles.upgradeBtnText}>Unlock {name}</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.bg} />
          </PressableRipple>
        </View>
      )}

      {!isLocked && !inSection && expanded && displayLevels.length > 0 && (
        <View style={styles.expandedSection}>
          {showDescription && buildingStats?.description ? (
            <Text style={styles.buildingDesc} numberOfLines={3}>{buildingStats.description}</Text>
          ) : null}
          {renderGrid()}
          {hasRemaining && (
            <>
              <View style={styles.remainingTable}>
                <View style={styles.remainingRow}>
                  <Text style={[styles.remainingHead, { flex: 1 }]}>Remaining</Text>
                  <Text style={[styles.remainingHead, { flex: 1 }]}>Cost</Text>
                  <Text style={[styles.remainingHead, { flex: 1 }]}>Time</Text>
                </View>
                <View style={styles.remainingTotalRow}>
                  <Text style={[styles.remainingTotalCell, { flex: 1 }]}>{remainingLevels.length} levels</Text>
                  <Text style={[styles.remainingTotalCell, { flex: 1 }]}>
                    {showDiscounted ? applyCostDiscount(fmtCost(totalCost), discounts) : fmtCost(totalCost)}
                  </Text>
                  <Text style={[styles.remainingTotalCell, { flex: 1 }]}>
                    {showDiscounted ? applyTimeDiscount(fmtTime(totalTime), discounts) : fmtTime(totalTime)}
                  </Text>
                </View>
              </View>
            </>
          )}
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
                  const isCurrentLevel = lvl === currentLevel;
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
            <PressableRipple style={styles.expandTableBtn} onPress={() => setShowFull(true)}>
              <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
              <Text style={styles.expandTableText}>Show all {allLevels.length} levels</Text>
            </PressableRipple>
          )}
          {showExpand && showFull && (
            <PressableRipple style={styles.expandTableBtn} onPress={() => setShowFull(false)}>
              <Ionicons name="chevron-up" size={14} color={Colors.textSecondary} />
              <Text style={styles.expandTableText}>Show fewer</Text>
            </PressableRipple>
          )}
          {hasRemaining && (
            <View style={styles.upgradeRow}>
              <PressableRipple
                style={styles.upgradeBtn}
                onPress={() => setCopyLevel(currentLevel + 1)}
              >
                <Text style={styles.upgradeBtnText}>Upgrade to Lv{currentLevel + 1}</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.bg} />
              </PressableRipple>
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
  max,
  onUpgrade,
}: {
  value: number;
  max: number;
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
  compact,
  groupByLevel,
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
  compact?: boolean;
  groupByLevel?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [showAllLevels, setShowAllLevels] = useState(false);
  const [tableViewportW, setTableViewportW] = useState(0);
  const { setBuildingCopies } = usePlayer();
  const totalLevel = copies.levels.reduce((s, l) => s + l, 0);
  const totalMax = copies.levels.length * effectiveMax;
  const isSectionMaxed = totalMax > 0 && totalLevel >= totalMax;
  const toggle = () => {
    if (!open) onOpen?.();
    setOpen(!open);
  };
  const lookupName = NAME_FIX[title] ?? title;
  const maxAllCopies = () => {
    const next = copies.levels.map(() => effectiveMax);
    setBuildingCopies(lookupName, next, copies.maxLevel);
  };

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
        const groupProgress = effectiveMax > 0 ? g.level / effectiveMax : 0;
        const isMaxed = g.level >= effectiveMax;
        return (
          <View
            key={g.level}
            style={[
              styles.itemCard,
              isLastGroup && { borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg },
            ]}
          >
            <View style={styles.itemRow}>
              <View style={styles.itemCardTouchable}>
                <View style={styles.itemRowInner}>
                  {imgSource ? (
                    <Image source={imgSource} style={[styles.itemIcon, isLastGroup && { borderBottomLeftRadius: Radius.lg }]} resizeMode="contain" />
                  ) : (
                    <View style={[styles.itemIcon, isLastGroup && { borderBottomLeftRadius: Radius.lg }]}>
                      <Text style={styles.itemIconText}>
                        {title.split(/[\s.]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <View style={styles.itemNameRow}>
                      <Text style={styles.itemName} numberOfLines={1}>{title}</Text>
                      <View style={styles.copyCountChip}>
                        <Text style={styles.copyCountChipText}>×{g.numCopies}</Text>
                      </View>
                    </View>
                    <View style={styles.itemProgressRow}>
                      <View style={[styles.progressTrack, styles.progressTrackFlex]}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(groupProgress, 1) * 100}%`,
                              backgroundColor: isMaxed ? Colors.warning : Colors.textSecondary,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <LevelGroupPresets
                      value={g.numCopies}
                      max={copies.levels.length}
                      onUpgrade={(n) => upgradeLevelCopies(g.level, n)}
                    />
                  </View>
                  <View style={styles.levelBadgeContainer}>
                    <Text style={styles.levelBadgeText}>{g.level}</Text>
                    <Text style={styles.levelBadgeLabel}>/ {effectiveMax}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
  const availableCopyLevels = copies.levels.filter((l) => l > 0);
  const icon = getBuildingLevelImageSource(lookupName, availableCopyLevels.length > 0 ? Math.min(...availableCopyLevels) : 1);

  const buildingStats = useMemo(() => {
    const lookupName = NAME_FIX[title] ?? title;
    const match = (buildingLevelsData as any).find((b: any) => {
      const bName = b.name.toLowerCase();
      return bName === title.toLowerCase() || bName === lookupName.toLowerCase();
    });
    return match || null;
  }, [title]);

  const statCols = buildingStats ? buildingStats.statsColumns.filter((c: string) => c !== 'Level') : [];
  const showDiscounted = (discounts.costPercent > 0 || discounts.timePercent > 0) && (statCols.includes('Build Cost') || statCols.includes('Build Time'));

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
    const lookupName = NAME_FIX[title] ?? title;
    const availableLevels = getBuildingAvailableLevels(lookupName);
    const allLevels = (buildingStats?.levels ?? availableLevels.map((l) => ({ Level: l })))
      .filter((l: any) => effectiveMax <= 0 || l.Level <= effectiveMax);
    for (const lvl of copies.levels) {
      if (lvl <= 0) continue;
      const rem = allLevels.filter((l: any) => l.Level > lvl && l.Level <= effectiveMax);
      remainingLevels += rem.length;
      for (const l of rem) {
        if (l['Build Cost']) totalCost += parseCost(String(l['Build Cost']));
        if (l['Build Time']) totalTime += parseTimeToSeconds(String(l['Build Time']));
      }
    }
    return { remainingLevels, totalCost, totalTime };
  }, [title, copies, effectiveMax, buildingStats]);

  const hasRemaining = aggregate.remainingLevels > 0 && aggregate.totalCost > 0;

  // Merged level grid + stats table across every copy. Concise state shows a
  // span from just below the lowest copy level up to 2 levels ahead of the
  // highest (clamped to effectiveMax); "show all" expands to the full range.
  const availableLevels = getBuildingAvailableLevels(lookupName);
  const allLevels = (buildingStats?.levels ?? availableLevels.map((l) => ({ Level: l })))
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
  const contentMinW = 46 + statCols.reduce((sum: number, c: string) => sum + (COL_WIDTH[c] || DEFAULT_COL_WIDTH), 0);

  return (
    <>
      <PressableRipple
        onPress={toggle}
        style={[
          styles.buildingSectionHeader,
          compact && styles.buildingSectionHeaderCompact,
          (isFirst || open) && styles.buildingSectionHeaderFirst,
          isLast && !open && styles.buildingSectionHeaderLast,
        ]}
      >
        <View style={[
          styles.buildingSectionIcon,
          (isFirst || open) && styles.buildingSectionIconTopLeftRounded,
          isLast && !open && styles.buildingSectionIconBottomLeftRounded,
        ]}>
          {icon ? (
            <Image source={icon} style={styles.buildingSectionIconImg} resizeMode="contain" />
          ) : (
            <Text style={styles.buildingSectionIconText}>
              {title.split(/[\s.]+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.buildingSectionText}>
          <Text style={styles.buildingSectionTitle}>{title}</Text>
          <View style={styles.buildingSectionDesc}>
            <View style={styles.buildingSectionBar}>
              <View
                style={[
                  styles.buildingSectionFill,
                  {
                    width: `${Math.min(totalMax > 0 ? totalLevel / totalMax : 0, 1) * 100}%`,
                    backgroundColor: isSectionMaxed ? Colors.warning : Colors.textPrimary,
                  },
                ]}
              />
            </View>
          </View>
        </View>
        <View style={styles.buildingSectionBadges}>
          <View style={styles.buildingSectionBadge}>
            <Text style={styles.buildingSectionBadgeText}>{count}</Text>
          </View>
          <View style={[
            styles.buildingSectionBadge,
            (isFirst || open) && styles.buildingSectionBadgeTopRightRounded,
            isLast && !open && styles.buildingSectionBadgeBottomRightRounded,
            isSectionMaxed && styles.buildingSectionBadgeMaxed,
          ]}>
            <Text style={[styles.buildingSectionBadgeText, isSectionMaxed && styles.buildingSectionBadgeTextMaxed]}>{fmtLevels(totalLevel)}</Text>
            <Text style={[styles.buildingSectionBadgeLabel, isSectionMaxed && styles.buildingSectionBadgeTextMaxed]}>/ {fmtLevels(totalMax)}</Text>
          </View>
        </View>
      </PressableRipple>
      {open && (
        <View style={styles.buildingSectionBody}>
          {buildingStats?.description ? (
            <Text style={styles.buildingSectionDescText} numberOfLines={3}>{buildingStats.description}</Text>
          ) : null}
          {hasRemaining && (
            <View style={styles.buildingSectionRemainingRow}>
              <View style={styles.buildingSectionRemaining}>
                <View style={styles.remainingRow}>
                  <Text style={[styles.remainingHead, { flex: 1 }]}>Remaining</Text>
                  <Text style={[styles.remainingHead, { flex: 1 }]}>Cost</Text>
                  <Text style={[styles.remainingHead, { flex: 1 }]}>Time</Text>
                </View>
                <View style={styles.remainingTotalRow}>
                  <Text style={[styles.remainingTotalCell, { flex: 1 }]}>{fmtLevels(aggregate.remainingLevels)} levels</Text>
                  <Text style={[styles.remainingTotalCell, { flex: 1 }]}>
                    {showDiscounted ? applyCostDiscount(fmtCost(aggregate.totalCost), discounts) : fmtCost(aggregate.totalCost)}
                  </Text>
                  <Text style={[styles.remainingTotalCell, { flex: 1 }]}>
                    {showDiscounted ? applyTimeDiscount(fmtTime(aggregate.totalTime), discounts) : fmtTime(aggregate.totalTime)}
                  </Text>
                </View>
              </View>
              {!isSectionMaxed && (
                <PressableRipple
                  onPress={maxAllCopies}
                  style={styles.buildingSectionMaxAllBtn}
                  hitSlop={4}
                  accessibilityLabel={`Max all ${title} copies`}
                  accessibilityRole="button"
                >
                  <Ionicons name="arrow-up-circle" size={20} color={Colors.textSecondary} />
                </PressableRipple>
              )}
            </View>
          )}
          {mergedDisplayLevels.length > 0 && (
            <View style={styles.buildingSectionMerged}>
              <View style={styles.levelGridBorder}>
                <View style={styles.levelGrid}>
                  {mergedDisplayLevels.map((levelData: any) => {
                    const lvl = levelData.Level;
                    const cellSource = getBuildingLevelImageSource(lookupName, lvl);
                    const isCurrent = copies.levels.includes(lvl);
                    return (
                      <View key={lvl} style={[styles.levelGridCell, isCurrent && styles.levelGridCellCurrent]}>
                        <View style={styles.levelGridImgWrap}>
                          {cellSource ? (
                            <Image source={cellSource} style={styles.levelGridImg} resizeMode="contain" />
                          ) : (
                            <View style={[styles.levelGridImg, styles.levelGridImgFallback]}>
                              <Text style={styles.levelGridFallbackText}>
                                {title.split(/[\s.]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <View style={[styles.levelGridBadge, isCurrent && styles.levelGridBadgeCurrent]}>
                            <Text style={styles.levelGridBadgeText}>{lvl}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
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
                    {mergedDisplayLevels.map((levelData: any) => {
                      const lvl = levelData.Level;
                      const isCurrent = copies.levels.includes(lvl);
                      return (
                        <View key={lvl} style={[styles.buildingStatRow, isCurrent && styles.buildingStatRowCurrent]}>
                          <View style={styles.buildingStatCellIcon}>
                            <Text style={[styles.buildingStatLvlNum, isCurrent && styles.buildingStatLvlNumCurrent]}>{lvl}</Text>
                          </View>
                          {statCols.map((col: string) => {
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
              {showLevelSpan && (
                <PressableRipple style={styles.expandTableBtn} onPress={() => setShowAllLevels(!showAllLevels)}>
                  <Ionicons name={showAllLevels ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textSecondary} />
                  <Text style={styles.expandTableText}>
                    {showAllLevels ? 'Show fewer' : `Show all ${allLevels.length} levels`}
                  </Text>
                </PressableRipple>
              )}
            </View>
          )}
          {groupByLevel
            ? buildLevelGroups()
            : children}
          {!isLast && <View style={styles.buildingSectionSeparator} />}
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

function formatCostShort(cost: number): string {
  if (cost >= 100000000) return (cost / 1000000).toFixed(0) + 'M';
  if (cost >= 1000000) return (cost / 1000000).toFixed(cost % 1000000 === 0 ? 0 : 1).replace('.0', '') + 'M';
  if (cost >= 1000) return (cost / 1000).toFixed(cost % 1000 === 0 ? 0 : 1).replace('.0', '') + 'K';
  return String(cost);
}

export default function BuildingsScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const { discounts } = useDiscounts();
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
      const maxLvl = isBB ? (entry as any).level ?? 0 : (entry as any)[String(th)]?.level ?? 0;
      const effectiveMax = isBB && maxLvl > 0
        ? maxLvl
        : getBuildingEffectiveMax(lookupName, th);
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
    sections.sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
    singles.sort((a, b) => a.name.localeCompare(b.name));
    return [...singles, ...sections];
  }, [entries, isBB, th, bh, player]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Buildings</Text>
            <View style={styles.headerActions}>
              <PressableRipple onPress={() => router.push(`/onboarding?mode=reset&th=${th}`)} hitSlop={8} style={styles.headerBtn}>
                <Ionicons name="refresh-outline" size={22} color={Colors.textSecondary} />
              </PressableRipple>
            </View>
          </View>
          <Text style={styles.subtitle}>
            {isBB ? `Max levels for BH${bh} · Builder Base` : `Max levels for TH${th} · Tap to expand`}
          </Text>
        </View>

        <View style={styles.pillRow}>
          {availableCats.map((cat) => {
            const isActive = cat === activeCat;
            return (
              <PressableRipple
                key={cat}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setSelectedCat(cat)}
              >
                <CategoryIcon cat={cat} isActive={isActive} />
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{cat}</Text>
              </PressableRipple>
            );
          })}
        </View>

        {buildingSections.map((section, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === buildingSections.length - 1;
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
                compact
                groupByLevel={section.name === 'Walls'}
              >
                {section.name !== 'Walls' && section.copyIndices.map((copyIndex) => (
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
    borderRadius: Radius.sm,
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
    marginBottom: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
  },
  itemCardTouchable: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.md,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
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
    justifyContent: 'space-between',
  },
  itemName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  copyCountChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  copyCountChipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 10,
  },
  levelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressTrackFlex: {
    flex: 1,
  },
  itemProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemProgressMeta: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingRight: Spacing.sm,
  },
  quickBtnRow: {
    flexDirection: 'row',
    gap: 4,
  },
  quickBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnDisabled: {
    opacity: 0.4,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 6,
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
  levelBadgeContainer: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeMaxed: {
    backgroundColor: Colors.warning,
  },
  levelBadgeText: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  levelBadgeLabel: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontSize: 8,
    opacity: 0.7,
    lineHeight: 9,
  },
  levelBadgeTextMaxed: {
    color: Colors.bg,
  },
  lockedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  lockedBadgeText: {
    ...Typography.footnote,
    color: Colors.textMuted,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockedText: {
    ...Typography.footnote,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  buildingDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xs,
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
  },
  remainingCell: {
    ...Typography.caption,
    color: Colors.textSecondary,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    textAlign: 'center',
    fontSize: 11,
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
  buildingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
  },
  buildingSectionHeaderFirst: {
    borderTopLeftRadius: Radius.xl * 1.25,
    borderTopRightRadius: Radius.xl * 1.25,
  },
  buildingSectionHeaderCompact: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  buildingSectionHeaderLast: {
    borderBottomLeftRadius: Radius.xl * 1.25,
    borderBottomRightRadius: Radius.xl * 1.25,
  },
  buildingSectionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buildingSectionIconTopLeftRounded: {
    borderTopLeftRadius: Radius.lg,
  },
  buildingSectionIconBottomLeftRounded: {
    borderBottomLeftRadius: Radius.lg,
  },
  buildingSectionIconImg: {
    width: 40,
    height: 40,
  },
  buildingSectionIconText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  buildingSectionText: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  buildingSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  buildingSectionDesc: {
    justifyContent: 'flex-end',
  },
  buildingSectionBar: {
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 2,
  },
  buildingSectionFill: {
    height: '100%',
    borderRadius: 2,
  },
  buildingSectionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  buildingSectionMaxAllBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingSectionBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  buildingSectionBadgeMaxed: {
    backgroundColor: Colors.warning,
  },
  buildingSectionBadgeTopRightRounded: {
    borderTopRightRadius: Radius.lg,
  },
  buildingSectionBadgeBottomRightRounded: {
    borderBottomRightRadius: Radius.lg,
  },
  buildingSectionBadgeText: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  buildingSectionBadgeTextMaxed: {
    color: Colors.bg,
  },
  buildingSectionBadgeLabel: {
    fontSize: 8,
    lineHeight: 9,
    color: Colors.textPrimary,
    opacity: 0.7,
    fontVariant: ['tabular-nums'],
  },
  buildingSectionBody: {
    paddingTop: 0,
  },
  buildingSectionDescText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.base,
    lineHeight: 18,
  },
  buildingSectionRemainingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    marginHorizontal: Spacing.base,
    marginVertical: Spacing.sm,
  },
  buildingSectionRemaining: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  buildingSectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    margin: Spacing.lg,
  },
  buildingSectionMerged: {
    marginHorizontal: Spacing.base,
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
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
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