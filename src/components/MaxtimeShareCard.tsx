import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { shareStyles, ShareFooter, ShareProfile, WatermarkLines } from './share/ShareChrome';
import { PACKAGE_RESOURCE_IMAGES } from '../data/packageImages';
import { RESOURCE_META } from '../utils/armyData';
import { BUILDING_RESOURCE_META } from '../utils/buildingData';
import { formatCost, formatTime } from '../utils/upgradeCosts';
import type { ClashPlayer } from '../types/clash';

export type MaxtimePipeline = {
  key: string;
  label: string;
  timeSec: number;
  instant?: boolean;
  image?: ImageSourcePropType | undefined;
};

export type MaxtimeShareData = {
  showBH?: boolean;
  headlineLabel: string;
  headlineTime: number;
  headlineNote: string;
  pipelines: MaxtimePipeline[];
  resources: { key: string; amount: number }[];
  subtitle?: string;
  width?: number;
  measure?: { width: number; height: number } | null;
};

type Props = {
  player: ClashPlayer;
  data: MaxtimeShareData;
};

function resourceColor(key: string) {
  return (
    RESOURCE_META[key as keyof typeof RESOURCE_META]?.color ??
    BUILDING_RESOURCE_META[key as keyof typeof BUILDING_RESOURCE_META]?.color ??
    Colors.textSecondary
  );
}

export default function MaxtimeShareCard({ player, data }: Props) {
  const { showBH, headlineLabel, headlineTime, headlineNote, pipelines, resources, subtitle, width, measure } = data;

  return (
    <View style={[shareStyles.card, width ? { width } : null]}>
      <WatermarkLines width={width ?? measure?.width ?? 400} height={measure?.height ?? 560} />

      <View style={shareStyles.body}>
        <ShareProfile player={player} showBH={showBH} />

        <View style={shareStyles.divider} />

        <View style={shareStyles.content}>
          <View style={styles.headline}>
            <Text style={styles.headlineLabel}>{headlineLabel}</Text>
            <Text style={styles.headlineTime}>{formatTime(headlineTime)}</Text>
            <Text style={styles.headlineNote} numberOfLines={2}>{headlineNote}</Text>
          </View>

          <View style={shareStyles.rows}>
            {pipelines.map((p) => (
              <View key={p.key} style={shareStyles.row}>
                <View style={shareStyles.rowMain}>
                  {p.image ? (
                    <Image source={p.image} style={shareStyles.rowIcon} resizeMode="contain" />
                  ) : null}
                  <View style={shareStyles.rowBody}>
                    <View style={[shareStyles.rowTop, styles.rowFlat]}>
                      <Text style={shareStyles.rowText} numberOfLines={1}>{p.label}</Text>
                      <Text style={shareStyles.rowPct}>
                        {p.instant ? 'Instant' : formatTime(p.timeSec)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {resources.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Resources needed</Text>
              <View style={styles.resGrid}>
                {resources.map((r) => {
                  const icon = PACKAGE_RESOURCE_IMAGES[r.key];
                  return (
                    <View key={r.key} style={styles.resCell}>
                      {icon ? <Image source={icon} style={styles.resIcon} resizeMode="contain" /> : null}
                      <Text style={[styles.resValue, { color: resourceColor(r.key) }]}>
                        {formatCost(r.amount)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      </View>

      <ShareFooter subtitle={subtitle} />
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
  },
  headlineLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headlineTime: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },
  headlineNote: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  rowFlat: {
    marginBottom: 0,
  },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  resGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  resCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: '47%',
    flexGrow: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  resIcon: {
    width: 17,
    height: 17,
  },
  resValue: {
    ...Typography.footnote,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
