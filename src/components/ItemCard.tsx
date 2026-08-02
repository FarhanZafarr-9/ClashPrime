import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import PressableRipple from './PressableRipple';
import { Colors, useTheme, Radius, Spacing, Typography } from '../theme';

interface Props {
  name: string;
  level: number;
  maxLevel: number;
  thMaxLevel?: number | null;
  subtitle?: string;
  icon?: string;
  onPress?: () => void;
  locked?: boolean;
}

export function ItemCard({ name, level, maxLevel, thMaxLevel, subtitle, icon, onPress, locked }: Props) {
  const { colors } = useTheme();
  const effectiveMax = thMaxLevel != null && thMaxLevel > 0 ? thMaxLevel : maxLevel;
  const progress = effectiveMax > 0 ? level / effectiveMax : 0;
  const isMaxed = level >= effectiveMax;

  return (
    <PressableRipple
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border, opacity: locked ? 0.55 : 1 }]}
    >
      <View style={styles.row}>
        {icon ? (
          <View style={styles.iconWrap}>
            <Image source={{ uri: icon }} style={styles.iconImage} resizeMode="contain" />
          </View>
        ) : (
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>{name.charAt(0)}</Text>
          </View>
        )}

        <View style={styles.middle}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : locked ? (
            <Text style={styles.lockedHint}>Not yet unlocked</Text>
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
              isMaxed && styles.levelBadgeMaxed
            ]}>
              <Text style={[
                styles.levelBadgeText,
                isMaxed && styles.levelBadgeTextMaxed
              ]}>
                {level}
              </Text>
              <Text style={[
                styles.levelBadgeLabel,
                isMaxed && styles.levelBadgeTextMaxed
              ]}>
                / {effectiveMax}
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
    borderWidth: 0.75,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
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
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
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
  },
  subtitle: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 6,
    width: '100%',
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
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
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeMaxed: {
    backgroundColor: Colors.warning,
  },
  levelBadgeText: {
    ...Typography.headline,
    color: Colors.bg,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  levelBadgeLabel: {
    ...Typography.caption,
    color: Colors.bg,
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
