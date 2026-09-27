import React from 'react';
import { View, Text, Image, type ImageSourcePropType } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { shareStyles, ShareFooter, ShareProfile, WatermarkLines } from './share/ShareChrome';
import type { ClashPlayer } from '../types/clash';

export type ShareCategory = {
  key: string;
  label: string;
  progress: number; // 0..1
  image?: ImageSourcePropType | undefined;
};

const CATEGORY_ICONS: Record<string, { set: 'ion' | 'mc'; name: string }> = {
  heroes: { set: 'ion', name: 'shield-half-outline' },
  troops: { set: 'mc', name: 'sword-cross' },
  spells: { set: 'ion', name: 'flask-outline' },
  equipment: { set: 'ion', name: 'trophy-outline' },
  buildings: { set: 'mc', name: 'castle' },
  builderTroops: { set: 'mc', name: 'hammer-wrench' },
  builderHeroes: { set: 'mc', name: 'shield-crown' },
};

function CategoryIcon({ icon }: { icon: { set: 'ion' | 'mc'; name: string } }) {
  if (icon.set === 'mc') {
    return <MaterialCommunityIcons name={icon.name as any} size={15} color={Colors.textSecondary} />;
  }
  return <Ionicons name={icon.name as any} size={15} color={Colors.textSecondary} />;
}

type ShareCardProps = {
  player: ClashPlayer;
  categories: ShareCategory[];
  showBH?: boolean;
  subtitle?: string;
  width?: number;
  measure?: { width: number; height: number } | null;
};

export default function ShareCard({ player, categories, showBH, subtitle, width, measure }: ShareCardProps) {
  return (
    <View style={[shareStyles.card, width ? { width } : null]}>
      <WatermarkLines width={width ?? measure?.width ?? 400} height={measure?.height ?? 560} />

      <View style={shareStyles.body}>
        <ShareProfile player={player} showBH={showBH} />

        <View style={shareStyles.divider} />

        <View style={shareStyles.content}>
          <View style={shareStyles.rows}>
            {categories.map((c) => {
              const icon = CATEGORY_ICONS[c.key] ?? { set: 'ion' as const, name: 'ellipse-outline' };
              const pct = Math.max(0, Math.min(100, Math.round(c.progress * 100)));
              return (
                <View key={c.key} style={shareStyles.row}>
                  <View style={shareStyles.rowMain}>
                    {c.image ? (
                      <Image source={c.image} style={shareStyles.rowIcon} resizeMode="contain" />
                    ) : (
                      <CategoryIcon icon={icon} />
                    )}
                    <View style={shareStyles.rowBody}>
                      <View style={shareStyles.rowTop}>
                        <Text style={shareStyles.rowText} numberOfLines={1}>{c.label}</Text>
                        <Text style={shareStyles.rowPct}>{pct}%</Text>
                      </View>
                      <View style={shareStyles.track}>
                        <View style={[shareStyles.fill, { width: `${pct}%` }]} />
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <ShareFooter subtitle={subtitle} />
    </View>
  );
}
