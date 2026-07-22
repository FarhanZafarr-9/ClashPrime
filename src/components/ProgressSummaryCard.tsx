import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface IconDef {
  set: 'ion' | 'mc';
  name: string;
}

const CATEGORY_ICONS: Record<string, IconDef> = {
  Heroes: { set: 'ion', name: 'shield-half-outline' },
  Troops: { set: 'mc', name: 'sword-cross' },
  Spells: { set: 'ion', name: 'flask-outline' },
  Equipment: { set: 'ion', name: 'trophy-outline' },
};

interface Props {
  category: string;
  completed: number;
  total: number;
  items?: { name: string; level: number; maxLevel: number }[];
  lockedMessage?: string;
}

export function ProgressSummaryCard({ category, completed, total, lockedMessage }: Props) {
  const progress = total > 0 ? completed / total : 0;
  const isLocked = total === 0 && lockedMessage;
  const isZero = !isLocked && total > 0 && completed === 0;
  const iconDef = CATEGORY_ICONS[category];

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.category} numberOfLines={1}>{category}</Text>
        {iconDef && (
          iconDef.set === 'mc' ? (
            <MaterialCommunityIcons name={iconDef.name as any} size={14} color={Colors.textTertiary} />
          ) : (
            <Ionicons name={iconDef.name as any} size={14} color={Colors.textTertiary} />
          )
        )}
      </View>
      <Text style={[styles.percentage, isLocked && styles.locked]}>
        {isLocked ? '—' : `${Math.round(progress * 100)}%`}
      </Text>
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.count, (isLocked || isZero) && styles.locked]}>
          {isLocked ? lockedMessage : isZero ? 'None maxed' : `${completed}/${total}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    paddingTop: Spacing.md,
    width: '48%',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg * 1.5,
  },
  category: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
  },
  percentage: {
    ...Typography.title1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    fontSize: 22,
    lineHeight: 28,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },
  count: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  locked: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
});
