import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Colors, useTheme, Radius, Spacing, Typography } from '../theme';

interface Props {
  name: string;
  level: number;
  maxLevel: number;
  thMaxLevel?: number | null;
  subtitle?: string;
  icon?: string;
  onPress?: () => void;
}

export function ItemCard({ name, level, maxLevel, thMaxLevel, subtitle, icon, onPress }: Props) {
  const { colors } = useTheme();
  const effectiveMax = thMaxLevel != null && thMaxLevel > 0 ? thMaxLevel : maxLevel;
  const progress = effectiveMax > 0 ? level / effectiveMax : 0;
  const isMaxed = level >= effectiveMax;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.bgCardHover : colors.bgCard,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        {icon ? (
          <Image source={{ uri: icon }} style={styles.icon} />
        ) : (
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>{name.charAt(0)}</Text>
          </View>
        )}

        <View style={styles.middle}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(progress, 1) * 100}%`,
                      backgroundColor: isMaxed ? Colors.warning : Colors.textSecondary, // Goldish color if maxed, secondary gray if not
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.right}>
          <View style={[
            styles.levelBadgeContainer,
            isMaxed && styles.levelBadgeMaxed
          ]}>
            <Text style={[
              styles.levelBadgeText,
              isMaxed && styles.levelBadgeTextMaxed
            ]}>
              {level}/{effectiveMax}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
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
  icon: {
    width: 44,
    height: 44,
    marginRight: Spacing.md,
  },
  iconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  iconText: {
    ...Typography.headline,
    color: Colors.textTertiary,
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
    backgroundColor: Colors.borderSubtle,
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  levelBadgeMaxed: {
    backgroundColor: 'rgba(212, 163, 89, 0.08)',
    borderColor: 'rgba(212, 163, 89, 0.3)',
  },
  levelBadgeText: {
    ...Typography.footnote,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontSize: 11,
  },
  levelBadgeTextMaxed: {
    color: Colors.warning,
  },
});
