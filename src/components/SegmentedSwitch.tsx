import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableRipple from './PressableRipple';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { Skeleton } from './Skeleton';

export interface SegmentedSwitchOption<T extends string> {
  key: T;
  /** Visible text inside the segment. Omit for an icon-only control. */
  label?: string;
  /** Leading artwork (hall art, base thumbnail, …), taking priority over `icon`. */
  image?: ImageSourcePropType | null;
  /** Leading glyph used when there is no `image`. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Screen-reader text; defaults to `label`, then the key. */
  accessibilityLabel?: string;
}

interface Props<T extends string> {
  options: SegmentedSwitchOption<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Extra container styling, e.g. `alignSelf: 'center'` or margins. */
  style?: StyleProp<ViewStyle>;
  /**
   * Draws the segments as placeholders. A switch that selects what the screen is
   * showing should stay in place while that data loads rather than popping in
   * afterwards, so the screen passes its own loading state here. Segments are not
   * pressable in this state.
   */
  loading?: boolean;
}

/**
 * The seamless pill switch shared by the village (TH/BH) selectors and the
 * Base Library's source filter. Only the two outer segments get the container's
 * corner radius, so the middle of the row stays square.
 */
function segCornerStyle(index: number, total: number) {
  const outer = Radius.xl * 1.25;
  return {
    ...(index === 0 && {
      borderTopLeftRadius: outer,
      borderBottomLeftRadius: outer,
    }),
    ...(index === total - 1 && {
      borderTopRightRadius: outer,
      borderBottomRightRadius: outer,
    }),
  };
}

export default function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
  style,
  loading = false,
}: Props<T>) {
  return (
    <View style={[styles.container, style]}>
      {options.map((opt, index) => {
        const corner = segCornerStyle(index, options.length);
        if (loading) {
          // Same padding, gap and corner treatment as a real segment so the row
          // holds its shape; the label bar is sized from the text it stands in for.
          const hasMark = !!opt.image || !!opt.icon;
          return (
            <View key={opt.key} style={[styles.item, corner, styles.itemSkeleton]}>
              {hasMark ? <Skeleton width={16} height={16} borderRadius={4} /> : null}
              {opt.label ? (
                <Skeleton width={Math.max(26, opt.label.length * 7)} height={11} borderRadius={4} />
              ) : null}
            </View>
          );
        }
        const active = opt.key === value;
        const markColor = active ? Colors.bg : Colors.textSecondary;
        return (
          <PressableRipple
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.item, corner, active && styles.itemActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.accessibilityLabel ?? opt.label ?? opt.key}
          >
            {opt.image ? (
              <Image source={opt.image} style={styles.image} resizeMode="contain" />
            ) : opt.icon ? (
              <Ionicons name={opt.icon} size={13} color={markColor} />
            ) : null}
            {opt.label ? (
              <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
            ) : null}
          </PressableRipple>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: Radius.xl * 1.25,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  itemActive: {
    backgroundColor: Colors.textPrimary,
  },
  /** Placeholder segment: same box as a real one so the row does not resize. */
  itemSkeleton: {
    backgroundColor: Colors.bgSubtle,
  },
  image: {
    width: 16,
    height: 16,
  },
  text: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  textActive: {
    color: Colors.bg,
  },
});
