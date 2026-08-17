import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { PACKAGE_RESOURCE_IMAGES } from '../data/packageImages';
import { RESOURCE_META, type CostResource } from '../utils/armyData';
import { BUILDING_RESOURCE_META, type BuildingCostResource } from '../utils/buildingData';
import { formatCost } from '../utils/buildingImages';
import { Colors, Typography, Spacing } from '../theme';

const RESOURCE_ORDER: (CostResource | BuildingCostResource)[] = [
  'Gold',
  'Elixir',
  'Dark Elixir',
  'Builder Gold',
  'Builder Elixir',
  'Shiny Ore',
  'Glowing Ore',
  'Starry Ore',
];

interface Props {
  byResource: Record<string, number>;
  compact?: boolean;
}

/** Inline resource icons + amounts for a cost breakdown, e.g. [gold icon] 700K [elixir icon] 250K. */
export function ResourceCostChips({ byResource, compact }: Props) {
  const entries = (Object.entries(byResource).filter(([, v]) => v > 0) as [string, number][])
    .filter(([r]) => r !== 'Unknown')
    .sort((a, b) => {
      const ia = RESOURCE_ORDER.indexOf(a[0] as (CostResource | BuildingCostResource));
      const ib = RESOURCE_ORDER.indexOf(b[0] as (CostResource | BuildingCostResource));
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  if (entries.length === 0) return null;
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {entries.map(([r, v]) => {
        const icon = PACKAGE_RESOURCE_IMAGES[r];
        const label =
          RESOURCE_META[r as CostResource]?.label ??
          BUILDING_RESOURCE_META[r as BuildingCostResource]?.label ??
          r;
        return icon ? (
          <View key={r} style={styles.chip}>
            <Image source={icon} style={[styles.icon, compact && styles.iconCompact]} resizeMode="contain" />
            <Text style={styles.amount}>{formatCost(v)}</Text>
          </View>
        ) : (
          <View key={r} style={styles.chip}>
            <Text style={styles.fallbackText}>{`${formatCost(v)} ${label}`}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  rowCompact: {
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  icon: {
    width: 20,
    height: 20,
  },
  iconCompact: {
    width: 14,
    height: 14,
  },
  amount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  fallbackText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
});