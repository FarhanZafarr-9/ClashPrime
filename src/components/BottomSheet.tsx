import React from 'react';
import { View, Text, ScrollView, Modal, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import PressableRipple from './PressableRipple';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, Radius, useTheme } from '../theme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconSource?: ImageSourcePropType;
  header?: React.ReactNode;
  children: React.ReactNode;
}

export default function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  icon,
  iconSource,
  header,
  children,
}: BottomSheetProps) {
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <PressableRipple
          style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)' }]}
          onPress={onClose}
        />
        <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
          <View style={styles.grabberWrap}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          </View>
          <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
        </View>
      </View>
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
  card: {
    width: '100%',
    maxHeight: '72%',
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
