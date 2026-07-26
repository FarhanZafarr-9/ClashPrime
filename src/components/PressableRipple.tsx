import { type ReactNode } from 'react';
import { type StyleProp, type ViewStyle, type AccessibilityRole } from 'react-native';
import { TouchableRipple } from 'react-native-paper';

interface Props {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  children?: ReactNode;
  disabled?: boolean;
  rippleColor?: string;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

export default function PressableRipple({
  onPress,
  style,
  hitSlop,
  children,
  disabled,
  rippleColor,
  accessibilityLabel,
  accessibilityRole,
}: Props) {
  return (
    <TouchableRipple
      borderless
      style={style}
      onPress={onPress}
      hitSlop={hitSlop}
      disabled={disabled}
      rippleColor={rippleColor}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      <>{children}</>
    </TouchableRipple>
  );
}
