import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, useTheme } from '../theme';

export function UpgradeAvailabilityStrip({ freeBuilders, labIdle, builderImage, labImage }: {
  freeBuilders: number | null; labIdle: boolean; builderImage?: ImageSourcePropType; labImage?: ImageSourcePropType;
}) {
  const { colors } = useTheme();
  if (!(freeBuilders != null && freeBuilders > 0) && !labIdle) return null;
  const alerts = [
    ...(freeBuilders != null && freeBuilders > 0 ? [{ key: 'builders', text: `${freeBuilders} builder${freeBuilders === 1 ? '' : 's'} free`, image: builderImage }] : []),
    ...(labIdle ? [{ key: 'lab', text: 'Lab idle', image: labImage }] : []),
  ];
  return <View style={styles.container}>
    <View style={styles.alerts}>
      {alerts.map(alert => <View key={alert.key} accessibilityLabel={alert.text + ', based on tracked upgrades'} style={[styles.chip, { backgroundColor: colors.warningGhost }]}>
        {alert.image && <Image source={alert.image} style={styles.image} resizeMode="contain" />}
        <Text style={[styles.label, { color: colors.warningText }]}>{alert.text}</Text>
        <Ionicons name="alert-circle-outline" size={14} color={colors.warningText} />
      </View>)}
    </View>
    <Text style={[styles.caption, { color: colors.textTertiary }]}>Based on tracked upgrades</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { marginHorizontal: Spacing.base, marginBottom: Spacing.sm, gap: Spacing.xs },
  alerts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  image: { width: 22, height: 22 },
  label: { fontSize: 12, fontWeight: '600' },
  caption: { fontSize: 10 },
});
