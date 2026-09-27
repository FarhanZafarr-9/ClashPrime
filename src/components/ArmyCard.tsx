import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import PressableRipple from './PressableRipple';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography, useTheme } from '../theme';
import { getTownHallImageSource } from '../utils/buildingImages';
import { getArmyItemImage } from '../utils/armyData';
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
  onShare?: () => void;
  onShareCard?: () => void;
  onCopy?: () => void;
  onPress?: () => void;
}

function iconFor(name: string, kind: 'troop' | 'spell' | 'siege' | 'hero' | 'pet' | 'equipment'): ImageSourcePropType | undefined {
  const variants = [
    name,
    ...(kind === 'spell' ? [`${name} Spell`, `${name} Potion`] : []),
    ...(kind === 'siege' ? [`${name} Machine`, `${name} Workshop`] : []),
    ...(kind === 'equipment' ? [`${name} Equipment`, `${name} Puppet`] : []),
  ];
  for (const v of variants) {
    const local = getArmyItemImage(v);
    if (local) return local;
  }
  return undefined;
}

function unitIcon(def?: UnitDef): ImageSourcePropType | undefined {
  if (!def) return undefined;
  const kind = def.type === 'Spell' ? 'spell' : def.type === 'Siege' ? 'siege' : 'troop';
  return iconFor(def.name, kind);
}

function DetailTable({ rows, label }: { rows: { name: string; value: string; icon?: ImageSourcePropType }[]; label?: string }) {
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
              <View style={styles.detailNameWrap}>
                {r.icon && <Image source={r.icon} style={styles.detailIcon} resizeMode="contain" />}
                <Text style={styles.detailName} numberOfLines={1}>{r.name}</Text>
              </View>
              <Text style={styles.detailCount}>{r.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.detailDivider} />
        <View style={styles.detailCol}>
          {right.map((r, i) => (
            <View key={`r-${i}`} style={styles.detailRow}>
              <View style={styles.detailNameWrap}>
                {r.icon && <Image source={r.icon} style={styles.detailIcon} resizeMode="contain" />}
                <Text style={styles.detailName} numberOfLines={1}>{r.name}</Text>
              </View>
              <Text style={styles.detailCount}>{r.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function ArmyCard({ army, unitsById, equipmentById, petsById, isFavorite, isSaved, onFavorite, onSave, onShare, onShareCard, onCopy, onPress }: Props) {
  const { colors } = useTheme();

  const campUnits = army.units.filter((u) => u.home === 'armyCamp');
  const ccUnits = army.units.filter((u) => u.home === 'clanCastle');

  const troopRows = campUnits.map((u) => {
    const def = unitsById.get(u.unitId);
    return { name: def?.name || `#${u.unitId}`, value: `×${u.amount}`, icon: unitIcon(def) };
  });

  const ccRows = ccUnits.map((u) => {
    const def = unitsById.get(u.unitId);
    return { name: def?.name || `#${u.unitId}`, value: `×${u.amount}`, icon: unitIcon(def) };
  });

  // Hero rows: hero name, equipment, pet (separate columns)
  const heroRows: { hero: string; heroIcon?: ImageSourcePropType; equipment: { name: string; icon?: ImageSourcePropType }[]; pet: { name: string; icon?: ImageSourcePropType } | null }[] = [];
  const heroMap = new Map<string, { equipment: { name: string; icon?: ImageSourcePropType }[]; pet: { name: string; icon?: ImageSourcePropType } | null }>();
  for (const eq of army.equipment) {
    const def = equipmentById.get(eq.equipmentId);
    if (def) {
      if (!heroMap.has(def.hero)) heroMap.set(def.hero, { equipment: [], pet: null });
      heroMap.get(def.hero)!.equipment.push({ name: def.name, icon: iconFor(def.name, 'equipment') });
    }
  }
  // Attach pets to heroes
  for (const p of army.pets) {
    const def = petsById.get(p.petId);
    if (def && heroMap.has(p.hero)) {
      heroMap.get(p.hero)!.pet = { name: def.name, icon: iconFor(def.name, 'pet') };
    }
  }
  for (const [heroName, data] of heroMap) {
    heroRows.push({
      hero: heroName,
      heroIcon: iconFor(heroName, 'hero'),
      equipment: data.equipment.length > 0 ? data.equipment : [{ name: '—' }],
      pet: data.pet,
    });
  }

  const hasPet = heroRows.some((r) => r.pet);
  const armyThImage = getTownHallImageSource(army.townHall);

  return (
    <PressableRipple onPress={onPress} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        {armyThImage ? (
          <Image source={armyThImage} style={styles.thImage} resizeMode="contain" />
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
              <Text style={[styles.heroHeadCell, { flex: 1.5 }]}>Equipment</Text>
              {hasPet && <><View style={styles.heroDivider} /><Text style={[styles.heroHeadCell, { flex: 1 }]}>Pet</Text></>}
            </View>
            {heroRows.map((r, i) => (
              <View key={i} style={styles.heroRow}>
                <View style={[styles.heroCell, styles.heroIconCell, { flex: 1.3 }]}>
                  {r.heroIcon && <Image source={r.heroIcon} style={styles.heroCellIcon} resizeMode="contain" />}
                  <Text style={styles.heroNameText} numberOfLines={1}>{r.hero}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={[styles.heroCell, styles.heroEquipCol, { flex: 1.5 }]}>
                  {r.equipment.map((eq, j) => (
                    <View key={j} style={[styles.heroIconCell, styles.heroEquipItem]}>
                      {eq.icon && <Image source={eq.icon} style={styles.heroCellIcon} resizeMode="contain" />}
                      <Text style={styles.heroEquipText} numberOfLines={1}>{eq.name}</Text>
                    </View>
                  ))}
                </View>
                {hasPet && <><View style={styles.heroDivider} /><View style={[styles.heroCell, styles.heroIconCell, { flex: 1 }]}>
                  {r.pet?.icon && <Image source={r.pet.icon} style={styles.heroCellIcon} resizeMode="contain" />}
                  <Text style={styles.heroNameText} numberOfLines={1}>{r.pet?.name || '—'}</Text>
                </View></>}
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
        <View style={styles.spacer} />
        <PressableRipple onPress={onSave} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? colors.textPrimary : colors.textTertiary} />
        </PressableRipple>
        <PressableRipple onPress={onFavorite} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={18} color={isFavorite ? colors.textPrimary : colors.textTertiary} />
        </PressableRipple>
        {onShare && (
          <PressableRipple onPress={onShare} hitSlop={8} style={styles.actionBtn}>
            <Ionicons name="share-outline" size={18} color={colors.textTertiary} />
          </PressableRipple>
        )}
        {onShareCard && (
          <PressableRipple onPress={onShareCard} hitSlop={8} style={styles.actionBtn}>
            <Ionicons name="image-outline" size={18} color={colors.textTertiary} />
          </PressableRipple>
        )}
      </View>
      {onCopy && (
        <PressableRipple onPress={onCopy} style={styles.copyBtn}>
          <Ionicons name="copy-outline" size={14} color={Colors.bg} />
          <Text style={styles.copyBtnText}>Copy Army</Text>
        </PressableRipple>
      )}
    </PressableRipple>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 0.75,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.sm,
  },
  thImage: {
    width: 36,
    height: 36,
    alignSelf: 'center',
  },
  thBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignSelf: 'center',
  },
  thBadgeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 10,
  },
  nameSection: {
    flex: 1,
    justifyContent: 'space-between',
  },
  name: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontSize: 15,
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
    alignSelf: 'center',
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
    borderWidth: 0.75,
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
  detailNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailIcon: {
    width: 18,
    height: 18,
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
    borderWidth: 0.75,
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
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  heroDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.border,
  },
  heroCell: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm + 2,
    textAlign: 'left',
  },
  heroIconCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
  },
  heroNameText: {
    flexShrink: 1,
    fontWeight: '500',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  heroEquipCol: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    gap: 6,
  },
  heroEquipItem: {
    justifyContent: 'flex-start',
  },
  heroEquipText: {
    flexShrink: 1,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  heroCellIcon: {
    width: 15,
    height: 15,
    flexShrink: 0,
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
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: 6,
    marginTop: Spacing.md,
  },
  copyBtnText: {
    ...Typography.caption,
    color: Colors.bg,
    fontWeight: '600',
  },
});
