import React, { useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import PressableRipple from './PressableRipple';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from './Skeleton';
import type { Village } from '../types/bases';

interface Props {
  name: string;
  townHallLevel: number;
  village?: Village;
  rating: number;
  tags: string[];
  previewImage?: string;
  views?: string;
  downloads?: number;
  year?: number | null;
  updated?: boolean;
  description?: string | null;
  builder?: string | null;
  source?: 'clashly' | 'clash-bases';
  isSaved?: boolean;
  hasLink?: boolean;
  onCopy?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onShareCard?: () => void;
}

/**
 * Owns the thumbnail so the placeholder is tied to the actual image state. A cached
 * layout can carry a dead or missing image url, and without an error handler the
 * skeleton would sit there shimmering forever instead of falling back to the hall.
 */
function BaseThumbnail({
  previewImage,
  village,
  townHallLevel,
  children,
}: {
  previewImage?: string;
  village: Village;
  townHallLevel: number;
  children?: React.ReactNode;
}) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>(
    previewImage ? 'loading' : 'failed'
  );
  const showImage = !!previewImage && status !== 'failed';

  return (
    <View style={styles.thumbnail}>
      {status === 'loading' ? <Skeleton width="100%" height="100%" borderRadius={0} /> : null}
      {showImage ? (
        <Image
          source={{ uri: previewImage }}
          style={styles.thumbImage}
          resizeMode="cover"
          onLoadEnd={() => setStatus('loaded')}
          onError={() => setStatus('failed')}
        />
      ) : null}
      {!showImage && (
        <Text style={styles.thText}>{village === 'builder' ? 'BH' : 'TH'}{townHallLevel}</Text>
      )}
      {children}
    </View>
  );
}

export function BaseCard({
  name,
  townHallLevel,
  village = 'home',
  rating = 0,
  tags,
  previewImage,
  views,
  downloads,
  year,
  updated,
  description,
  builder,
  source,
  isSaved,
  hasLink,
  onCopy,
  onSave,
  onShare,
  onShareCard,
}: Props) {
  const safeRating = typeof rating === 'number' && !isNaN(rating) ? rating : 0;
  return (
    <View style={styles.card}>
      <BaseThumbnail previewImage={previewImage} village={village} townHallLevel={townHallLevel}>
        {safeRating > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={10} color={Colors.textPrimary} />
            <Text style={styles.ratingText}>{safeRating.toFixed(1)}</Text>
          </View>
        )}
        {(views || (downloads && downloads > 0)) && (
          <View style={styles.bottomBadges}>
            {views ? (
              <View style={styles.badge}>
                <Ionicons name="eye" size={10} color={Colors.textTertiary} />
                <Text style={styles.viewsText}>{views}</Text>
              </View>
            ) : null}
            {downloads && downloads > 0 ? (
              <View style={styles.badge}>
                <Ionicons name="arrow-up" size={10} color={Colors.textTertiary} />
                <Text style={styles.viewsText}>{downloads}</Text>
              </View>
            ) : null}
          </View>
        )}
        {year ? (
          <View style={[styles.yearBadge, updated && styles.yearBadgeUpdated]}>
            {updated ? (
              <Ionicons name="refresh" size={8} color={Colors.bg} />
            ) : null}
            <Text style={styles.yearText}>{year}</Text>
          </View>
        ) : null}
      </BaseThumbnail>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {source ? (
              <Text style={styles.source} numberOfLines={1}>
                {source === 'clash-bases' ? 'Clash Bases' : 'ClashLy'}
              </Text>
            ) : null}
          </View>
          <View style={styles.actionRow}>
            <PressableRipple onPress={onSave} hitSlop={8} style={styles.actionBtn}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSaved ? Colors.textPrimary : Colors.textTertiary}
              />
            </PressableRipple>
          </View>
        </View>
        {/* clash-bases entries carry a real name, a short description, free-form
            tags and a builder credit; ClashLy-only records have none of this, so
            the block collapses and the card stays compact. */}
        {(description || tags.length > 0 || builder) ? (
          <View style={styles.metaBlock}>
            {description ? (
              <Text style={styles.description} numberOfLines={2}>{description}</Text>
            ) : null}
            {tags.length > 0 ? (
              <View style={styles.tagRow}>
                {tags.slice(0, 4).map((t) => (
                  <View key={t} style={styles.tagChip}>
                    <Text style={styles.tagText} numberOfLines={1}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {builder ? (
              <Text style={styles.builder} numberOfLines={1}>{`by ${builder}`}</Text>
            ) : null}
          </View>
        ) : null}
        {/* Apply sits between two dashed icon squares: the share-card image on
            the left, the plain share on the right. Both light up to the card
            surface while pressed. */}
        <View style={styles.footerRow}>
          {onShareCard ? (
            <PressableRipple
              onPress={onShareCard}
              hitSlop={8}
              style={styles.iconBtn}
              underlayColor={Colors.bgElevated}
            >
              <Ionicons name="image-outline" size={18} color={Colors.textSecondary} />
            </PressableRipple>
          ) : null}
          {hasLink ? (
            <PressableRipple onPress={onCopy} style={styles.applyBtn}>
              <Ionicons name="open-outline" size={14} color={Colors.bg} />
              <Text style={styles.applyText}>Apply Layout</Text>
            </PressableRipple>
          ) : (
            <View style={[styles.applyBtn, styles.applyBtnDisabled]}>
              <Ionicons name="open-outline" size={14} color={Colors.textMuted} />
              <Text style={[styles.applyText, styles.applyTextDisabled]}>No Link Available</Text>
            </View>
          )}
          <PressableRipple
            onPress={onShare}
            hitSlop={8}
            style={styles.iconBtn}
            underlayColor={Colors.bgElevated}
          >
            <Ionicons name="share-outline" size={18} color={Colors.textSecondary} />
          </PressableRipple>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.base,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1.6,
    backgroundColor: Colors.bgSubtle,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    ...StyleSheet.absoluteFill,
  },
  thText: {
    ...Typography.title1,
    color: Colors.textMuted,
  },
  ratingBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  ratingText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  bottomBadges: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  viewsText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  yearBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  yearBadgeUpdated: {
    backgroundColor: Colors.textSecondary,
    borderColor: Colors.textSecondary,
  },
  yearText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  content: {
    padding: Spacing.base,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  name: {
    ...Typography.headline,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  source: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    padding: Spacing.xs,
  },
  metaBlock: {
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  description: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tagChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentGhost,
  },
  tagText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  builder: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    // Stretch (the default) so the icon buttons take the Apply row's exact
    // height instead of growing taller with their own vertical padding.
  },
  applyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  applyBtnDisabled: {
    backgroundColor: Colors.bgSubtle,
  },
  applyText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  applyTextDisabled: {
    color: Colors.textMuted,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    borderWidth: 0.75,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardHover,
  },
});
