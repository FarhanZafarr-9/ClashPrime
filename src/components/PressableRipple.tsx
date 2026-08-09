import { type ReactNode, useRef, useEffect } from 'react';
import { Animated, StyleSheet, type StyleProp, type ViewStyle, type AccessibilityRole } from 'react-native';
import { TouchableRipple } from 'react-native-paper';
import { Radius } from '../theme';

const AnimatedTouchableRipple = Animated.createAnimatedComponent(TouchableRipple);

interface Props {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  children?: ReactNode;
  disabled?: boolean;
  rippleColor?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

const PRESSED_RADIUS_OFFSET = 10;

export default function PressableRipple({
  onPress,
  onLongPress,
  style,
  hitSlop,
  children,
  disabled,
  rippleColor,
  accessibilityLabel,
  accessibilityRole,
}: Props) {
  const flat = StyleSheet.flatten(style) ?? {};
  const hasCornerRadii =
    flat.borderTopLeftRadius != null ||
    flat.borderTopRightRadius != null ||
    flat.borderBottomLeftRadius != null ||
    flat.borderBottomRightRadius != null;
  const radius = !hasCornerRadii && typeof flat.borderRadius === 'number' ? flat.borderRadius : Radius.md;
  const radiusAnim = useRef(new Animated.Value(radius)).current;
  const pressedRadius = radius + PRESSED_RADIUS_OFFSET;

  useEffect(() => {
    radiusAnim.setValue(radius);
  }, [radius, radiusAnim]);

  const animateRadius = (to: number) => {
    Animated.spring(radiusAnim, {
      toValue: to,
      friction: 6,
      tension: 140,
      useNativeDriver: false,
    }).start();
  };

  return (
    <AnimatedTouchableRipple
      borderless
      style={hasCornerRadii ? flat : [flat, { borderRadius: radiusAnim }]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animateRadius(pressedRadius)}
      onPressOut={() => animateRadius(radius)}
      hitSlop={hitSlop}
      disabled={disabled}
      rippleColor={rippleColor}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      <>{children}</>
    </AnimatedTouchableRipple>
  );
}
