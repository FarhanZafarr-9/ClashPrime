import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { LevelBadge } from './LevelBadge';

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
  const effectiveMax = thMaxLevel != null && thMaxLevel > 0 ? thMaxLevel : maxLevel;
  const progress = effectiveMax > 0 ? level / effectiveMax : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        {icon ? (
          <Image source={{ uri: icon }} style={styles.icon} />
        ) : (
          <View style={styles.iconPlaceholder}>
            <Text style={styles.iconText}>{name.charAt(0)}</Text>
          </View>
        )}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <LevelBadge level={level} maxLevel={effectiveMax} size="sm" />
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(progress, 1) * 100}%`,
                  backgroundColor:
                    progress >= 1 ? Colors.textPrimary : Colors.textTertiary,
                },
              ]}
            />
          </View>
          <Text style={styles.levelText}>
            {level}/{effectiveMax}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pressed: {
    backgroundColor: Colors.bgCardHover,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    ...Typography.headline,
    color: Colors.textTertiary,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  levelText: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
