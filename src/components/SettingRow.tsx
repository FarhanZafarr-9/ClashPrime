import React from 'react';
import { View, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import Animated, { Easing, useSharedValue, useAnimatedStyle, withTiming, interpolate, interpolateColor, ReduceMotion } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import PressableRipple from './PressableRipple';
import { Colors, useTheme, Radius, Spacing, Typography } from '../theme';

const DANGER = '#F44336';
const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

function fadeColor(progress: number, from: string, to: string) {
  'worklet';
  // Linear RGB avoids a dark-to-light transition jumping in brightness early.
  return interpolateColor(progress, [0, 1], [from, to], 'RGB', { gamma: 1 });
}

/**
 * Whether the row is currently drawing on its inverted surface.
 *
 * An expanded row fills with the text colour and prints the surface colour, so
 * anything a caller passes as `desc` or `children` has to flip too - otherwise
 * dark text lands on a dark fill. SettingRow can only recolour what it owns, so
 * custom nodes read this instead. `useSettingRowSurface()` returns false outside
 * a row, which is the safe default for the normal surface.
 */
const SettingRowSurfaceContext = React.createContext(false);
export function useSettingRowSurface(): boolean {
  return React.useContext(SettingRowSurfaceContext);
}

export type PillPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

function getPillPos(pos: PillPosition, topOffset: number, rightOffset: number): any {
  const style: any = { position: 'absolute', zIndex: 10 };
  const [vert, hor] = pos.split('-');
  if (vert === 'top') style.top = -8 + topOffset;
  if (vert === 'center') { style.top = '50%'; style.marginTop = -8; }
  if (vert === 'bottom') style.bottom = -8;
  if (hor === 'left') style.left = 12;
  if (hor === 'right') style.right = 12 + rightOffset;
  if (pos === 'center') { style.left = '50%'; style.transform = [{ translateX: -50 }]; }
  return style;
}

interface SettingRowProps {
  icon?: string;
  iconUrl?: string;
  iconSource?: ImageSourcePropType;
  title: string;
  desc?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  pillText?: string;
  pillPosition?: PillPosition;
  pillTopOffset?: number;
  pillRightOffset?: number;
  destructive?: boolean;
  accentColor?: string;
  isExtra?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  compact?: boolean;
  /**
   * For a row whose content is revealed underneath it. Animates the inverted
   * surface and rounded corners so the open state reads at a glance.
   */
  expanded?: boolean;
}

export function SettingRow({
  icon,
  iconUrl,
  iconSource,
  title,
  desc,
  onPress,
  onLongPress,
  children,
  disabled,
  pillText,
  pillPosition = 'top-right',
  pillTopOffset = 0,
  pillRightOffset = 0,
  destructive,
  accentColor,
  isExtra,
  isFirst,
  isLast,
  compact,
  expanded,
}: SettingRowProps) {
  const { colors } = useTheme();
  const accent = destructive ? DANGER : accentColor || null;
  /**
   * An expanded row inverts the card - text-coloured fill, surface-coloured
   * text - so the open section is obvious at a glance. Skipped when the row
   * carries its own tint (isExtra / accent), which already owns the surface:
   * inverting those would strand accent text on a dark fill.
   */
  const inverted = !!expanded && !isExtra && !accent;
  const progress = useSharedValue(expanded ? 1 : 0);
  React.useLayoutEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: expanded ? 260 : 160,
      easing: Easing.inOut(Easing.quad),
      reduceMotion: ReduceMotion.System,
    });
  }, [expanded, progress]);
  const canInvert = !isExtra && !accent;
  const surfaceStyle = useAnimatedStyle(() => {
    const inner = interpolate(progress.value, [0, 1], [Radius.sm, 0]);
    return {
      backgroundColor: accent ? `${accent}1a` : isExtra ? colors.accentGhost : fadeColor(progress.value, colors.bgCard, colors.textPrimary),
      borderTopLeftRadius: isFirst ? Radius.xl * 1.25 : inner,
      borderTopRightRadius: isFirst ? Radius.xl * 1.25 : inner,
      borderBottomLeftRadius: isLast ? Radius.xl * 1.25 : inner,
      borderBottomRightRadius: isLast ? Radius.xl * 1.25 : inner,
    };
  });
  const titleStyle = useAnimatedStyle(() => ({
    color: accent || (canInvert ? fadeColor(progress.value, colors.textPrimary, colors.bgCard) : colors.textPrimary),
  }));
  const descStyle = useAnimatedStyle(() => ({
    color: accent || (canInvert ? fadeColor(progress.value, colors.textTertiary, colors.bgCard) : colors.textTertiary),
    opacity: canInvert ? interpolate(progress.value, [0, 1], [0.95, 0.7]) : 0.95,
  }));
  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: accent ? `${accent}2e` : canInvert ? fadeColor(progress.value, colors.bgCardHover, colors.invertedChip) : colors.bgCardHover,
  }));
  const glyphStyle = useAnimatedStyle(() => ({
    color: accent || (canInvert ? fadeColor(progress.value, colors.textPrimary, colors.bgCard) : colors.textPrimary),
  }));
  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: canInvert ? fadeColor(progress.value, colors.textPrimary, colors.bg) : colors.textPrimary,
    borderColor: colors.border,
  }));
  const pillTextStyle = useAnimatedStyle(() => ({
    color: canInvert ? fadeColor(progress.value, colors.bg, colors.textPrimary) : colors.bg,
  }));
  return (
    <View style={styles.settingRowContainer}>
      {pillText && (
        <View style={getPillPos(pillPosition, pillTopOffset, pillRightOffset)}>
          <Animated.View style={[styles.pill, destructive ? styles.pillDanger : pillStyle]}>
            <Animated.Text style={[styles.pillText, destructive ? styles.pillTextDanger : pillTextStyle]}>{pillText}</Animated.Text>
          </Animated.View>
        </View>
      )}
      <SettingRowSurfaceContext.Provider value={inverted}>
      <Animated.View style={[surfaceStyle, { overflow: 'hidden', opacity: disabled ? 0.5 : 1 }]}>
      <PressableRipple
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={[
          styles.settingBlock,
          compact && styles.settingBlockCompact,
          { backgroundColor: 'transparent', borderColor: accent ? `${accent}40` : colors.border },
          isFirst && styles.settingBlockFirst,
          isLast && styles.settingBlockLast,
        ]}
      >
        {(icon || iconSource || iconUrl) && (
          <Animated.View style={[
            styles.settingRowIcon,
            // Chip and glyph invert together with the row surface.
            chipStyle,
            isFirst && styles.settingRowIconFirst,
            isLast && styles.settingRowIconLast,
          ]}>
            {iconSource ? (
              <Image source={iconSource} style={styles.settingRowImage} resizeMode="contain" />
            ) : iconUrl ? (
              <Image source={{ uri: iconUrl }} style={styles.settingRowImage} resizeMode="contain" />
            ) : (
              <AnimatedIonicons
                name={icon as any}
                size={15}
                style={glyphStyle}
              />
            )}
          </Animated.View>
        )}
        <View style={styles.settingTextBlock}>
          <Animated.Text style={[styles.settingTitle, titleStyle]}>{title}</Animated.Text>
          {desc != null
            ? typeof desc === 'string'
              ? <Animated.Text style={[styles.settingDesc, descStyle]}>{desc}</Animated.Text>
              : desc
            : null}
        </View>
        {children}
      </PressableRipple>
      </Animated.View>
      </SettingRowSurfaceContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  settingRowContainer: {
    position: 'relative',
  },
  settingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
  },
  settingBlockCompact: {
    paddingHorizontal: Spacing.md,
  },
  settingBlockFirst: {
    borderTopLeftRadius: Radius.xl * 1.25,
    borderTopRightRadius: Radius.xl * 1.25,
  },
  settingBlockLast: {
    borderBottomLeftRadius: Radius.xl * 1.25,
    borderBottomRightRadius: Radius.xl * 1.25,
  },
  settingRowIcon: {
    marginRight: 4,
    backgroundColor: Colors.bgCardHover,
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRowIconFirst: {
    borderTopLeftRadius: Radius.lg,
  },
  settingRowIconLast: {
    borderBottomLeftRadius: Radius.lg,
  },
  settingRowImage: {
    width: 28,
    height: 28,
  },
  settingTextBlock: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  settingDesc: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    // A touch taller than the footnote default, since descriptions here run to
    // full sentences rather than a single short line.
    lineHeight: 18,
    opacity: 0.95,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  pillDanger: {
    backgroundColor: `${DANGER}20`,
    borderColor: `${DANGER}c0`,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  pillTextDanger: {
    color: DANGER,
  },
});
