import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { Skeleton } from './Skeleton';

interface Props {
  name: string;
  townHallLevel: number;
  rating: number;
  tags: string[];
  previewImage?: string;
  views?: string;
  downloads?: number;
  year?: number | null;
  updated?: boolean;
  isFavorite?: boolean;
  isSaved?: boolean;
  hasLink?: boolean;
  onCopy?: () => void;
  onFavorite?: () => void;
  onSave?: () => void;
}

export function BaseCard({
  name,
  townHallLevel,
  rating = 0,
  tags,
  previewImage,
  views,
  downloads,
  year,
  updated,
  isFavorite,
  isSaved,
  hasLink,
  onCopy,
  onFavorite,
  onSave,
}: Props) {
  const safeRating = typeof rating === 'number' && !isNaN(rating) ? rating : 0;
  return (
    <View style={styles.card}>
      <View style={styles.thumbnail}>
        <Skeleton width="100%" height="100%" borderRadius={0} />
        {previewImage ? (
          <Image
            source={{ uri: previewImage }}
            style={styles.thumbImage}
            resizeMode="cover"
          />
        ) : (
          <Text style={styles.thText}>TH{townHallLevel}</Text>
        )}
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
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
          </View>
          <View style={styles.actionRow}>
            <Pressable onPress={onSave} hitSlop={8} style={styles.actionBtn}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSaved ? Colors.textPrimary : Colors.textTertiary}
              />
            </Pressable>
            <Pressable onPress={onFavorite} hitSlop={8} style={styles.actionBtn}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorite ? Colors.textPrimary : Colors.textTertiary}
              />
            </Pressable>
          </View>
        </View>
        {hasLink ? (
          <Pressable onPress={onCopy} style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={14} color={Colors.bg} />
            <Text style={styles.copyText}>Copy Layout</Text>
          </Pressable>
        ) : (
          <View style={[styles.copyBtn, styles.copyBtnDisabled]}>
            <Ionicons name="copy-outline" size={14} color={Colors.textMuted} />
            <Text style={[styles.copyText, styles.copyTextDisabled]}>No Link Available</Text>
          </View>
        )}
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
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    padding: Spacing.xs,
  },
  favBtn: {
    padding: Spacing.xs,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  copyBtnDisabled: {
    backgroundColor: Colors.bgSubtle,
  },
  copyText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  copyTextDisabled: {
    color: Colors.textMuted,
  },
});
