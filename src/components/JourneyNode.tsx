import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, Animated, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
import PressableRipple from './PressableRipple';
import { ItemCard } from './ItemCard';
import { formatTimeShort, formatCostBreakdown } from '../utils/upgradeCosts';
import type { ThJourneyStep, ThJourneyItem, ThJourneyLevelUp } from '../utils/thJourney';

interface JourneyNodeProps {
  step: ThJourneyStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  filters: Set<string>;
  onFilterChange: (filter: string) => void;
}

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'buildings', label: 'Buildings', icon: 'hammer-outline' },
  { key: 'heroes', label: 'Heroes', icon: 'shield-half-outline' },
  { key: 'troops', label: 'Troops', icon: 'sword-cross', set: 'mc' as const },
  { key: 'spells', label: 'Spells', icon: 'flask-outline' },
  { key: 'pets', label: 'Pets', icon: 'paw-outline' },
  { key: 'sieges', label: 'Sieges', icon: 'build-outline' },
  { key: 'equipment', label: 'Equipment', icon: 'diamond-outline' },
  { key: 'building-ups', label: 'Building Ups', icon: 'arrow-up-circle-outline' },
  { key: 'army-ups', label: 'Army Ups', icon: 'arrow-up-circle-outline' },
];

function PipelineRing({ pct, color, size = 36 }: { pct: number; color: string; size?: number }) {
  const circumference = Math.PI * 2 * (size / 2 - 3);
  const strokeDashoffset = circumference * (1 - pct / 100);
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          styles.ringSvg,
          {
            width: size,
            height: size,
            transform: [{ rotate: '-90deg' }],
          },
        ]}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: color + '33',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderStyle: 'solid',
            position: 'absolute',
            top: 0,
            left: 0,
            transform: [{ rotate: '-90deg' }],
          }}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 3,
              borderColor: 'transparent',
              borderTopColor: color,
              borderRightColor: color,
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

function CategorySection({
  title,
  icon,
  iconSet,
  iconColor,
  children,
  count,
  filterKey,
  isActive,
  onFilterPress,
}: {
  title: string;
  icon: string;
  iconSet?: 'ion' | 'mc';
  iconColor: string;
  children: React.ReactNode;
  count: number;
  filterKey: string;
  isActive: boolean;
  onFilterPress: () => void;
}) {
  if (count === 0) return null;
  return (
    <View style={styles.categorySection}>
      <PressableRipple style={styles.categoryHeader} onPress={onFilterPress}>
        <View style={styles.categoryHeaderLeft}>
          {iconSet === 'mc' ? (
            <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
          ) : (
            <Ionicons name={icon as any} size={20} color={iconColor} />
          )}
          <Text style={[styles.categoryTitle, isActive && styles.categoryTitleActive]}>{title}</Text>
          <View style={styles.categoryCount}>
            <Text style={styles.categoryCountText}>{count}</Text>
          </View>
        </View>
        <Ionicons name={isActive ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textTertiary} />
      </PressableRipple>
      {isActive && <View style={styles.categoryContent}>{children}</View>}
    </View>
  );
}

function JourneyItemCard({ item, isLevelUp }: { item: ThJourneyItem | ThJourneyLevelUp; isLevelUp?: boolean }) {
  const timeStr = item.timeSec > 0 ? formatTimeShort(item.timeSec) : 'Instant';
  const costStr = item.cost > 0 ? formatCostBreakdown(item.byResource) : '—';
  const copiesStr = item.copies > 1 ? ` ×${item.copies}` : '';
  const isJourneyItem = 'maxLevel' in item;
  const levelStr = isLevelUp ? ` +${(item as ThJourneyLevelUp).levelDelta} lvls` : ` → Lv.${isJourneyItem ? item.maxLevel : ''}`;
  const iconSource = isJourneyItem ? item.iconSource : undefined;

  return (
    <View style={styles.itemRow}>
      {iconSource && (
        <Image source={{ uri: `asset:/${iconSource}` }} style={styles.itemIcon} resizeMode="contain" />
      )}
      <View style={[styles.itemInfo, { flex: 1 }]}>
        <Text style={styles.itemName}>{item.name}{copiesStr}{levelStr}</Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemTime}>{timeStr}</Text>
          {costStr !== '—' && <Text style={styles.itemCost}>{costStr}</Text>}
        </View>
      </View>
    </View>
  );
}

export function JourneyNode({ step, index, isFirst, isLast, filters, onFilterChange }: JourneyNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState<Record<string, boolean>>({});

  const toggleCategory = (key: string) => {
    setCategoryOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasFilter = (key: string) => filters.size === 0 || filters.has('all') || filters.has(key);

  const renderCategory = (
    key: string,
    title: string,
    icon: string,
    iconSet: 'ion' | 'mc' | undefined,
    iconColor: string,
    items: (ThJourneyItem | ThJourneyLevelUp)[],
    isLevelUp = false
  ) => {
    if (!hasFilter(key) || items.length === 0) return null;
    const open = categoryOpen[key] ?? false;
    return (
      <CategorySection
        key={key}
        title={title}
        icon={icon}
        iconSet={iconSet}
        iconColor={iconColor}
        count={items.length}
        filterKey={key}
        isActive={open}
        onFilterPress={() => toggleCategory(key)}
      >
        {items.map((item, i) => (
          <JourneyItemCard key={`${key}-${i}`} item={item} isLevelUp={isLevelUp} />
        ))}
      </CategorySection>
    );
  };

  const { summary, detail, cumulative, th, isCurrent, isMax } = step;
  const totalTime = summary.totalBuildTimeSec + summary.totalResearchTimeSec;
  const hasContent = totalTime > 0 || summary.totalBuildCost > 0 || summary.totalResearchCost > 0;

  if (!hasContent && !isCurrent && !isMax) return null;

  const timeLabel = isMax ? 'MAXED' : formatJourneyTime(summary.totalBuildTimeSec, summary.totalResearchTimeSec);

  return (
    <View style={[styles.nodeContainer, isFirst && styles.nodeFirst, isLast && styles.nodeLast]}>
      <View style={styles.timelineTrack} />
      
      <TouchableOpacity style={styles.nodeTouch} onPress={() => setExpanded(!expanded)} activeOpacity={0.9}>
        <View style={[
          styles.nodeBadge,
          isCurrent && styles.nodeBadgeCurrent,
          isMax && styles.nodeBadgeMax,
        ]}>
          <Text style={[
            styles.nodeBadgeText,
            isCurrent && styles.nodeBadgeTextCurrent,
            isMax && styles.nodeBadgeTextMax,
          ]}>
            {isMax ? '★' : `TH${th}`}
          </Text>
          {isCurrent && <View style={styles.pulseRing} />}
        </View>

        <View style={styles.nodeContent}>
          <View style={styles.nodeHeader}>
            <View style={styles.nodeHeaderLeft}>
              <Text style={[styles.nodeTitle, isCurrent && styles.nodeTitleCurrent]}>
                {isMax ? 'MAX TOWN HALL' : `Town Hall ${th}`}
              </Text>
              {isCurrent && <View style={styles.currentChip}><Text style={styles.currentChipText}>CURRENT</Text></View>}
              {isMax && <View style={styles.maxChip}><Text style={styles.maxChipText}>MAXED</Text></View>}
            </View>
            <View style={styles.nodeHeaderRight}>
              <Text style={styles.nodeTime}>{timeLabel}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textTertiary} />
            </View>
          </View>

          <View style={styles.nodeSummary}>
            <View style={styles.summaryRow}>
              {summary.newBuildingsCount > 0 && (
                <View style={styles.summaryItem}>
                  <Ionicons name="business-outline" size={16} color={Colors.accent} />
                  <Text style={styles.summaryLabel}>{summary.newBuildingsCount} new</Text>
                </View>
              )}
              {summary.newHeroesCount > 0 && (
                <View style={styles.summaryItem}>
                  <Ionicons name="shield-half-outline" size={16} color={Colors.accent} />
                  <Text style={styles.summaryLabel}>{summary.newHeroesCount} heroes</Text>
                </View>
              )}
              {summary.newTroopsSpellsCount > 0 && (
                <View style={styles.summaryItem}>
                  <Ionicons name="flask-outline" size={16} color={Colors.accent} />
                  <Text style={styles.summaryLabel}>newTroopsSpellsCount lab</Text>
                </View>
              )}
              {summary.newPetsCount > 0 && (
                <View style={styles.summaryItem}>
                  <Ionicons name="paw-outline" size={16} color={Colors.accent} />
                  <Text style={styles.summaryLabel}>{summary.newPetsCount} pets</Text>
                </View>
              )}
              {summary.newSiegesCount > 0 && (
                <View style={styles.summaryItem}>
                  <Ionicons name="build-outline" size={16} color={Colors.accent} />
                  <Text style={styles.summaryLabel}>summary.newSiegesCount sieges</Text>
                </View>
              )}
              {summary.newEquipmentCount > 0 && (
                <View style={styles.summaryItem}>
                  <Ionicons name="diamond-outline" size={16} color={Colors.accent} />
                  <Text style={styles.summaryLabel}>summary.newEquipmentCount equip</Text>
                </View>
              )}
            </View>
            {(summary.buildingLevelUps > 0 || summary.armyLevelUps > 0) && (
              <View style={styles.summaryRow}>
                {summary.buildingLevelUps > 0 && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="arrow-up-circle-outline" size={16} color={Colors.textTertiary} />
                    <Text style={styles.summaryLabel}>{summary.buildingLevelUps} bldg ups</Text>
                  </View>
                )}
                {summary.armyLevelUps > 0 && (
                  <View style={styles.summaryItem}>
                    <Ionicons name="arrow-up-circle-outline" size={16} color={Colors.textTertiary} />
                    <Text style={styles.summaryLabel}>{summary.armyLevelUps} army ups</Text>
                  </View>
                )}
              </View>
            )}
            {(summary.totalBuildCost > 0 || summary.totalResearchCost > 0 || Object.keys(summary.totalOreCost).length > 0) && (
              <View style={styles.summaryCost}>
                <Text style={styles.summaryCostLabel}>
                  {formatJourneyCost(summary.totalBuildCost, summary.totalResearchCost, summary.totalOreCost)}
                </Text>
              </View>
            )}
          </View>

          {expanded && (
            <View style={styles.nodeExpanded}>
              <View style={styles.filterChips}>
                {FILTER_OPTIONS.map(opt => {
                  const active = filters.has(opt.key) || (filters.size === 0 && opt.key === 'all');
                  return (
                    <PressableRipple
                      key={opt.key}
                      onPress={() => onFilterChange(opt.key)}
                      style={[
                        styles.filterChip,
                        active && styles.filterChipActive,
                      ]}
                    >
                      <Text style={[
                        styles.filterChipText,
                        active && styles.filterChipTextActive,
                      ]}>
                        {opt.label}
                      </Text>
                    </PressableRipple>
                  );
                })}
              </View>

              {renderCategory('buildings', 'Buildings', 'business-outline', 'ion', Colors.accent, detail.newBuildings)}
              {renderCategory('heroes', 'Heroes', 'shield-half-outline', 'ion', Colors.accent, detail.newHeroes)}
              {renderCategory('troops', 'Troops', 'sword-cross', 'mc', Colors.accent, detail.newTroops)}
              {renderCategory('spells', 'Spells', 'flask-outline', 'ion', Colors.accent, detail.newSpells)}
              {renderCategory('pets', 'Pets', 'paw-outline', 'ion', Colors.accent, detail.newPets)}
              {renderCategory('sieges', 'Sieges', 'build-outline', 'ion', Colors.accent, detail.newSieges)}
              {renderCategory('equipment', 'Equipment', 'diamond-outline', 'ion', Colors.accent, detail.newEquipment)}
              {renderCategory('building-ups', 'Building Level Ups', 'arrow-up-circle-outline', 'ion', Colors.textTertiary, detail.buildingLevelUps, true)}
              {renderCategory('army-ups', 'Army Level Ups', 'arrow-up-circle-outline', 'ion', Colors.textTertiary, detail.armyLevelUps, true)}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function formatJourneyTime(buildSec: number, researchSec: number): string {
  const parts: string[] = [];
  if (buildSec > 0) parts.push(`${formatTimeShort(buildSec)} build`);
  if (researchSec > 0) parts.push(`${formatTimeShort(researchSec)} research`);
  return parts.join(' · ') || '—';
}

function formatJourneyCost(buildCost: number, researchCost: number, oreCost: Record<string, number>): string {
  const parts: string[] = [];
  if (buildCost > 0) parts.push(formatCostBreakdown({ Gold: buildCost }));
  if (researchCost > 0) parts.push(formatCostBreakdown({ Elixir: researchCost }));
  for (const [ore, val] of Object.entries(oreCost)) {
    if (val > 0) parts.push(`${formatCostBreakdown({ [ore]: val })} ${ore}`);
  }
  return parts.join(' · ') || '—';
}

const styles = StyleSheet.create({
  nodeContainer: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  nodeFirst: {
    paddingTop: Spacing.lg,
  },
  nodeLast: {
    paddingBottom: Spacing.xl,
  },
  timelineTrack: {
    position: 'absolute',
    left: 24,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.border,
  },
  nodeTouch: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  nodeBadge: {
    position: 'absolute',
    left: -Spacing.lg - 24,
    top: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.bgCard,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nodeBadgeCurrent: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  nodeBadgeMax: {
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
  },
  nodeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  nodeBadgeTextCurrent: {
    color: Colors.bg,
  },
  nodeBadgeTextMax: {
    color: Colors.bg,
  },
  pulseRing: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.accent,
    opacity: 0.5,
  },
  nodeContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  nodeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nodeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nodeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  nodeTitleCurrent: {
    color: Colors.accent,
  },
  nodeTime: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  currentChip: {
    backgroundColor: Colors.accent + '22',
    borderColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  currentChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.accent,
  },
  maxChip: {
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  maxChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.bg,
  },
  nodeSummary: {
    gap: Spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  summaryCost: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryCostLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontFamily: 'monospace',
  },
  nodeExpanded: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  filterChip: {
    minWidth: 70,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.bg,
  },
  categorySection: {
    marginBottom: Spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  categoryTitleActive: {
    color: Colors.textPrimary,
  },
  categoryCount: {
    minWidth: 24,
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
  categoryContent: {
    marginTop: Spacing.xs,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  itemTime: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: 'monospace',
  },
  itemCost: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
  },
  ringSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});