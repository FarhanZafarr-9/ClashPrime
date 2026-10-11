import { type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle, type AccessibilityRole, type AccessibilityState } from 'react-native';
import { TouchableRipple } from 'react-native-paper';

interface Props {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  children?: ReactNode;
  disabled?: boolean;
  rippleColor?: string;
  /** iOS pressed background (react-native-paper underlay); Android uses the ripple. */
  underlayColor?: string;
  /** Clip the ripple to the view's (rounded) bounds. Defaults to true. */
  borderless?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
}

export default function PressableRipple({
  onPress,
  onLongPress,
  style,
  hitSlop,
  children,
  disabled,
  rippleColor,
  underlayColor,
  borderless = true,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
}: Props) {
  const flat = StyleSheet.flatten(style);

  return (
    <TouchableRipple
      borderless={borderless}
      style={flat}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={hitSlop}
      disabled={disabled}
      rippleColor={rippleColor}
      underlayColor={underlayColor}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
    >
      <>{children}</>
    </TouchableRipple>
  );
}