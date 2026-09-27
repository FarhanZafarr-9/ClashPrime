import React, { useRef, type ReactNode, type RefObject } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  type LayoutChangeEvent,
  type View as RNView,
} from 'react-native';
import PressableRipple from '../PressableRipple';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { useShareImage } from '../../hooks/useShareImage';

export type SharePreviewModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Fixed capture width so the rendered card matches the exported image. */
  cardWidth: number;
  children: (state: { measure: { width: number; height: number } | null }) => ReactNode;
  /** Set when the card cannot be captured yet (e.g. remote art still loading). */
  ready?: boolean;
  onError?: (message: string) => void;
  shareRef?: RefObject<RNView | null>;
  shareTitle?: string;
  /** Rendered above the card, e.g. a Home/Builder Base toggle. */
  header?: ReactNode;
};

export function shareCardWidthFor(windowWidth: number) {
  return Math.min(windowWidth - 50, 520);
}

export default function SharePreviewModal({
  visible,
  onClose,
  cardWidth,
  children,
  ready = true,
  onError,
  shareRef,
  shareTitle,
  header,
}: SharePreviewModalProps) {
  const [measure, setMeasure] = React.useState<{ width: number; height: number } | null>(null);
  const fallbackRef = useRef<RNView>(null);
  const ref = shareRef ?? fallbackRef;
  const { share, sharing } = useShareImage(ref);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMeasure((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }));
  };

  const handleShare = async () => {
    const err = await share(shareTitle ? { dialogTitle: shareTitle } : {});
    if (err) onError?.(err);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.stack}>
          {header}
          <View collapsable={false} ref={ref} onLayout={handleLayout}>
            {children({ measure })}
          </View>
          <View style={[styles.actions, { width: cardWidth }]}>
            <PressableRipple style={styles.ghost} onPress={onClose}>
              <Text style={styles.ghostText}>Close</Text>
            </PressableRipple>
            <PressableRipple
              style={[styles.primary, (sharing || !ready) && { opacity: 0.5 }]}
              disabled={sharing || !ready}
              onPress={handleShare}
            >
              {sharing || !ready ? (
                <ActivityIndicator size="small" color={Colors.bg} />
              ) : (
                <Text style={styles.primaryText}>Share</Text>
              )}
            </PressableRipple>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function useShareCardWidth() {
  const { width } = useWindowDimensions();
  return shareCardWidthFor(width);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  stack: {
    alignSelf: 'stretch',
    maxWidth: 520,
    alignItems: 'center',
    gap: Spacing.base,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignSelf: 'center',
  },
  ghost: {
    flex: 1,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  primary: {
    flex: 1,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    ...Typography.headline,
    color: Colors.bg,
  },
});
