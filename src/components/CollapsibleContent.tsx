import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing, ReduceMotion, interpolate, runOnJS, useAnimatedStyle,
  useSharedValue, withTiming,
} from 'react-native-reanimated';

/** Measures natural content height and keeps the body mounted while closing. */
export default function CollapsibleContent({ expanded, children }: {
  expanded: boolean;
  children: React.ReactNode | (() => React.ReactNode);
}) {
  const [retained, setRetained] = React.useState(expanded);
  const expandedRef = React.useRef(expanded);
  const progress = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const [measured, setMeasured] = React.useState(false);

  const finishClosing = React.useCallback(() => {
    if (!expandedRef.current) {
      setRetained(false);
      setMeasured(false);
    }
  }, []);

  React.useLayoutEffect(() => {
    expandedRef.current = expanded;
    // Wait for the first measurement so opening never starts with zero height.
    if (expanded && !measured) return;
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: expanded ? 260 : 160,
      easing: Easing.inOut(Easing.quad),
      reduceMotion: ReduceMotion.System,
    }, (finished) => {
      if (finished && !expanded) runOnJS(finishClosing)();
    });
  }, [expanded, measured, progress, finishClosing]);

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    contentHeight.set(event.nativeEvent.layout.height);
    setRetained(true);
    setMeasured(true);
  }, [contentHeight]);
  const containerStyle = useAnimatedStyle(() => ({
    height: progress.value * contentHeight.value,
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: interpolate(progress.value, [0, 1], [-8, 0]) }],
  }));

  if (!expanded && !retained) return null;
  return (
    <Animated.View
      style={[styles.container, containerStyle]}
      pointerEvents={expanded ? 'auto' : 'none'}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
    >
      <Animated.View style={[styles.body, bodyStyle]}>
        <View onLayout={onLayout} collapsable={false}>
          {typeof children === 'function' ? children() : children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  body: { position: 'absolute', top: 0, left: 0, right: 0 },
});
