import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '../theme';

interface Props {
  level: number;
  maxLevel: number;
  size?: 'sm' | 'md' | 'lg';
}

export function LevelBadge({ level, maxLevel, size = 'md' }: Props) {
  const isMax = level >= maxLevel;
  const dim = size === 'sm' ? 20 : size === 'md' ? 24 : 32;
  const fontSize = size === 'sm' ? 9 : size === 'md' ? 11 : 14;

  return (
    <View
      style={[
        styles.badge,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: isMax ? Colors.textPrimary : Colors.bgCard,
          borderWidth: 1,
          borderColor: isMax ? Colors.textPrimary : Colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.level,
          {
            fontSize,
            color: isMax ? Colors.bg : Colors.textSecondary,
          },
        ]}
      >
        {level}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  level: {
    ...Typography.caption,
    fontWeight: '700',
  },
});
