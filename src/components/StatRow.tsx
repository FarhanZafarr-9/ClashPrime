import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../theme';

interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
}

export function StatRow({ label, value, subtitle }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <Text style={styles.value}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  value: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
