import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableRipple from './PressableRipple';
import { useSettingRowSurface } from './SettingRow';
import { Radius, useTheme } from '../theme';

interface Props<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** Compact previous/next control for settings with a small fixed option list. */
export default function OptionSelector<T extends string>({ label, value, options, onChange }: Props<T>) {
  const { colors } = useTheme();
  const inverted = useSettingRowSurface();
  const index = options.findIndex((option) => option.value === value);
  const previous = options[index - 1];
  const next = options[index + 1];
  const foreground = inverted ? colors.bgCard : colors.textPrimary;

  return (
    <View style={[styles.container, { backgroundColor: inverted ? colors.invertedChip : colors.bgCardHover }]}>
      <PressableRipple
        onPress={() => { if (previous) onChange(previous.value); }}
        disabled={!previous}
        style={[styles.arrow, !previous && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel={`Previous ${label} option${previous ? `: ${previous.label}` : ''}`}
        accessibilityState={{ disabled: !previous }}
      >
        <Ionicons name="chevron-back" size={16} color={foreground} />
      </PressableRipple>
      <Text
        style={[styles.value, { color: foreground }]}
        numberOfLines={1}
        accessibilityLabel={`${label}: ${options[index]?.label ?? value}`}
        accessibilityLiveRegion="polite"
      >
        {options[index]?.label ?? value}
      </Text>
      <PressableRipple
        onPress={() => { if (next) onChange(next.value); }}
        disabled={!next}
        style={[styles.arrow, !next && styles.disabled]}
        accessibilityRole="button"
        accessibilityLabel={`Next ${label} option${next ? `: ${next.label}` : ''}`}
        accessibilityState={{ disabled: !next }}
      >
        <Ionicons name="chevron-forward" size={16} color={foreground} />
      </PressableRipple>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 148,
    height: 36,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  arrow: {
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  disabled: { opacity: 0.3 },
});
