import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { shareStyles, ShareFooter, WatermarkLines } from './share/ShareChrome';
import { getArmyItemImage } from '../utils/armyData';
import { getTownHallImageSource } from '../utils/buildingImages';
import type { ClashArmy, UnitDef, EquipmentDef, PetDef } from '../types/armies';

type Props = {
  army: ClashArmy;
  unitsById: Map<number, UnitDef>;
  equipmentById: Map<number, EquipmentDef>;
  petsById: Map<number, PetDef>;
  width?: number;
  measure?: { width: number; height: number } | null;
};

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

function Chip({ icon, name, count }: { icon?: ImageSourcePropType; name: string; count: number }) {
  return (
    <View style={styles.chip}>
      {icon ? <Image source={icon} style={styles.chipIcon} resizeMode="contain" /> : null}
      <Text style={styles.chipName} numberOfLines={1}>{name}</Text>
      <Text style={styles.chipCount}>{count}×</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.chipGrid}>{children}</View>
    </View>
  );
}

export default function ArmyShareCard({ army, unitsById, equipmentById, petsById, width, measure }: Props) {
  const thImage = getTownHallImageSource(army.townHall);

  const camp = army.units.filter((u) => u.home === 'armyCamp');
  const campTroops = camp.filter((u) => unitsById.get(u.unitId)?.type !== 'Spell');
  const campSpells = camp.filter((u) => unitsById.get(u.unitId)?.type === 'Spell');
  const castle = army.units.filter((u) => u.home === 'clanCastle');
  const castleTroops = castle.filter((u) => unitsById.get(u.unitId)?.type !== 'Spell');
  const castleSpells = castle.filter((u) => unitsById.get(u.unitId)?.type === 'Spell');

  return (
    <View style={[shareStyles.card, width ? { width } : null]}>
      <WatermarkLines width={width ?? measure?.width ?? 400} height={measure?.height ?? 520} />

      <View style={shareStyles.body}>
        <View style={styles.header}>
          <View style={styles.headerHall}>
            {thImage ? <Image source={thImage} style={styles.headerHallImage} resizeMode="contain" /> : null}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.armyName} numberOfLines={2}>{army.name}</Text>
            <Text style={styles.byline} numberOfLines={1}>
              {army.username ? `by ${army.username}` : 'ClashArmies'} · TH{army.townHall}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{formatCount(army.score)} score</Text>
              {army.votes ? <Text style={styles.metaDot}>·</Text> : null}
              {army.votes ? <Text style={styles.metaText}>{formatCount(army.votes)} votes</Text> : null}
            </View>
          </View>
        </View>

        {army.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {army.tags.slice(0, 4).map((t) => (
              <View key={t} style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={shareStyles.divider} />

        <View style={shareStyles.content}>
          {campTroops.length > 0 ? (
            <Section title="Army Camp">
              {campTroops.map((u) => {
                const def = unitsById.get(u.unitId);
                return <Chip key={`c${u.unitId}`} icon={unitIcon(def)} name={def?.name ?? 'Unknown'} count={u.amount} />;
              })}
            </Section>
          ) : null}

          {campSpells.length > 0 ? (
            <Section title="Army Spells">
              {campSpells.map((u) => {
                const def = unitsById.get(u.unitId);
                return <Chip key={`cs${u.unitId}`} icon={unitIcon(def)} name={def?.name ?? 'Unknown'} count={u.amount} />;
              })}
            </Section>
          ) : null}

          {castleTroops.length > 0 || castleSpells.length > 0 ? (
            <Section title="Clan Castle">
              {[...castleTroops, ...castleSpells].map((u) => {
                const def = unitsById.get(u.unitId);
                return <Chip key={`cc${u.unitId}`} icon={unitIcon(def)} name={def?.name ?? 'Unknown'} count={u.amount} />;
              })}
            </Section>
          ) : null}

          {army.equipment.length > 0 ? (
            <Section title="Hero Equipment">
              {army.equipment.slice(0, 8).map((e) => {
                const def = equipmentById.get(e.equipmentId);
                const icon = def ? iconFor(def.name, 'equipment') : undefined;
                return <Chip key={`e${e.equipmentId}`} icon={icon} name={def?.name ?? 'Unknown'} count={1} />;
              })}
            </Section>
          ) : null}

          {army.pets.length > 0 ? (
            <Section title="Hero Pets">
              {army.pets.slice(0, 6).map((p) => {
                const def = petsById.get(p.petId);
                const icon = def ? iconFor(def.name, 'pet') : undefined;
                return <Chip key={`p${p.petId}`} icon={icon} name={def?.name ?? p.hero ?? 'Unknown'} count={1} />;
              })}
            </Section>
          ) : null}
        </View>
      </View>

      <ShareFooter />
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
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerHallImage: {
    width: 56,
    height: 56,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  armyName: {
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: Spacing.md,
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
  section: {
    gap: 6,
  },
  sectionLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    maxWidth: '47%',
  },
  chipIcon: {
    width: 22,
    height: 22,
  },
  chipCount: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  chipName: {
    ...Typography.caption,
    fontSize: 11,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
});
