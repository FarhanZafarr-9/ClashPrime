import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import PressableRipple from './PressableRipple';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography, useTheme } from '../theme';
import { getTownHallImageSource } from '../utils/buildingImages';
import { getArmyItemImage } from '../utils/armyData';
import type { ArmyScore } from '../utils/armyScore';
import type { ClashArmy, UnitDef, EquipmentDef, PetDef } from '../types/armies';

interface Props {
  army: ClashArmy;
  unitsById: Map<number, UnitDef>;
  equipmentById: Map<number, EquipmentDef>;
  petsById: Map<number, PetDef>;
  /** How maxed the player is for this army's items, when a player is known. */
  maxed?: ArmyScore;
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

/**
 * Hero names run long ("Barbarian King") and the column is narrow, so the cell
 * shows the last word only - "King", "Queen", "Warden". The icon beside it carries
 * the class, so the short handle still reads unambiguously.
 */
function shortHeroName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
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

export function ArmyCard({ army, unitsById, equipmentById, petsById, maxed, isFavorite, isSaved, onFavorite, onSave, onShare, onShareCard, onCopy, onPress }: Props) {
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

  // Hero rows keep the three-column layout, but the equipment and pet columns
  // carry icons only - their names were 11px inside a third of the card and
  // clipped. Dashed rules keep the table reading as a plan sheet rather than a
  // data grid.
  const heroRows: { hero: string; heroIcon?: ImageSourcePropType; equipment: ImageSourcePropType[]; pet?: ImageSourcePropType }[] = [];
  const heroMap = new Map<string, { equipment: ImageSourcePropType[]; pet?: ImageSourcePropType }>();
  for (const eq of army.equipment) {
    const def = equipmentById.get(eq.equipmentId);
    if (def) {
      if (!heroMap.has(def.hero)) heroMap.set(def.hero, { equipment: [] });
      const icon = iconFor(def.name, 'equipment');
      if (icon) heroMap.get(def.hero)!.equipment.push(icon);
    }
  }
  // Attach pets to heroes
  for (const p of army.pets) {
    const def = petsById.get(p.petId);
    if (def && heroMap.has(p.hero)) {
      heroMap.get(p.hero)!.pet = iconFor(def.name, 'pet');
    }
  }
  for (const [heroName, data] of heroMap) {
    heroRows.push({
      hero: shortHeroName(heroName),
      heroIcon: iconFor(heroName, 'hero'),
      equipment: data.equipment,
      pet: data.pet,
    });
  }

  const hasPet = heroRows.some((r) => r.pet);
  const armyThImage = getTownHallImageSource(army.townHall);

  // Tone for the personal maxed badge. Green once there's little left to do, gold
  // in the middle, red early on - read from the theme so it flips with the app.
  const maxedColor = !maxed
    ? null
    : maxed.score >= 85
      ? colors.success
      : maxed.score >= 50
        ? colors.warningText
        : colors.dangerText;

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
        {maxed && maxedColor ? (
          <PressableRipple
            onPress={onPress}
            style={[styles.maxedBadge, { borderColor: `${maxedColor}55` }]}
            underlayColor={Colors.bgElevated}
          >
            <Ionicons name="cube-outline" size={11} color={maxedColor} />
            <Text style={[styles.maxedValue, { color: maxedColor }]}>{maxed.score}%</Text>
          </PressableRipple>
        ) : null}
        {onFavorite ? (
          <PressableRipple onPress={onFavorite} hitSlop={8} style={styles.actionBtn}>
            <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={18} color={isFavorite ? colors.textPrimary : colors.textTertiary} />
          </PressableRipple>
        ) : null}
        <PressableRipple onPress={onSave} hitSlop={8} style={styles.actionBtn}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? colors.textPrimary : colors.textTertiary} />
        </PressableRipple>
      </View>

      {maxed && (maxed.gaps.length > 0 || maxed.unavailable.length > 0) && (
        <View style={styles.maxedDetail}>
          {maxed.unavailable.length > 0 && (
            <View style={styles.maxedRow}>
              <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
              <Text style={styles.maxedDetailText} numberOfLines={2}>
                Not available at your TH: {maxed.unavailable.join(', ')}
              </Text>
            </View>
          )}
          {maxed.gaps.length > 0 && (
            <View style={styles.maxedRow}>
              <Ionicons name="trending-up-outline" size={11} color={colors.textMuted} />
              <Text style={styles.maxedDetailText} numberOfLines={2}>
                Biggest gaps:{' '}
                {maxed.gaps.map((g) => `${g.name} ${g.current}→${g.max}`).join(' · ')}
              </Text>
            </View>
          )}
        </View>
      )}

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
              <Text style={[styles.heroHeadCell, styles.heroHeadCellLeft, { flex: 1.3 }]}>Hero</Text>
              <View style={styles.heroVDivider} />
              <Text style={[styles.heroHeadCell, { flex: 1.5 }]}>Equipment</Text>
              {hasPet && <><View style={styles.heroVDivider} /><Text style={[styles.heroHeadCell, { flex: 1 }]}>Pet</Text></>}
            </View>
            {heroRows.map((r, i) => (
              <View key={i} style={[styles.heroRow, i === heroRows.length - 1 && styles.heroRowLast]}>
                <View style={[styles.heroCell, styles.heroHeroCell, { flex: 1.3 }]}>
                  {r.heroIcon && <Image source={r.heroIcon} style={styles.heroHeroIcon} resizeMode="contain" />}
                  <Text style={styles.heroNameText} numberOfLines={1}>{r.hero}</Text>
                </View>
                <View style={styles.heroVDivider} />
                <View style={[styles.heroCell, styles.heroSlotCell, { flex: 1.5 }]}>
                  {r.equipment.map((icon, j) => (
                    <Image key={j} source={icon} style={styles.heroSlotIcon} resizeMode="contain" />
                  ))}
                </View>
                {hasPet && (
                  <>
                    <View style={styles.heroVDivider} />
                    <View style={[styles.heroCell, styles.heroSlotCell, { flex: 1 }]}>
                      {r.pet ? <Image source={r.pet} style={styles.heroPetIcon} resizeMode="contain" /> : null}
                    </View>
                  </>
                )}
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
        {onCopy ? (
          <PressableRipple onPress={onCopy} style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={14} color={Colors.bg} />
            <Text style={styles.copyBtnText}>Copy Army</Text>
          </PressableRipple>
        ) : null}
        {onShare ? (
          <PressableRipple
            onPress={onShare}
            hitSlop={8}
            style={styles.iconBtn}
            underlayColor={Colors.bgElevated}
          >
            <Ionicons name="share-outline" size={18} color={Colors.textSecondary} />
          </PressableRipple>
        ) : null}
      </View>
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
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
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
    textAlign: 'center',
  },
  heroHeadCellLeft: {
    textAlign: 'left',
    paddingLeft: Spacing.sm + 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: Colors.border,
  },
  heroRowLast: {
    borderBottomWidth: 0,
  },
  heroVDivider: {
    width: 0,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderLeftColor: Colors.border,
    marginVertical: 2,
  },
  heroCell: {
    paddingVertical: 8,
    minWidth: 0,
    justifyContent: 'center',
  },
  heroHeroCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    paddingHorizontal: Spacing.sm + 2,
  },
  heroSlotCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 5,
    paddingHorizontal: Spacing.sm,
  },
  heroHeroIcon: {
    width: 20,
    height: 20,
    flexShrink: 0,
  },
  heroSlotIcon: {
    width: 22,
    height: 22,
    flexShrink: 0,
  },
  heroPetIcon: {
    width: 24,
    height: 24,
    flexShrink: 0,
  },
  heroNameText: {
    flexShrink: 1,
    fontWeight: '500',
    fontSize: 12,
    color: Colors.textPrimary,
  },
  maxedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 0.75,
  },
  maxedValue: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  maxedDetail: {
    marginTop: Spacing.sm,
    gap: 3,
  },
  maxedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  maxedDetailText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  actionBtn: {
    padding: Spacing.xs,
    alignSelf: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: 6,
    borderStyle: 'dashed',
    borderWidth: 0.75,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardHover,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: 6,
  },
  copyBtnText: {
    ...Typography.caption,
    color: Colors.bg,
    fontWeight: '600',
  },
});
