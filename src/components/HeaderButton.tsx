import { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import PressableRipple from './PressableRipple';
import { Colors, Radius } from '../theme';

interface Props {
  onPress?: () => void;
  onLongPress?: () => void;
  children?: ReactNode;
  disabled?: boolean;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button';
  /**
   * Swaps the icon for a spinner and blocks presses. Preferred over passing
   * `disabled` alone, since a disabled button still shows its icon and gives no
   * sign that the work it started is still running.
   */
  loading?: boolean;
  /**
   * Tints the button for a meaning-carrying action (warnings, destructive steps)
   * instead of the neutral header treatment. The frame stays dashed either way,
   * so a tinted button is still recognisably a header button.
   */
  tone?: 'neutral' | 'warning';
  style?: object;
}

/**
 * The square action button used in screen headers, across every screen.
 *
 * These were previously redefined per screen (headerBtn, switchBtn,
 * refreshBtn, headerRefreshBtn, currentBtn) and had drifted apart: several
 * different backgrounds, two radii, and only one with a border. Anything added
 * to a header goes through this instead so the treatment stays identical.
 */
export default function HeaderButton({
  onPress,
  onLongPress,
  children,
  disabled,
  hitSlop = 8,
  accessibilityLabel,
  accessibilityRole,
  loading = false,
  tone = 'neutral',
  style,
}: Props) {
  const tinted = tone === 'warning';
  const inert = disabled || loading;

  return (
    <PressableRipple
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={inert}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[
        styles.btn,
        tinted ? styles.btnWarning : styles.btnNeutral,
        inert && styles.btnInert,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tinted ? Colors.warning : Colors.textSecondary} />
      ) : (
        children
      )}
    </PressableRipple>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    // Dashed at 1 rather than a 0.75 hairline: RN scales dash length and gap
    // with borderWidth, so a hairline packs the dashes close enough to read as
    // a solid rule, and Android drops them entirely below 1.
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  btnNeutral: {
    backgroundColor: Colors.bgCardHover,
  },
  btnWarning: {
    borderColor: Colors.warning + '60',
    backgroundColor: Colors.warning + '20',
  },
  btnInert: {
    opacity: 0.6,
  },
});