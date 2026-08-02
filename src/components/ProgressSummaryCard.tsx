import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import PressableRipple from './PressableRipple';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { CATEGORY_ICONS } from '../utils/statImages';

interface Props {
  category: string;
  progress: number;
  items?: { name: string; level: number; maxLevel: number }[];
  lockedMessage?: string;
  iconUri?: string;
  onPress?: () => void;
}

export function ProgressSummaryCard({ category, progress, items, lockedMessage, iconUri, onPress }: Props) {
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

  const categoryIcon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS];

  const content = (
    <>
      <View style={styles.topRow}>
        <Text style={styles.category} numberOfLines={1}>{category}</Text>
        {iconUri ? (
          <Image source={{ uri: iconUri }} style={styles.categoryIcon} resizeMode="contain" />
        ) : categoryIcon ? (
          <Image source={categoryIcon} style={styles.categoryIcon} resizeMode="contain" />
        ) : null}
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
  categoryIcon: {
    width: 24,
    height: 24,
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
