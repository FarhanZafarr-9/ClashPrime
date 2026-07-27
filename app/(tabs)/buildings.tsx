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
import buildingLevelsData from '../../src/data/building-levels.json';
import thLevelsData from '../../src/data/th-levels.json';

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

function BuildingCard({ name, maxLvl, isMaxed, isBB, discounts }: { name: string; maxLvl: number; isMaxed: boolean; isBB?: boolean; discounts: ScopeDiscount }) {
  const { player, upgradeBuilding } = usePlayer();
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

  const currentLevel = player?.buildingLevels?.[name] ?? 0;
  const effectiveMax = getBuildingEffectiveMax(lookupName, player?.townHallLevel ?? 1);
  const progress = effectiveMax > 0 ? currentLevel / effectiveMax : 0;
  const isFullyMaxed = currentLevel >= effectiveMax;
  const isLocked = currentLevel === 0;

  const mainImgSource = getBuildingLevelImageSource(lookupName, Math.max(currentLevel, 1));

  const availableLevels = getBuildingAvailableLevels(lookupName);
  const allLevels = buildingStats?.levels ?? availableLevels.map((l) => ({ Level: l }));
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
    if (expanded) {
      setExpanded(false);
      setShowFull(false);
    } else {
      setExpanded(true);
    }
  };

  return (
    <View style={styles.itemCard}>
      <PressableRipple onPress={toggleExpanded} style={styles.itemCardTouchable}>
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
            {isLocked ? (
              <Text style={styles.lockedText}>Locked</Text>
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
          <View style={[styles.levelBadge, isFullyMaxed && styles.levelBadgeMaxed]}>
            <Text style={[styles.levelBadgeText, isFullyMaxed && styles.levelBadgeTextMaxed]}>
              {isLocked ? 'Locked' : `${currentLevel}/${effectiveMax}`}
            </Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-forward'}
            size={16}
            color={Colors.textTertiary}
            style={styles.expandArrow}
          />
        </View>
      </PressableRipple>

      {isLocked && effectiveMax > 0 && (
        <View style={styles.expandedSection}>
          <Text style={styles.buildingDesc} numberOfLines={3}>This building is available at your Town Hall level. Tap to unlock it.</Text>
          <PressableRipple style={styles.upgradeBtn} onPress={() => upgradeBuilding(name)}>
            <Text style={styles.upgradeBtnText}>Unlock {name}</Text>
            <Ionicons name="arrow-forward" size={14} color={Colors.bg} />
          </PressableRipple>
        </View>
      )}

      {!isLocked && expanded && displayLevels.length > 0 && (
        <View style={styles.expandedSection}>
          {buildingStats?.description ? (
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
            <PressableRipple
              style={styles.upgradeBtn}
              onPress={() => upgradeBuilding(name)}
            >
              <Text style={styles.upgradeBtnText}>Upgrade to Lv{currentLevel + 1}</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.bg} />
            </PressableRipple>
          )}
        </View>
      )}
    </View>
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
            <View style={styles.headerActions}>
              <PressableRipple onPress={() => router.push(`/onboarding?mode=reset&th=${th}`)} hitSlop={8} style={styles.headerBtn}>
                <Ionicons name="refresh-outline" size={22} color={Colors.textSecondary} />
              </PressableRipple>
              <PressableRipple onPress={() => setDiscountModalVisible(true)} hitSlop={8}>
                <Ionicons
                  name={discounts.buildings.costPercent > 0 || discounts.buildings.timePercent > 0 ? 'pricetag' : 'pricetag-outline'}
                  size={24}
                  color={discounts.buildings.costPercent > 0 || discounts.buildings.timePercent > 0 ? Colors.warning : Colors.textSecondary}
                />
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
    marginBottom: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 0.75,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
  },
  itemCardTouchable: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
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
  progressTrack: {
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  levelBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  levelBadgeMaxed: {
    backgroundColor: 'rgba(212, 163, 89, 0.08)',
    borderColor: 'rgba(212, 163, 89, 0.3)',
  },
  levelBadgeText: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 11,
  },
  levelBadgeTextMaxed: {
    color: Colors.warning,
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
    backgroundColor: Colors.bgSubtle,
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
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  upgradeBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  expandArrow: {
    width: 24,
    textAlign: 'center',
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