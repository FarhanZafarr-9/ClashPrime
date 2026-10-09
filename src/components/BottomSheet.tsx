import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  StyleSheet,
  Image,
  Platform,
  KeyboardAvoidingView,
  Animated,
  type ImageSourcePropType,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import PressableRipple from './PressableRipple';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, Radius, useTheme } from '../theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onShow?: () => void;
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconSource?: ImageSourcePropType;
  header?: React.ReactNode;
  maxHeight?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export default function BottomSheet({
  visible,
  onClose,
  onShow,
  title,
  subtitle,
  icon,
  iconSource,
  header,
  maxHeight = '72%',
  style,
  contentContainerStyle,
  children,
}: BottomSheetProps) {
  const { colors, isDark } = useTheme();
  const translateY = useState(() => new Animated.Value(600))[0];
  const backdropOpacity = useState(() => new Animated.Value(0))[0];

  const onDismissing = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 600,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const onPresented = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        onDismissing();
        onClose();
      }}
      onShow={() => {
        onPresented();
        onShow?.();
      }}
      onDismiss={onDismissing}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Animated.View
          style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)', opacity: backdropOpacity }]}
        >
          <PressableRipple style={styles.backdropPress} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.bgCard, transform: [{ translateY }], maxHeight },
            style,
          ]}
        >
          <View style={styles.grabberWrap}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          </View>
          <View style={[styles.cardHeader, { borderBottomColor: colors.border }, header && { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, }]}>
            {header !== undefined ? (
              header
            ) : (
              <>
                {iconSource ? (
                  <View style={[styles.cardIcon, { backgroundColor: colors.bgCardHover }]}>
                    <Image source={iconSource} style={styles.cardIconImage} resizeMode="contain" />
                  </View>
                ) : icon ? (
                  <View style={[styles.cardIcon, { backgroundColor: colors.bgCardHover }]}>
                    <Ionicons name={icon} size={18} color={colors.textPrimary} />
                  </View>
                ) : null}
                <View style={styles.cardHeaderText}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
                  {subtitle ? <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>{subtitle}</Text> : null}
                </View>
                <PressableRipple onPress={onClose} hitSlop={8} style={[styles.closeBtn, { backgroundColor: colors.bgCardHover }]}>
                  <Ionicons name="close" size={18} color={colors.textTertiary} />
                </PressableRipple>
              </>
            )}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.body, contentContainerStyle]}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdropPress: {
    flex: 1,
  },
  card: {
    width: '100%',
    borderTopLeftRadius: Radius.xl * 1.25,
    borderTopRightRadius: Radius.xl * 1.25,
    overflow: 'hidden',
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconImage: {
    width: 28,
    height: 28,
  },
  cardHeaderText: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    ...Typography.headline,
    fontWeight: '700',
    fontSize: 16,
  },
  cardSubtitle: {
    ...Typography.caption,
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
});