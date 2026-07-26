import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PressableRipple from './PressableRipple';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing } from '../theme';

interface Props {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, icon, action, onAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {icon && <Ionicons name={icon} size={16} color={Colors.textTertiary} style={styles.icon} />}
        <Text style={styles.title}>{title}</Text>
      </View>
      {action && onAction && (
        <PressableRipple onPress={onAction}>
          <Text style={styles.action}>{action}</Text>
        </PressableRipple>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: Spacing.sm,
  },
  title: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  action: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
