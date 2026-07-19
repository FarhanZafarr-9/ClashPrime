import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../theme';

interface Props {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text
        style={[styles.text, selected && styles.selectedText]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 44,
    maxWidth: 160,
    height: 36,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  text: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  selectedText: {
    color: Colors.bg,
    fontWeight: '600',
  },
});
