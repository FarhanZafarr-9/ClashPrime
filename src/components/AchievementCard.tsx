import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
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
}

const VILLAGE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  builderBase: 'hammer-outline',
  clanCapital: 'flag-outline',
};

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

          </View>
          <Text style={styles.info} numberOfLines={1}>
            {(a.completionInfo || a.info)}{a.target > 0 ? `: ${formatAchievementValue(a.value)} / ${formatAchievementValue(a.target)}` : ''}
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
      {expanded && a.info && a.completionInfo && (
        <Text style={styles.detailInfo}>{a.info}</Text>
      )}
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
  info: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  detailInfo: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 18,
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
    backgroundColor: Colors.border,
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
    alignItems: 'flex-end',
    gap: 2,
    marginTop: 0,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
});
