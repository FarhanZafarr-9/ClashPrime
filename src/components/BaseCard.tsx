import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  name: string;
  category: string;
  townHallLevel: number;
  rating: number;
  tags: string[];
  previewImage?: string;
  views?: string;
  downloads?: number;
  year?: number | null;
  updated?: boolean;
  isFavorite?: boolean;
  hasLink?: boolean;
  onCopy?: () => void;
  onFavorite?: () => void;
}

export function BaseCard({
  name,
  category,
  townHallLevel,
  rating = 0,
  tags = [],
  previewImage,
  views,
  downloads,
  year,
  updated,
  isFavorite,
  hasLink,
  onCopy,
  onFavorite,
}: Props) {
  const safeRating = typeof rating === 'number' && !isNaN(rating) ? rating : 0;
  const safeTags = Array.isArray(tags) ? tags : [];

  return (
    <View style={styles.card}>
      <View style={styles.thumbnail}>
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
        {views ? (
          <View style={styles.viewsBadge}>
            <Ionicons name="eye" size={10} color={Colors.textTertiary} />
            <Text style={styles.viewsText}>{views}</Text>
          </View>
        ) : null}
        {downloads && downloads > 0 ? (
          <View style={styles.votesBadge}>
            <Ionicons name="arrow-up" size={10} color={Colors.textTertiary} />
            <Text style={styles.viewsText}>{downloads}</Text>
          </View>
        ) : null}
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
            <Text style={styles.name} numberOfLines={2}>{name}</Text>
            <Text style={styles.category}>{category.toUpperCase()}</Text>
          </View>
          <Pressable onPress={onFavorite} hitSlop={8} style={styles.favBtn}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={18}
              color={isFavorite ? Colors.textPrimary : Colors.textTertiary}
            />
          </Pressable>
        </View>
        {safeTags.length > 0 && (
          <View style={styles.tags}>
            {safeTags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
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
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.base,
  },
  thumbnail: {
    height: 140,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
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
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ratingText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  viewsBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  votesBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    left: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
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
    borderWidth: 1,
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
  category: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 3,
    letterSpacing: 0.8,
  },
  favBtn: {
    padding: Spacing.xs,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.accentSubtle,
    borderRadius: Radius.full,
  },
  tagText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
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
