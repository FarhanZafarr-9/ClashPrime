import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableRipple from './PressableRipple';
import { Colors, useTheme, Radius, Spacing } from '../theme';

const DANGER = '#F44336';

/**
 * Whether the row is currently drawing on its inverted surface.
 *
 * An expanded row fills with the text colour and prints the surface colour, so
 * anything a caller passes as `desc` or `children` has to flip too - otherwise
 * dark text lands on a dark fill. SettingRow can only recolour what it owns, so
 * custom nodes read this instead. `useSettingRowSurface()` returns false outside
 * a row, which is the safe default for the normal surface.
 */
const SettingRowSurfaceContext = React.createContext(false);
export function useSettingRowSurface(): boolean {
  return React.useContext(SettingRowSurfaceContext);
}

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
  /**
   * For a row whose content is revealed underneath it. Lifts the block onto
   * bgCardHover so the open state reads at a glance and the header looks
   * continuous with what it opened, rather than joining the flat closed rows.
   */
  expanded?: boolean;
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
  expanded,
}: SettingRowProps) {
const { colors } = useTheme();
  const accent = destructive ? DANGER : accentColor || null;
  /**
   * An expanded row inverts the card - text-coloured fill, surface-coloured
   * text - so the open section is obvious at a glance. Skipped when the row
   * carries its own tint (isExtra / accent), which already owns the surface:
   * inverting those would strand accent text on a dark fill.
   */
  const inverted = !!expanded && !isExtra && !accent;
  const fg = inverted ? colors.bgCard : null;
  return (
    <View style={styles.settingRowContainer}>
      {pillText && (
        <View style={getPillPos(pillPosition, pillTopOffset, pillRightOffset)}>
          <View style={[styles.pill, destructive ? styles.pillDanger : { backgroundColor: inverted ? colors.bg : colors.textPrimary, borderColor: colors.border }]}>
            <Text style={[styles.pillText, destructive ? styles.pillTextDanger : { color: inverted ? colors.textPrimary : colors.bg }]}>{pillText}</Text>
          </View>
        </View>
      )}
      <SettingRowSurfaceContext.Provider value={inverted}>
      <PressableRipple
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={[
          styles.settingBlock,
          compact && styles.settingBlockCompact,
          { backgroundColor: isExtra ? colors.accentGhost : inverted ? colors.textPrimary : colors.bgCard, borderColor: colors.border },
          accent && { backgroundColor: `${accent}1a`, borderColor: `${accent}40` },
          disabled && styles.settingBlockDisabled,
          isFirst && styles.settingBlockFirst,
          isLast && styles.settingBlockLast,
        ]}
      >
        {(icon || iconSource || iconUrl) && (
          <View style={[
            styles.settingRowIcon,
            // The glyph knocks out of the chip, so it takes the card's colour - not the
            // chip's. Matching the chip made it invisible in both themes.
            inverted && { backgroundColor: colors.bg },
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
                // Knocks out of the inverted chip, so the glyph takes the card's
                // colour rather than the chip's.
                color={accent || colors.textPrimary}
              />
            )}
          </View>
        )}
        <View style={styles.settingTextBlock}>
          <Text style={[styles.settingTitle, accent && { color: accent }, fg && { color: fg }]}>{title}</Text>
          {desc != null
            ? typeof desc === 'string'
              ? <Text style={[styles.settingDesc, accent && { color: accent }, fg && { color: fg, opacity: 0.7 }]}>{desc}</Text>
              : desc
            : null}
        </View>
        {children}
      </PressableRipple>
      </SettingRowSurfaceContext.Provider>
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
