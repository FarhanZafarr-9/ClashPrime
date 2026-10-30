import React, { useEffect } from 'react';
import {
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { interpolate, interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import PressableRipple from './PressableRipple';
import { useTheme } from '../theme';

interface Props {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  /** Extra container styling, e.g. margins. */
  style?: StyleProp<ViewStyle>;
}

const TRACK_WIDTH = 58;
const TRACK_HEIGHT = 32;
const TRACK_BORDER = 2;
const TRACK_PADDING = 2;
const BALL_SIZE = 24;
const TRAVEL = TRACK_WIDTH - TRACK_BORDER * 2 - TRACK_PADDING * 2 - BALL_SIZE;

/**
 * Material-style switch with a highlighted track and state icons on the thumb.
 */
export default function Switch({ value, onValueChange, disabled, style }: Props) {
  const { colors } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, {
      duration: 180,
      reduceMotion: ReduceMotion.System,
    });
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.textMuted, colors.textPrimary]),
    borderColor: interpolateColor(progress.value, [0, 1], [colors.textTertiary, colors.textPrimary]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [colors.textSecondary, colors.bgCard]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [0, TRAVEL]) }],
  }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const crossStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return (
    <PressableRipple
      onPress={() => onValueChange?.(!value)}
      disabled={disabled}
      hitSlop={8}
      borderless
      style={[styles.press, disabled && styles.disabled, style]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.ball, thumbStyle]}>
          <Animated.View style={[styles.icon, crossStyle]} collapsable={false} accessible={false} importantForAccessibility="no-hide-descendants">
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M7 7L17 17M17 7L7 17" stroke={colors.bgCard} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.icon, checkStyle]} collapsable={false} accessible={false} importantForAccessibility="no-hide-descendants">
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M5 12L10 17L19 7" fill="none" stroke={colors.textPrimary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </PressableRipple>
  );
}

const styles = StyleSheet.create({
  press: {
    alignSelf: 'center',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: TRACK_BORDER,
    padding: TRACK_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
  },
  icon: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BALL_SIZE,
    height: BALL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
