import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
import PressableRipple from './PressableRipple';
import { Achievement } from '../types/clash';
import {
  formatAchievementValue,
  getAchievementIcon,
  getAchievementProgress,
} from '../utils/achievements';

interface Props {
  achievement: Achievement;
  expanded?: boolean;
  onPress?: () => void;
  showVillage?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

const VILLAGE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  builderBase: 'hammer-outline',
  clanCapital: 'flag-outline',
};

export function AchievementCard({ achievement: a, expanded, onPress, showVillage, isFirst, isLast }: Props) {
  const progress = getAchievementProgress(a);
  const isComplete = a.stars === 3;
  const icon = getAchievementIcon(a.name);
  const remaining = Math.max(0, a.target - a.value);
  const hasDetail = !!a.info;

  return (
    <PressableRipple
      onPress={hasDetail ? onPress : undefined}
      disabled={!hasDetail}
      style={[
        styles.card,
        isFirst && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
        isLast && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconWrap, isComplete && styles.iconWrapComplete, isFirst && { borderTopLeftRadius: Radius.lg }, isLast && { borderBottomLeftRadius: Radius.lg }]}>
          <Ionicons name={icon} size={16} color={isComplete ? Colors.bg : Colors.textSecondary} />
        </View>
        <View style={styles.left}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
          </View>
          <Text style={styles.info} numberOfLines={1}>
            {a.completionInfo || a.info}
          </Text>
        </View>
        <View style={styles.right}>
          <View style={styles.starsRow}>
            {showVillage && (
              <Ionicons name={VILLAGE_ICONS[a.village] || 'planet-outline'} size={11} color={Colors.textSecondary} style={{ marginRight: 8, marginTop: 1 }} />
            )}
            {[1, 2, 3].map((s) => (
              <Ionicons
                key={s}
                name={s <= a.stars ? 'star' : 'star-outline'}
                size={12}
                color={s <= a.stars ? Colors.textPrimary : Colors.textMuted}
              />
            ))}
          </View>
          {hasDetail && (
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textTertiary} style={{ marginLeft: 4, marginTop: 1 }} />
          )}
        </View>
      </View>

      {!isComplete && a.target > 0 && (
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          {remaining > 0 && (
            <Text style={[styles.progressRemaining, { marginLeft: 20 }]}>{formatAchievementValue(remaining)} to go</Text>
          )}
        </View>
      )}
      {expanded && hasDetail && (
        <View style={styles.detailWrap}>
          <Text style={styles.detailInfo}>{a.info}</Text>
        </View>
      )}
    </PressableRipple>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: 2,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
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
  info: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  detailInfo: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  detailWrap: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    width: '100%'
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.textSecondary,
    borderRadius: 2,
  },
  progressRemaining: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
    marginBottom: 2
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
});
