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
  /** Omitted only for plain rows, which show no level or progress at all. */
  level?: number;
  maxLevel?: number;
  thMaxLevel?: number | null;
  /**
   * 'progress' draws a level badge and a progress bar. 'plain' is a label/value
   * row with neither, for stat lines and countdowns that have no levels to track.
   */
  variant?: 'progress' | 'plain';
  subtitle?: string;
  /** Overrides the subtitle colour, e.g. to flag an expired countdown. */
  subtitleColor?: string;
  costLabel?: string;
  costResources?: Record<string, number>;
  timeLabel?: string;
  /** Right-hand value for plain rows. Strings get the row's value styling; nodes are rendered as-is. */
  rightValue?: React.ReactNode;
  rightValueColor?: string;
  icon?: string | number;
  iconSource?: ImageSourcePropType;
  /** Ionicons glyph for the icon slot, used when there is no artwork to show. */
  iconName?: keyof typeof Ionicons.glyphMap;
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
  /** Slot at the far right of the row after the badges, e.g. a Town Hall image. */
  trailing?: React.ReactNode;
  /** Draws a dashed outline, for an "add" row that is not real data yet. */
  dashed?: boolean;
}

export function ItemCard({ name, level, maxLevel, thMaxLevel, variant = 'progress', subtitle, subtitleColor, costLabel, costResources, timeLabel, rightValue, rightValueColor, icon, iconSource, iconName, onPress, locked, isFirst, isLast, actionIcon, actionText, onActionPress, actionPosition = 'after', actionColor, actionAccessibilityLabel, actionIcon2, actionText2, onActionPress2, actionPosition2 = 'after', actionColor2, actionAccessibilityLabel2, dimmed, hideLevelBadge, subtitleWithBar, footer, trailing, dashed }: Props) {
  const { colors } = useTheme();
  const isPlain = variant === 'plain';
  const currentLevel = level ?? 0;
  const effectiveMax = thMaxLevel != null && thMaxLevel > 0 ? thMaxLevel : (maxLevel ?? 0);
  const progress = effectiveMax > 0 ? currentLevel / effectiveMax : 0;
  const isMaxed = !isPlain && currentLevel >= effectiveMax;
  const levels = formatCompact(currentLevel);
  const max = formatCompact(effectiveMax);

  // A subtitle and cost chips share one line when both are present, so a row
  // never stacks three lines of text under the name. Without a subtitle the
  // chips keep their own line above the progress bar.
  const chipsInline = !isPlain && !!subtitle && !!costResources;
  // With inline chips the bar line carries only the time; repeating the cost
  // breakdown there would just print what the chips already show.
  const barText = chipsInline
    ? (timeLabel ?? '')
    : [costLabel, timeLabel].filter(Boolean).join(' · ');
  const subtitleWithChips = (
    <View style={[styles.subtitleRow, subtitleWithBar && styles.subtitleRowWithBar]}>
      <Text style={[styles.subtitle, styles.subtitleGrow]} numberOfLines={1}>{subtitle}</Text>
      <ResourceCostChips byResource={costResources!} compact />
    </View>
  );

  const has1 = !!(actionIcon || actionText);
  const has2 = !!(actionIcon2 || actionText2);
  const showLevelBadge = !isPlain && !hideLevelBadge;
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
      dashed && styles.cardDashed,
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
          ) : iconName ? (
            <Ionicons name={iconName} size={18} color={colors.textSecondary} />
          ) : (
            <Text style={styles.iconText}>{name.charAt(0)}</Text>
          )}
        </View>

        <View style={styles.middle}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {isPlain ? (
            subtitle ? <Text style={[styles.subtitle, subtitleColor ? { color: subtitleColor } : null]} numberOfLines={1}>{subtitle}</Text> : null
          ) : (
          <>
          {subtitle && subtitleWithBar ? (
            chipsInline ? subtitleWithChips : (
              <Text style={[styles.subtitle, { marginBottom: -8, marginTop: -4 }]} numberOfLines={1}>{subtitle}</Text>
            )
          ) : null}
          {subtitle && !subtitleWithBar ? (
            chipsInline ? subtitleWithChips : (
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            )
          ) : locked ? (
            <Text style={styles.lockedHint}>Not yet unlocked</Text>
          ) : costResources && !chipsInline ? (
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
          ) : barText ? (
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
                {barText}
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
          </>
          )}
          {footer}
        </View>

        <View style={[styles.right, isPlain && styles.rightPlain, (badge1 || badge2 || rightValue != null) && !locked ? styles.rightWithAction : null]}>
          {isPlain ? (
            <>
              {rightValue != null ? (
                typeof rightValue === 'string' || typeof rightValue === 'number' ? (
                  <Text
                    style={[
                      styles.rightValue,
                      rightValueColor ? { color: rightValueColor } : null,
                    ]}
                  >
                    {rightValue}
                  </Text>
                ) : rightValue
              ) : null}
              {actionPosition === 'before' ? badge1 : null}
              {actionPosition2 === 'before' ? badge2 : null}
              {actionPosition === 'after' ? badge1 : null}
              {actionPosition2 === 'after' ? badge2 : null}
            </>
          ) : locked ? (
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
                  currentLevel > 100 && { fontSize: 9, lineHeight: 10 }
                ]}>
                  {levels}
                </Text>
                <Text style={[
                  styles.levelBadgeLabel,
                  isMaxed && styles.levelBadgeTextMaxed,
                  currentLevel > 100 && { fontSize: 7, lineHeight: 9 }
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
        {trailing != null ? (
          <View style={[
            styles.trailing,
            isFirst && { borderTopRightRadius: Radius.lg },
            isLast && rightmost == null && { borderBottomRightRadius: Radius.lg },
          ]}>
            {trailing}
          </View>
        ) : null}
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
  cardDashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
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
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  /** Pulls the row up so an inline chip line sits tight under the name. */
  subtitleRowWithBar: {
    marginTop: -2,
    marginBottom: -10,
  },
  subtitleGrow: {
    flex: 1,
    marginTop: 0,
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
  /** Plain rows size to their content, so an absent value leaves no dead space. */
  rightPlain: {
    minWidth: 0,
  },
  rightValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  trailing: {
    width: 32,
    height: 32,
    marginLeft: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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