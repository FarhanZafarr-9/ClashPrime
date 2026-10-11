import React, { useEffect, useState } from 'react';
import {
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import PressableRipple from './PressableRipple';
import { useTheme } from '../theme';

interface Props {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  /** Extra container styling, e.g. margins. */
  style?: StyleProp<ViewStyle>;
}

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 28;
const TRACK_BORDER = 1.5;
const TRACK_PADDING = 3;
const BALL_SIZE = 18;
const TRAVEL = TRACK_WIDTH - TRACK_BORDER * 2 - TRACK_PADDING * 2 - BALL_SIZE;

/**
 * Hollow pill switch: an outlined rounded rectangle holding a single ball that
 * slides corner to corner. Nothing is filled, so the state reads from colour
 * alone — a muted outline and ball when off, the accent when on.
 */
export default function Switch({ value, onValueChange, disabled, style }: Props) {
  const { colors } = useTheme();
  const progress = useState(() => new Animated.Value(value ? 1 : 0))[0];

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [progress, value]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL],
  });

  const trackBorderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.textPrimary],
  });

  const ballColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textMuted, colors.textPrimary],
  });

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
      <Animated.View style={[styles.track, { borderColor: trackBorderColor }]}>
        <Animated.View style={[styles.ball, { backgroundColor: ballColor, transform: [{ translateX }] }]} />
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
    backgroundColor: 'transparent',
  },
  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
  },
});
