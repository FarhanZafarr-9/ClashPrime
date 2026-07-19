import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { getBuildingLevelImageSource, getBuildingAvailableLevels } from '../../src/utils/buildingImages';
import { Card } from '../../src/components/Card';
import { SectionHeader } from '../../src/components/SectionHeader';
import thLevelsData from '../../src/data/th-levels.json';

const SHOW_CATEGORIES = ['Defenses', 'Resources', 'Traps', 'Army', 'Siege Machines', 'Walls'];

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Defenses': 'shield-checkmark-outline',
  'Resources': 'wallet-outline',
  'Traps': 'warning-outline',
  'Army': 'people-outline',
  'Siege Machines': 'construct-outline',
  'Walls': 'grid-outline',
};

const NAME_FIX: Record<string, string> = {
  'Lab': 'Laboratory',
  'Walls': 'Wall',
  'Builder Hut': "Builder's Hut",
};

function LevelThumb({ name, level, isCurrent }: { name: string; level: number; isCurrent: boolean }) {
  const lookupName = NAME_FIX[name] ?? name;
  const imgSource = getBuildingLevelImageSource(lookupName, level);

  if (imgSource) {
    return (
      <View style={[styles.levelThumbWrap, isCurrent && styles.levelThumbCurrent]}>
        <Image source={imgSource} style={styles.levelThumbImg} resizeMode="contain" />
        <Text style={[styles.levelThumbLabel, isCurrent && styles.levelThumbLabelCurrent]}>
          {level}
        </Text>
      </View>
    );
  }

  const initials = name.split(/[\s.]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[styles.levelThumbWrap, isCurrent && styles.levelThumbCurrent]}>
      <View style={[styles.levelThumbImg, styles.levelThumbFallback]}>
        <Text style={styles.levelThumbFallbackText}>{initials}</Text>
      </View>
      <Text style={[styles.levelThumbLabel, isCurrent && styles.levelThumbLabelCurrent]}>
        {level}
      </Text>
    </View>
  );
}

function BuildingCard({ name, maxLvl, isMaxed, th }: { name: string; maxLvl: number; isMaxed: boolean; th: number }) {
  const [expanded, setExpanded] = useState(false);
  const lookupName = NAME_FIX[name] ?? name;
  const availableLevels = getBuildingAvailableLevels(lookupName);
  const levelsToShow = availableLevels.filter((l) => l <= maxLvl);

  const mainImgSource = getBuildingLevelImageSource(lookupName, maxLvl);

  return (
    <Card style={styles.itemCard}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={styles.itemRow}>
          {mainImgSource ? (
            <Image source={mainImgSource} style={styles.itemIcon} resizeMode="contain" />
          ) : (
            <View style={styles.itemIcon}>
              <Text style={styles.itemIconText}>
                {name.split(/[\s.]+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>{name}</Text>
            <Text style={styles.itemLevel}>
              Max Lv {maxLvl}
              {isMaxed ? '  · Maxed' : ''}
              {availableLevels.length > 0 ? `  · ${levelsToShow.length} models` : ''}
            </Text>
          </View>
          <Text style={styles.expandArrow}>{expanded ? '▾' : '▸'}</Text>
        </View>
      </Pressable>

      {expanded && levelsToShow.length > 0 && (
        <View style={styles.levelStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelStripContent}>
            {levelsToShow.map((lvl) => (
              <LevelThumb key={lvl} name={name} level={lvl} isCurrent={lvl === maxLvl} />
            ))}
          </ScrollView>
        </View>
      )}
    </Card>
  );
}

export default function BuildingsScreen() {
  const { player } = usePlayer();
  const th = player?.townHallLevel ?? 1;
  const categories = thLevelsData.categories as any as Record<string, Record<string, Record<string, { level: number | null; isMaxLevel: boolean }>>>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Buildings</Text>
          <Text style={styles.subtitle}>Max levels for TH{th} · Tap to see models</Text>
        </View>

        {SHOW_CATEGORIES.map((cat) => {
          const items = categories[cat];
          if (!items) return null;
          const entries = Object.entries(items).filter(([, thData]) => {
            const thEntry = thData[String(th)];
            return thEntry != null && (thEntry.level ?? 0) > 0;
          });
          if (entries.length === 0) return null;

          return (
            <View key={cat}>
              <SectionHeader icon={CATEGORY_ICONS[cat]} title={cat} />
              {entries.map(([name, thData]) => {
                const thEntry = thData[String(th)];
                const maxLvl = thEntry?.level ?? 0;
                const isMaxed = thEntry?.isMaxLevel ?? false;

                return (
                  <BuildingCard
                    key={name}
                    name={name}
                    maxLvl={maxLvl}
                    isMaxed={isMaxed}
                    th={th}
                  />
                );
              })}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  itemCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    overflow: 'hidden',
  },
  itemIconText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 44,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  itemLevel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  expandArrow: {
    ...Typography.body,
    color: Colors.textTertiary,
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  levelStrip: {
    marginTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  levelStripContent: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
  },
  levelThumbWrap: {
    alignItems: 'center',
    gap: 4,
  },
  levelThumbCurrent: {
    opacity: 1,
  },
  levelThumbImg: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  levelThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelThumbFallbackText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 10,
  },
  levelThumbLabel: {
    color: Colors.textTertiary,
    fontSize: 10,
  },
  levelThumbLabelCurrent: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
});
