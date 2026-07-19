import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../theme';
import { ProgressRing } from './ProgressRing';

interface Props {
  category: string;
  completed: number;
  total: number;
  items?: { name: string; level: number; maxLevel: number }[];
  lockedMessage?: string;
}

export function ProgressSummaryCard({ category, completed, total, items, lockedMessage }: Props) {
  const progress = total > 0 ? completed / total : 0;
  const isLocked = total === 0 && lockedMessage;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <ProgressRing
          size={56}
          strokeWidth={5}
          progress={progress}
          label={isLocked ? '—' : `${Math.round(progress * 100)}%`}
          color={isLocked ? Colors.textMuted : Colors.textPrimary}
        />
        <View style={styles.info}>
          <Text style={styles.category}>{category}</Text>
          <Text style={[styles.count, isLocked && styles.countLocked]}>
            {isLocked ? lockedMessage : `${completed}/${total} maxed`}
          </Text>
          {!isLocked && items && items.length > 0 && (
            <Text style={styles.preview} numberOfLines={1}>
              {items
                .slice(0, 3)
                .map((i) => i.name)
                .join(' · ')}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    width: '48%',
    marginBottom: Spacing.sm,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  info: {
    flex: 1,
  },
  category: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  count: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  countLocked: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  preview: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
