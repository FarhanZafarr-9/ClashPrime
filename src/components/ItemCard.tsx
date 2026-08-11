import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import PressableRipple from './PressableRipple';
import { formatCompact } from '../utils/buildingImages';
import { Colors, useTheme, Radius, Spacing, Typography } from '../theme';

interface Props {
  name: string;
  level: number;
  maxLevel: number;
  thMaxLevel?: number | null;
  subtitle?: string;
  costLabel?: string;
  timeLabel?: string;
  icon?: string;
  iconSource?: ImageSourcePropType;
  onPress?: () => void;
  locked?: boolean;
  isFirst?: boolean;
  isLast?: Boolean;
}

export function ItemCard({ name, level, maxLevel, thMaxLevel, subtitle, costLabel, timeLabel, icon, iconSource, onPress, locked, isFirst, isLast }: Props) {
  const { colors } = useTheme();
  const effectiveMax = thMaxLevel != null && thMaxLevel > 0 ? thMaxLevel : maxLevel;
  const progress = effectiveMax > 0 ? level / effectiveMax : 0;
  const isMaxed = level >= effectiveMax;

  return (
    <PressableRipple
      onPress={onPress}
      style={[styles.card,
      { backgroundColor: colors.bgCard, opacity: locked ? 0.55 : 1 },
      isFirst && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
      isLast && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl }
      ]}
    >
      <View style={styles.row}>

        <View style={[styles.iconWrap,
        isFirst && { borderTopLeftRadius: Radius.lg },
        isLast && { borderBottomLeftRadius: Radius.lg }
        ]}>
          {iconSource ? (
            <Image source={iconSource} style={styles.iconImage} resizeMode="contain" />
          ) : icon ? (

            <Image source={{ uri: icon }} style={styles.iconImage} resizeMode="contain" />
          ) : (
            <Text style={styles.iconText}>{name.charAt(0)}</Text>
          )}
        </View>

        <View style={styles.middle}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : locked ? (
            <Text style={styles.lockedHint}>Not yet unlocked</Text>
          ) : costLabel || timeLabel ? (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(progress, 1) * 100}%`,
                      backgroundColor: isMaxed ? Colors.warning : Colors.textSecondary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.timeLabel} numberOfLines={1}>
                {[costLabel, timeLabel].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(progress, 1) * 100}%`,
                      backgroundColor: isMaxed ? Colors.warning : Colors.textSecondary,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.right}>
          {locked ? (
            <View style={styles.lockedBadge}>
              <Text style={styles.lockedBadgeText}>Locked</Text>
            </View>
          ) : (
            <View style={[
              styles.levelBadgeContainer,
              isMaxed && styles.levelBadgeMaxed,
              isFirst && { borderTopRightRadius: Radius.lg },
              isLast && { borderBottomRightRadius: Radius.lg }
            ]}>
              <Text style={[
                styles.levelBadgeText,
                isMaxed && styles.levelBadgeTextMaxed
              ]}>
                {formatCompact(level)}
              </Text>
              <Text style={[
                styles.levelBadgeLabel,
                isMaxed && styles.levelBadgeTextMaxed
              ]}>
                / {formatCompact(effectiveMax)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </PressableRipple>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  pressed: {
    backgroundColor: Colors.bgCardHover,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  iconImage: {
    width: 34,
    height: 34,
  },
  iconText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  name: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs / 1.25,
  },
  subtitle: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 12,
    width: '100%',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: Spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  timeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 50,
  },
  levelBadgeContainer: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeMaxed: {
    backgroundColor: Colors.warning,
  },
  levelBadgeText: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  levelBadgeLabel: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontSize: 8,
    opacity: 0.7,
    lineHeight: 9,
  },
  levelBadgeTextMaxed: {
    color: Colors.bg,
  },
  lockedHint: {
    ...Typography.footnote,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  lockedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  lockedBadgeText: {
    ...Typography.footnote,
    color: Colors.textMuted,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
