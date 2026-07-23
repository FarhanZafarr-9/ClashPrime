import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  icon: string;
  title: string;
  description?: string;
}

export function EmptyState({ icon, title, description }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.xxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  icon: {
    fontSize: 28,
  },
  title: {
    ...Typography.headline,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
