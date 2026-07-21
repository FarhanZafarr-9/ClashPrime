import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { Achievement } from '../types/clash';
import {
  formatAchievementValue,
  getAchievementIcon,
  getAchievementProgress,
  getVillageLabel,
} from '../utils/achievements';

interface Props {
  achievement: Achievement;
  expanded?: boolean;
  onPress?: () => void;
  showVillage?: boolean;
}

export function AchievementCard({ achievement: a, expanded, onPress, showVillage }: Props) {
  const progress = getAchievementProgress(a);
  const isComplete = a.stars === 3;
  const icon = getAchievementIcon(a.name);
  const remaining = Math.max(0, a.target - a.value);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, isComplete && styles.iconWrapComplete]}>
          <Ionicons name={icon} size={16} color={isComplete ? Colors.bg : Colors.textSecondary} />
        </View>
        <View style={styles.left}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
            {showVillage && (
              <View style={styles.villageBadge}>
                <Text style={styles.villageText}>{getVillageLabel(a.village)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.info} numberOfLines={expanded ? undefined : 1}>
            {a.completionInfo || a.info}
          </Text>
          {!isComplete && a.target > 0 && (
            <>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {formatAchievementValue(a.value)} / {formatAchievementValue(a.target)}
                {remaining > 0 ? ` · ${formatAchievementValue(remaining)} to go` : ''}
              </Text>
            </>
          )}
          {expanded && a.info && a.completionInfo && (
            <Text style={styles.detailInfo}>{a.info}</Text>
          )}
        </View>
        <View style={styles.right}>
          <View style={styles.starsRow}>
            {[1, 2, 3].map((s) => (
              <Ionicons
                key={s}
                name={s <= a.stars ? 'star' : 'star-outline'}
                size={12}
                color={s <= a.stars ? Colors.textPrimary : Colors.textMuted}
              />
            ))}
          </View>
          <Text style={styles.badge}>{a.stars}/3</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardPressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    marginTop: 2,
  },
  iconWrapComplete: {
    backgroundColor: Colors.textPrimary,
  },
  left: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  name: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
  },
  villageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  villageText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  info: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  detailInfo: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.borderSubtle,
    borderRadius: 2,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.textSecondary,
    borderRadius: 2,
  },
  progressText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  badge: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
