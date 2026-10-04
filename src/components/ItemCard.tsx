import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PressableRipple from './PressableRipple';
import { ResourceCostChips } from './ResourceCostChips';
import { formatCompact } from '../utils/buildingImages';
import { Colors, useTheme, Radius, Spacing, Typography } from '../theme';
const lockedImage = require('../../assets/images/chiefs-journey/locked.png');

interface Props {
  name: string;
  level: number;
  maxLevel: number;
  thMaxLevel?: number | null;
  subtitle?: string;
  costLabel?: string;
  costResources?: Record<string, number>;
  timeLabel?: string;
  icon?: string | number;
  iconSource?: ImageSourcePropType;
  onPress?: () => void;
  locked?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  /** Optional action badge next to the level badge. Renders only when an icon or text is given. */
  actionIcon?: keyof typeof Ionicons.glyphMap;
  /** Short text for the badge instead of an icon, e.g. a count. Wins over actionIcon. */
  actionText?: string;
  /** Tapping the badge. Without it the badge is display-only. */
  onActionPress?: () => void;
  /** Which side of the level badge the action badge sits on. Defaults to 'after'. */
  actionPosition?: 'before' | 'after';
  actionColor?: string;
  actionAccessibilityLabel?: string;
  /** A second, independent action badge. Same rules as the first. */
  actionIcon2?: keyof typeof Ionicons.glyphMap;
  actionText2?: string;
  onActionPress2?: () => void;
  actionPosition2?: 'before' | 'after';
  actionColor2?: string;
  actionAccessibilityLabel2?: string;
  /** Fades the whole card, e.g. for a row that's switched off. */
  dimmed?: boolean;
  /** Hide the level badge, e.g. when the row is maxed out and "N/N" is just noise. */
  hideLevelBadge?: boolean;
  /** Show the subtitle above the progress bar instead of replacing it. */
  subtitleWithBar?: boolean;
  /** Extra content under the progress bar, e.g. a row of preset buttons. */
  footer?: React.ReactNode;
}

export function ItemCard({ name, level, maxLevel, thMaxLevel, subtitle, costLabel, costResources, timeLabel, icon, iconSource, onPress, locked, isFirst, isLast, actionIcon, actionText, onActionPress, actionPosition = 'after', actionColor, actionAccessibilityLabel, actionIcon2, actionText2, onActionPress2, actionPosition2 = 'after', actionColor2, actionAccessibilityLabel2, dimmed, hideLevelBadge, subtitleWithBar, footer }: Props) {
  const { colors } = useTheme();
  const effectiveMax = thMaxLevel != null && thMaxLevel > 0 ? thMaxLevel : maxLevel;
  const progress = effectiveMax > 0 ? level / effectiveMax : 0;
  const isMaxed = level >= effectiveMax;
  const levels = formatCompact(level);
  const max = formatCompact(effectiveMax);

  const has1 = !!(actionIcon || actionText);
  const has2 = !!(actionIcon2 || actionText2);
  const showLevelBadge = !hideLevelBadge;
  // The rightmost badge owns the card's bottom-right corner.
  const rightmost =
    has2 && actionPosition2 === 'after' ? 'a2'
      : has1 && actionPosition === 'after' ? 'a1'
        : showLevelBadge ? 'level'
          : has2 && actionPosition2 === 'before' ? 'a2'
            : has1 && actionPosition === 'before' ? 'a1'
              : null;

  const renderAction = (
    iconName: keyof typeof Ionicons.glyphMap | undefined,
    text: string | undefined,
    onPressAction: (() => void) | undefined,
    color: string | undefined,
    label: string | undefined,
    isRightmost: boolean,
  ) => (iconName || text) ? (
    <PressableRipple
      onPress={onPressAction}
      hitSlop={6}
      style={[
        styles.actionBadge,
        isMaxed && styles.levelBadgeMaxed,
        isRightmost && isFirst && { borderTopRightRadius: Radius.lg },
        isRightmost && isLast && { borderBottomRightRadius: Radius.lg },
      ]}
      accessibilityRole={onPressAction ? 'button' : undefined}
      accessibilityLabel={label}
    >
      {text ? (
        <Text style={styles.actionBadgeText}>{text}</Text>
      ) : (
        <Ionicons name={iconName!} size={20} color={isMaxed? Colors.bgCard: color ?? colors.textSecondary} />
      )}
    </PressableRipple>
  ) : null;

  const badge1 = renderAction(actionIcon, actionText, onActionPress, actionColor, actionAccessibilityLabel, rightmost === 'a1');
  const badge2 = renderAction(actionIcon2, actionText2, onActionPress2, actionColor2, actionAccessibilityLabel2, rightmost === 'a2');

  return (
    <PressableRipple
      onPress={onPress}
      style={[styles.card,
      { backgroundColor: colors.bgCard, opacity: locked ? 0.55 : dimmed ? 0.5 : 1 },
      isFirst && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
      isLast && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl }
      ]}
    >
      <View style={styles.row}>

        <View style={[styles.iconWrap,
        isFirst && { borderTopLeftRadius: Radius.lg },
        isLast && { borderBottomLeftRadius: Radius.lg }
        ]}>
          {iconSource ? (
            <Image source={iconSource} style={styles.iconImage} resizeMode="contain" />
          ) : icon ? (
            typeof icon === 'number' ? (
              <Image source={icon} style={styles.iconImage} resizeMode="contain" />
            ) : (
              <Image source={{ uri: icon }} style={styles.iconImage} resizeMode="contain" />
            )
          ) : (
            <Text style={styles.iconText}>{name.charAt(0)}</Text>
          )}
        </View>

        <View style={styles.middle}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {subtitle && subtitleWithBar ? (
            <Text style={[styles.subtitle, { marginBottom: -8, marginTop: -4 }]} numberOfLines={1}>{subtitle}</Text>
          ) : null}
          {subtitle && !subtitleWithBar ? (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : locked ? (
            <Text style={styles.lockedHint}>Not yet unlocked</Text>
          ) : costResources ? (
            <View>
              <ResourceCostChips byResource={costResources} compact />
              <View style={[styles.progressRow, { marginTop: 4 }]}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(progress, 1) * 100}%`,
                        backgroundColor: isMaxed ? Colors.warning : Colors.textSecondary,
                      },
                    ]}
                  />
                </View>
                {timeLabel ? (
                  <Text style={styles.timeLabel} numberOfLines={1}>{timeLabel}</Text>
                ) : null}
              </View>
            </View>
          ) : costLabel || timeLabel ? (
            <View style={styles.progressRow}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(progress, 1) * 100}%`,
                      backgroundColor: isMaxed ? Colors.warning : Colors.textSecondary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.timeLabel} numberOfLines={1}>
                {[costLabel, timeLabel].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : (
            <View style={styles.progressContainer}>
              <View style={[styles.progressTrack, styles.progressTrackSolo]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(progress, 1) * 100}%`,
                      backgroundColor: isMaxed ? Colors.warning : Colors.textSecondary,
                    },
                  ]}
                />
              </View>
            </View>
          )}
          {footer}
        </View>

        <View style={[styles.right, badge1 || badge2 ? styles.rightWithAction : null]}>
          {locked ? (
            <View style={styles.lockedBadge}>
              <Image source={lockedImage} style={styles.lockedBadgeImage} resizeMode="contain" />
            </View>
          ) : (
            <>
              {actionPosition === 'before' ? badge1 : null}
              {actionPosition2 === 'before' ? badge2 : null}
              {showLevelBadge && (
              <View style={[
                styles.levelBadgeContainer,
                isMaxed && styles.levelBadgeMaxed,
                isFirst && { borderTopRightRadius: Radius.lg },
                isLast && rightmost === 'level' && { borderBottomRightRadius: Radius.lg }
              ]}>
                <Text style={[
                  styles.levelBadgeText,
                  isMaxed && styles.levelBadgeTextMaxed,
                  level > 1000 && { fontSize: 9, lineHeight: 10 }
                ]}>
                  {levels}
                </Text>
                <Text style={[
                  styles.levelBadgeLabel,
                  isMaxed && styles.levelBadgeTextMaxed,
                  level > 1000 && { fontSize: 7, lineHeight: 9 }
                ]}>
                  / {max}
                </Text>
              </View>
              )}
              {actionPosition === 'after' ? badge1 : null}
              {actionPosition2 === 'after' ? badge2 : null}
            </>
          )}
        </View>
      </View>
    </PressableRipple>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
  },
  pressed: {
    backgroundColor: Colors.bgCardHover,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  iconImage: {
    width: 32,
    height: 32,
  },
  iconText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  name: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs / 1.25,
  },
  subtitle: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 12,
    width: '100%',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: Spacing.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  // The bar-only branch sits in a column, where flex: 1 would collapse the 4px height to 0.
  progressTrackSolo: {
    flex: 0,
    alignSelf: 'stretch',
  },
  timeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 50,
  },
  rightWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.xs,
  },
  actionBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  levelBadgeContainer: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeMaxed: {
    backgroundColor: Colors.warning,
  },
  levelBadgeText: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  levelBadgeLabel: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontSize: 8,
    opacity: 0.7,
    lineHeight: 9,
  },
  levelBadgeTextMaxed: {
    color: Colors.bg,
  },
  lockedHint: {
    ...Typography.footnote,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  lockedBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedBadgeImage: {
    width: 20,
    height: 20,
  },
  lockedBadgeText: {
    ...Typography.footnote,
    color: Colors.textMuted,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});