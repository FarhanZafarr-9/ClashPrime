import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableRipple from './PressableRipple';
import { Colors, useTheme, Radius, Spacing } from '../theme';

const DANGER = '#F44336';

export type PillPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

function getPillPos(pos: PillPosition, topOffset: number, rightOffset: number): any {
  const style: any = { position: 'absolute', zIndex: 10 };
  const [vert, hor] = pos.split('-');
  if (vert === 'top') style.top = -8 + topOffset;
  if (vert === 'center') { style.top = '50%'; style.marginTop = -8; }
  if (vert === 'bottom') style.bottom = -8;
  if (hor === 'left') style.left = 12;
  if (hor === 'right') style.right = 12 + rightOffset;
  if (pos === 'center') { style.left = '50%'; style.transform = [{ translateX: -50 }]; }
  return style;
}

interface SettingRowProps {
  icon?: string;
  iconUrl?: string;
  iconSource?: ImageSourcePropType;
  title: string;
  desc?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  pillText?: string;
  pillPosition?: PillPosition;
  pillTopOffset?: number;
  pillRightOffset?: number;
  destructive?: boolean;
  accentColor?: string;
  isExtra?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  compact?: boolean;
}

export function SettingRow({
  icon,
  iconUrl,
  iconSource,
  title,
  desc,
  onPress,
  onLongPress,
  children,
  disabled,
  pillText,
  pillPosition = 'top-right',
  pillTopOffset = 0,
  pillRightOffset = 0,
  destructive,
  accentColor,
  isExtra,
  isFirst,
  isLast,
  compact,
}: SettingRowProps) {
  const { colors } = useTheme();
  const accent = destructive ? DANGER : accentColor || null;
  return (
    <View style={styles.settingRowContainer}>
      {pillText && (
        <View style={getPillPos(pillPosition, pillTopOffset, pillRightOffset)}>
          <View style={[styles.pill, destructive ? styles.pillDanger : { backgroundColor: colors.textPrimary, borderColor: colors.border }]}>
            <Text style={[styles.pillText, destructive ? styles.pillTextDanger : { color: colors.bg }]}>{pillText}</Text>
          </View>
        </View>
      )}
      <PressableRipple
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={[
          styles.settingBlock,
          compact && styles.settingBlockCompact,
          { backgroundColor: isExtra ? colors.accentGhost : colors.bgCard, borderColor: colors.border },
          accent && { backgroundColor: `${accent}1a`, borderColor: `${accent}40` },
          disabled && styles.settingBlockDisabled,
          isFirst && styles.settingBlockFirst,
          isLast && styles.settingBlockLast,
        ]}
      >
        {(icon || iconSource || iconUrl) && (
          <View style={[
            styles.settingRowIcon,
            accent && { backgroundColor: `${accent}2e` },
            isFirst && styles.settingRowIconFirst,
            isLast && styles.settingRowIconLast,
          ]}>
            {iconSource ? (
              <Image source={iconSource} style={styles.settingRowImage} resizeMode="contain" />
            ) : iconUrl ? (
              <Image source={{ uri: iconUrl }} style={styles.settingRowImage} resizeMode="contain" />
            ) : (
              <Ionicons
                name={icon as any}
                size={15}
                color={accent || colors.textPrimary}
              />
            )}
          </View>
        )}
        <View style={styles.settingTextBlock}>
          <Text style={[styles.settingTitle, accent && { color: accent }]}>{title}</Text>
          {desc != null
            ? typeof desc === 'string'
              ? <Text style={[styles.settingDesc, accent && { color: accent }]}>{desc}</Text>
              : desc
            : null}
        </View>
        {children}
      </PressableRipple>
    </View>
  );
}

const styles = StyleSheet.create({
  settingRowContainer: {
    position: 'relative',
  },
  settingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
  },
  settingBlockCompact: {
    paddingHorizontal: Spacing.md,
  },
  settingBlockDisabled: {
    opacity: 0.5,
  },
  settingBlockFirst: {
    borderTopLeftRadius: Radius.xl * 1.25,
    borderTopRightRadius: Radius.xl * 1.25,
  },
  settingBlockLast: {
    borderBottomLeftRadius: Radius.xl * 1.25,
    borderBottomRightRadius: Radius.xl * 1.25,
  },
  settingRowIcon: {
    marginRight: 4,
    backgroundColor: Colors.bgCardHover,
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRowIconFirst: {
    borderTopLeftRadius: Radius.lg,
  },
  settingRowIconLast: {
    borderBottomLeftRadius: Radius.lg,
  },
  settingRowImage: {
    width: 28,
    height: 28,
  },
  settingTextBlock: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
    opacity: 0.85,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  pillDanger: {
    backgroundColor: `${DANGER}20`,
    borderColor: `${DANGER}c0`,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  pillTextDanger: {
    color: DANGER,
  },
});
