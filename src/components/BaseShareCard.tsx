import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { shareStyles, ShareFooter, WatermarkLines } from './share/ShareChrome';
import { getBuildingLevelImageSource, getTownHallImageSource } from '../utils/buildingImages';
import type { ScrapedBase } from '../types/bases';

type Props = {
  base: ScrapedBase;
  category: string;
  width?: number;
  measure?: { width: number; height: number } | null;
  onPreviewLoad?: () => void;
  onPreviewError?: () => void;
};

const previewAspect = 16 / 11;

export default function BaseShareCard({ base, category, width, measure, onPreviewLoad, onPreviewError }: Props) {
  const isBuilder = base.village === 'builder';
  const hallImage = isBuilder
    ? getBuildingLevelImageSource('Builder Hall', base.th_level)
    : getTownHallImageSource(base.th_level);
  const [previewFailed, setPreviewFailed] = React.useState(false);
  const showPreview = !!base.preview_image_url && !previewFailed;

  return (
    <View style={[shareStyles.card, width ? { width } : null]}>
      <WatermarkLines width={width ?? measure?.width ?? 400} height={measure?.height ?? 520} />

      <View style={shareStyles.body}>
        <View style={styles.header}>
          <View style={styles.headerHall}>
            {hallImage ? <Image source={hallImage} style={styles.headerHallImage} resizeMode="contain" /> : null}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.baseName} numberOfLines={2}>{base.title}</Text>
            <Text style={styles.byline} numberOfLines={1}>
              {category} · {isBuilder ? 'BH' : 'TH'}{base.th_level}
            </Text>
            <View style={styles.metaRow}>
              {base.year ? <Text style={styles.metaText}>{base.year}</Text> : null}
              {base.year && base.views ? <Text style={styles.metaDot}>·</Text> : null}
              {base.views ? <Text style={styles.metaText}>{formatCount(base.views)} views</Text> : null}
            </View>
          </View>
        </View>

        {showPreview ? (
          <View style={[styles.preview, { aspectRatio: previewAspect }]}>
            <Image
              source={{ uri: base.preview_image_url }}
              style={styles.previewImage}
              resizeMode="contain"
              onLoad={onPreviewLoad}
              onError={() => {
                setPreviewFailed(true);
                onPreviewError?.();
              }}
            />
          </View>
        ) : null}

        <View style={shareStyles.divider} />

        <View style={shareStyles.content}>
          <View style={styles.statRow}>
            <Stat label="Rating" value={base.rating_out_of_5 > 0 ? `${base.rating_out_of_5.toFixed(1)}/5` : '—'} />
            <Stat label="Likes" value={base.votes != null ? formatCount(base.votes) : '—'} />
            <Stat label="Layout" value={isBuilder ? 'Builder' : 'Home'} />
            <Stat label="State" value={base.updated ? 'Updated' : 'Original'} />
          </View>

          {base.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {base.tags.slice(0, 5).map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText} numberOfLines={1}>{t}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <ShareFooter />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerHall: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerHallImage: {
    width: 52,
    height: 52,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  baseName: {
    ...Typography.title2,
    color: Colors.textPrimary,
  },
  byline: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  metaText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 11,
  },
  metaDot: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 11,
  },
  preview: {
    width: '100%',
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.borderSubtle,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  statRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
  },
  statValue: {
    ...Typography.subhead,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: Spacing.xs,
  },
  tag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentGhost,
  },
  tagText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
