import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { getTroopImageUrl } from '../utils/troopImages';
import { getTownHallImageUrl } from '../utils/thImages';
import type { ClashArmy, UnitDef } from '../types/armies';

interface Props {
  army: ClashArmy;
  unitsById: Map<number, UnitDef>;
  isFavorite?: boolean;
  isSaved?: boolean;
  onFavorite?: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onPress?: () => void;
}

const GRID_COLS = 6;

export function ArmyCard({ army, unitsById, isFavorite, isSaved, onFavorite, onSave, onCopy, onPress }: Props) {
  const campUnits = army.units.filter((u) => u.home === 'armyCamp');
  const ccUnits = army.units.filter((u) => u.home === 'clanCastle');
  const allCombat = [...campUnits, ...ccUnits];

  const gridRows: typeof allCombat[] = [];
  for (let i = 0; i < allCombat.length; i += GRID_COLS) {
    gridRows.push(allCombat.slice(i, i + GRID_COLS));
  }

  const thUrl = getTownHallImageUrl(army.townHall);

  const detailRows: { name: string; count: number }[] = allCombat.map((u) => {
    const def = unitsById.get(u.unitId);
    return { name: def?.name || `#${u.unitId}`, count: u.amount };
  });

  const midPoint = Math.ceil(detailRows.length / 2);
  const leftCol = detailRows.slice(0, midPoint);
  const rightCol = detailRows.slice(midPoint);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        {thUrl && (
          <View style={styles.thIcon}>
            <Image source={{ uri: thUrl }} style={styles.thImage} resizeMode="contain" />
          </View>
        )}
        <View style={styles.nameSection}>
          <Text style={styles.name} numberOfLines={1}>{army.name}</Text>
          <Text style={styles.author} numberOfLines={1}>by {army.username}</Text>
        </View>
        <View style={styles.scoreSection}>
          <Ionicons name="arrow-up-circle" size={14} color={Colors.textSecondary} />
          <Text style={styles.score}>{army.score}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {gridRows.map((row, ri) => (
          <View key={ri} style={styles.gridRow}>
            {row.map((u, ci) => {
              const def = unitsById.get(u.unitId);
              const imageUrl = def ? getTroopImageUrl(def.name) : null;
              return (
                <View key={`${ri}-${ci}`} style={styles.gridCell}>
                  <View style={{ flex: 1 }} />
                </View>
              );
            })}
            {row.length < GRID_COLS && <View style={{ flex: GRID_COLS - row.length }} />}
          </View>
        ))}
      </View>

      {detailRows.length > 0 && (
        <View style={styles.detailTable}>
          <View style={styles.detailCol}>
            {leftCol.map((d, i) => (
              <View key={`l-${i}`} style={styles.detailRow}>
                <Text style={styles.detailName} numberOfLines={1}>{d.name}</Text>
                <Text style={styles.detailCount}>×{d.count}</Text>
              </View>
            ))}
          </View>
          <View style={styles.detailDivider} />
          <View style={styles.detailCol}>
            {rightCol.map((d, i) => (
              <View key={`r-${i}`} style={styles.detailRow}>
                <Text style={styles.detailName} numberOfLines={1}>{d.name}</Text>
                <Text style={styles.detailCount}>×{d.count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.actionsRow}>
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
        <View style={styles.spacer} />
        {onCopy && (
          <Pressable onPress={onCopy} style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={14} color={Colors.bg} />
            <Text style={styles.copyBtnText}>Copy Army</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  thIcon: {
    width: 32,
    height: 32,
  },
  thImage: {
    width: 32,
    height: 32,
  },
  thLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '600',
    fontSize: 10,
    marginRight: Spacing.xs,
  },
  nameSection: {
    flex: 1,
  },
  name: {
    ...Typography.headline,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  author: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 1,
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  score: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  grid: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
  },
  gridImage: {
    width: 48,
    height: 48,
  },
  gridFallback: {
    ...Typography.subhead,
    color: Colors.textMuted,
    fontWeight: '600',
    width: 48,
    height: 48,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 48,
  },
  detailTable: {
    marginTop: 0,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  detailCol: {
    flex: 1,
  },
  detailDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  detailName: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '500',
    fontSize: 11,
  },
  detailCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 11,
    minWidth: 28,
    textAlign: 'right',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  actionBtn: {
    padding: Spacing.xs,
  },
  spacer: {
    flex: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 6,
  },
  copyBtnText: {
    ...Typography.caption,
    color: Colors.bg,
    fontWeight: '600',
  },
});
