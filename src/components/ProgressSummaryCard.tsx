import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PressableRipple from './PressableRipple';
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
  progress: number;
  items?: { name: string; level: number; maxLevel: number }[];
  lockedMessage?: string;
  onPress?: () => void;
}

export function ProgressSummaryCard({ category, progress, items, lockedMessage, onPress }: Props) {
  const isLocked = (items === undefined || (items.length === 0 && lockedMessage));
  const remaining = items?.filter((i) => i.level < i.maxLevel).length ?? 0;

  let label: string;
  if (lockedMessage && (!items || items.length === 0)) {
    label = lockedMessage;
  } else if (progress >= 1) {
    label = 'All maxed!';
  } else if (remaining > 0) {
    label = `${remaining} remaining`;
  } else {
    label = 'None upgraded';
  }

  const iconDef = CATEGORY_ICONS[category];

  const content = (
    <>
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
        <Text style={[styles.count, isLocked && styles.locked]}>
          {label}
        </Text>
      </View>
    </>
  );

  if (onPress) {
    return <PressableRipple style={styles.card} onPress={onPress}>{content}</PressableRipple>;
  }
  return <View style={styles.card}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    paddingTop: Spacing.md,
    width: '49%',
    marginBottom: Spacing.sm,
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
