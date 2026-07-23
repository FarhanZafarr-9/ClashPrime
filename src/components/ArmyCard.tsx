import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography, useTheme } from '../theme';
import { getTownHallImageUrl } from '../utils/thImages';
import type { ClashArmy, UnitDef, EquipmentDef, PetDef } from '../types/armies';

interface Props {
  army: ClashArmy;
  unitsById: Map<number, UnitDef>;
  equipmentById: Map<number, EquipmentDef>;
  petsById: Map<number, PetDef>;
  isFavorite?: boolean;
  isSaved?: boolean;
  onFavorite?: () => void;
  onSave?: () => void;
  onCopy?: () => void;
  onPress?: () => void;
}

function DetailTable({ rows, label }: { rows: { name: string; value: string }[]; label?: string }) {
  if (rows.length === 0) return null;
  const mid = Math.ceil(rows.length / 2);
  const left = rows.slice(0, mid);
  const right = rows.slice(mid);
  return (
    <View>
      {label && <Text style={styles.sectionLabel}>{label}</Text>}
      <View style={styles.detailTable}>
        <View style={styles.detailCol}>
          {left.map((r, i) => (
            <View key={`l-${i}`} style={styles.detailRow}>
              <Text style={styles.detailName} numberOfLines={1}>{r.name}</Text>
              <Text style={styles.detailCount}>{r.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailCol}>
          {right.map((r, i) => (
            <View key={`r-${i}`} style={styles.detailRow}>
              <Text style={styles.detailName} numberOfLines={1}>{r.name}</Text>
              <Text style={styles.detailCount}>{r.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function ArmyCard({ army, unitsById, equipmentById, petsById, isFavorite, isSaved, onFavorite, onSave, onCopy, onPress }: Props) {
  const { colors } = useTheme();

  const campUnits = army.units.filter((u) => u.home === 'armyCamp');
  const ccUnits = army.units.filter((u) => u.home === 'clanCastle');

  const troopRows = campUnits.map((u) => {
    const def = unitsById.get(u.unitId);
    return { name: def?.name || `#${u.unitId}`, value: `×${u.amount}` };
  });

  const ccRows = ccUnits.map((u) => {
    const def = unitsById.get(u.unitId);
    return { name: def?.name || `#${u.unitId}`, value: `×${u.amount}` };
  });

  // Hero rows: hero name, equipment, pet (separate columns)
  const heroRows: { hero: string; equipment: string; pet: string | null }[] = [];
  const heroMap = new Map<string, { equipment: string[]; pet: string | null }>();
  for (const eq of army.equipment) {
    const def = equipmentById.get(eq.equipmentId);
    if (def) {
      if (!heroMap.has(def.hero)) heroMap.set(def.hero, { equipment: [], pet: null });
      heroMap.get(def.hero)!.equipment.push(def.name);
    }
  }
  // Attach pets to heroes
  for (const p of army.pets) {
    const def = petsById.get(p.petId);
    if (def && heroMap.has(p.hero)) {
      heroMap.get(p.hero)!.pet = def.name;
    }
  }
  for (const [heroName, data] of heroMap) {
    heroRows.push({
      hero: heroName,
      equipment: data.equipment.join(', ') || '—',
      pet: data.pet ?? null,
    });
  }

  const hasPet = heroRows.some((r) => r.pet);

  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        {getTownHallImageUrl(army.townHall) ? (
          <Image source={{ uri: getTownHallImageUrl(army.townHall)! }} style={styles.thImage} resizeMode="contain" />
        ) : (
          <View style={styles.thBadge}>
            <Text style={styles.thBadgeText}>TH{army.townHall}</Text>
          </View>
        )}
        <View style={styles.nameSection}>
          <Text style={styles.name} numberOfLines={1}>{army.name}</Text>
          <Text style={styles.author} numberOfLines={1}>by {army.username}</Text>
        </View>
        <View style={styles.scoreSection}>
          <Ionicons name="arrow-up-circle" size={14} color={colors.textSecondary} />
          <Text style={styles.score}>{army.score}</Text>
        </View>
      </View>

      {/* Troops */}
      {troopRows.length > 0 && (
        <View style={styles.section}>
          <DetailTable rows={troopRows} label="Troops" />
        </View>
      )}

      {/* Heroes */}
      {heroRows.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Heroes</Text>
          <View style={styles.heroTable}>
            <View style={styles.heroHeader}>
              <Text style={[styles.heroHeadCell, { flex: 1.3 }]}>Hero</Text>
              <View style={styles.heroDivider} />
              <Text style={[styles.heroHeadCell, { flex: 2 }]}>Equipment</Text>
              {hasPet && <><View style={styles.heroDivider} /><Text style={[styles.heroHeadCell, { flex: 1 }]}>Pet</Text></>}
            </View>
            {heroRows.map((r, i) => (
              <View key={i} style={styles.heroRow}>
                <Text style={[styles.heroCell, { flex: 1.3, fontWeight: '600' }]} numberOfLines={1}>{r.hero}</Text>
                <View style={styles.heroDivider} />
                <Text style={[styles.heroCell, { flex: 2 }]} numberOfLines={1}>{r.equipment}</Text>
                {hasPet && <><View style={styles.heroDivider} /><Text style={[styles.heroCell, { flex: 1 }]} numberOfLines={1}>{r.pet || '—'}</Text></>}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Clan Castle */}
      {ccRows.length > 0 && (
        <View style={styles.section}>
          <DetailTable rows={ccRows} label="Clan Castle" />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <Pressable onPress={onSave} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? colors.textPrimary : colors.textTertiary} />
        </Pressable>
        <Pressable onPress={onFavorite} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={18} color={isFavorite ? colors.textPrimary : colors.textTertiary} />
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
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  thImage: {
    width: 36,
    height: 36,
  },
  thBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thBadgeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 10,
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
  section: {
    marginTop: Spacing.md,
  },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  detailTable: {
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
    textAlign: 'right',
    maxWidth: 120,
  },
  heroTable: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgSubtle,
  },
  heroHeadCell: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm + 2,
    textAlign: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  heroDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.border,
  },
  heroCell: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm + 2,
    textAlign: 'center',
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
