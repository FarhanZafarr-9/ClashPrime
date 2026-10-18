import React from 'react';
import { View, StatusBar, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Top inset known on the very first frame.
 *
 * `initialWindowMetrics` is hard-coded to null in safe-area-context v5, so the
 * provider starts with no insets and only receives them from an async native
 * event after the first layout. `SafeAreaView` (a native view in v5) adds its
 * own padding when that lands, so screens painted too close to the top and then
 * visibly jumped down on first mount.
 *
 * `StatusBar.currentHeight` is read from native constants at module load, so it
 * is correct on frame one. Used on Android, where it is available; other
 * platforms fall back to the provider and accept the late arrival.
 */
const SYNC_TOP_INSET = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : null;

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Which edges get inset padding. Defaults to all, matching SafeAreaView. */
  edges?: readonly ('top' | 'right' | 'bottom' | 'left')[];
}

/**
 * Screen root with stable top padding.
 *
 * A plain View rather than SafeAreaView on purpose: SafeAreaView applies its
 * inset asynchronously, which is exactly the shift this avoids.
 */
export default function Screen({ style, children, edges }: Props) {
  const insets = useSafeAreaInsets();
  const wants = (edge: 'top' | 'right' | 'bottom' | 'left') => !edges || edges.includes(edge);

  return (
    <View
      style={[
        style,
        {
          paddingTop: wants('top') ? SYNC_TOP_INSET ?? insets.top : 0,
          paddingRight: wants('right') ? insets.right : 0,
          paddingBottom: wants('bottom') ? insets.bottom : 0,
          paddingLeft: wants('left') ? insets.left : 0,
        },
      ]}
    >
      {children}
    </View>
  );
}