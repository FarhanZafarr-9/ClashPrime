import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PressableRipple from '../../src/components/PressableRipple';
import { Card } from '../../src/components/Card';
import BottomSheet from '../../src/components/BottomSheet';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import {
  getZapquakeRefs,
  getZapquakeTargets,
  getDefaultSpellLevel,
  getDefaultFireballLevel,
  getDefaultGiantArrowLevel,
  getSpellCapacity,
  getDefaultTargetLevel,
  computeZapquakeCombos,
  clampLevel,
  eqCumulativeFraction,
  type ZapquakeTarget,
  type ZapquakeCombo,
} from '../../src/utils/zapquake';
import { getBuildingMaxLevelAtTH } from '../../src/utils/buildingData';
import { getBuildingLevelImageSource } from '../../src/utils/buildingImages';
import { getArmyItemImage } from '../../src/utils/armyData';

const lockedImage = require('../../assets/images/chiefs-journey/locked.png');

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function Stepper({ value, min, max, onChange, disabled }: StepperProps) {
  return (
    <View style={[styles.stepper, disabled && styles.stepperDisabled]}>
      <PressableRipple
        style={[styles.stepperBtn, (disabled || value <= min) && styles.stepperBtnDisabled]}
        onPress={() => !disabled && value > min && onChange(value - 1)}
        accessibilityRole="button"
        accessibilityLabel="Decrease"
      >
        <Ionicons name="remove" size={15} color={Colors.textPrimary} />
      </PressableRipple>
      <Text style={styles.stepperValue}>{value}</Text>
      <PressableRipple
        style={[styles.stepperBtn, (disabled || value >= max) && styles.stepperBtnDisabled]}
        onPress={() => !disabled && value < max && onChange(value + 1)}
        accessibilityRole="button"
        accessibilityLabel="Increase"
      >
        <Ionicons name="add" size={15} color={Colors.textPrimary} />
      </PressableRipple>
    </View>
  );
}

interface ComboRowProps {
  combo: ZapquakeCombo;
  best: boolean;
  lightningLevel: number;
  eqLevel: number;
  fireballLevel: number;
  giantArrowLevel: number;
}

function ComboRow({ combo, best, lightningLevel, eqLevel, fireballLevel, giantArrowLevel }: ComboRowProps) {
  const equipmentLabel = [combo.fireball ? 'Fireball' : null, combo.giantArrow ? 'Giant Arrow' : null]
    .filter(Boolean)
    .join(' + ');
  const typeLabel =
    combo.eq === 0 && combo.lightning === 0
      ? equipmentLabel || 'empty'
      : equipmentLabel
        ? `${equipmentLabel} zapquake`
        : combo.eq === 0
          ? 'pure lightning'
          : combo.lightning === 0
            ? 'EQ only'
            : 'zapquake';
  return (
    <View style={[styles.comboRow, best && styles.comboRowBest]}>
      <View style={styles.comboSpells}>
        {combo.fireball > 0 && (
          <View style={styles.spellChip}>
            <SpellIcon name="Fireball" level={fireballLevel} size={18} />
            <Text style={styles.spellChipText}>×{combo.fireball}</Text>
          </View>
        )}
        {combo.giantArrow > 0 && (
          <View style={styles.spellChip}>
            <SpellIcon name="Giant Arrow" level={giantArrowLevel} size={18} />
            <Text style={styles.spellChipText}>×{combo.giantArrow}</Text>
          </View>
        )}
        {combo.lightning > 0 && (
          <View style={styles.spellChip}>
            <SpellIcon name="Lightning Spell" level={lightningLevel} size={18} />
            <Text style={styles.spellChipText}>×{combo.lightning}</Text>
          </View>
        )}
        {combo.eq > 0 && (
          <View style={styles.spellChip}>
            <SpellIcon name="Earthquake Spell" level={eqLevel} size={18} />
            <Text style={styles.spellChipText}>×{combo.eq}</Text>
          </View>
        )}
        {best && (
          <View style={styles.bestChip}>
            <Text style={styles.bestChipText}>Best</Text>
          </View>
        )}
      </View>
      <View style={styles.comboMeta}>
        <Text style={styles.comboSlots}>{combo.housing} slots</Text>
        <Text style={styles.comboOverkill}>
          {typeLabel} · {combo.overkillPercent.toFixed(1)}% overkill
        </Text>
      </View>
    </View>
  );
}

export default function ZapquakerScreen() {
  const { player, refresh } = usePlayer();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const refs = useMemo(() => getZapquakeRefs(), []);
  const targets = useMemo(() => getZapquakeTargets(), []);
  const th = player?.townHallLevel ?? 11;

  const defaultLightning = useMemo(
    () => getDefaultSpellLevel(player, 'Lightning Spell', th, refs.lightningLevels),
    [player, th, refs],
  );
  const defaultEQ = useMemo(
    () => getDefaultSpellLevel(player, 'Earthquake Spell', th, refs.eqLevels),
    [player, th, refs],
  );
  const defaultFireball = useMemo(() => getDefaultFireballLevel(player, refs), [player, refs]);
  const defaultGiantArrow = useMemo(() => getDefaultGiantArrowLevel(player, refs), [player, refs]);
  const capacityInfo = useMemo(() => getSpellCapacity(player, th, refs), [player, th, refs]);
  const maxCapacity = useMemo(() => {
    const sf = Math.max(...refs.spellFactoryLevels.map((l) => l.capacity), 0);
    const dsf = Math.max(...refs.darkSpellFactoryLevels.map((l) => l.capacity), 0);
    return sf + dsf;
  }, [refs]);

  const [lightningOverride, setLightningOverride] = useState<number | null>(null);
  const [eqOverride, setEQOverride] = useState<number | null>(null);
  const [capacityOverride, setCapacityOverride] = useState<number | null>(null);
  const [lightningOn, setLightningOn] = useState(true);
  const [eqOn, setEQOn] = useState(true);
  const [fireballOn, setFireballOn] = useState(false);
  const [fireballLevelOverride, setFireballLevelOverride] = useState<number | null>(null);
  const [giantArrowOn, setGiantArrowOn] = useState(false);
  const [giantArrowLevelOverride, setGiantArrowLevelOverride] = useState<number | null>(null);
  const [targetNames, setTargetNames] = useState<string[]>(['Air Defense']);
  const [levelOverrides, setLevelOverrides] = useState<Record<string, number | null>>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  // Reset manual overrides when the account changes (same pattern as FloatingTabBar).
  const [prevTag, setPrevTag] = useState(player?.tag ?? null);
  if (prevTag !== (player?.tag ?? null)) {
    setPrevTag(player?.tag ?? null);
    setLightningOverride(null);
    setEQOverride(null);
    setCapacityOverride(null);
    setLightningOn(true);
    setEQOn(true);
    setFireballOn(false);
    setFireballLevelOverride(null);
    setGiantArrowOn(false);
    setGiantArrowLevelOverride(null);
    setTargetNames(['Air Defense']);
    setLevelOverrides({});
  }

  const toggleTarget = useCallback((name: string) => {
    setTargetNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }, []);

  const selectedTargets = useMemo(
    () => targets.filter((t) => targetNames.includes(t.name)),
    [targets, targetNames],
  );

  const targetDetails = useMemo(
    () =>
      selectedTargets.map((t) => {
        const level = clampLevel(
          levelOverrides[t.name] ?? getDefaultTargetLevel(player, t, th, getBuildingMaxLevelAtTH),
          t.levels.length,
        );
        const hp = t.levels[level - 1]?.hitpoints ?? 0;
        return { target: t, level, hp };
      }),
    [selectedTargets, levelOverrides, player, th],
  );

  // The binding target is the one with the most HP — a combo killing it kills the rest.
  const binding = useMemo(
    () => targetDetails.reduce<typeof targetDetails[number] | null>((acc, d) => (acc == null || d.hp > acc.hp ? d : acc), null),
    [targetDetails],
  );

  const targetHP = binding?.hp ?? 0;
  const getTargetImage = (detail: { target: ZapquakeTarget; level: number }) =>
    detail.target.category === 'Heroes'
      ? (() => {
        return getArmyItemImage(detail.target.name, detail.level) ?? undefined;
      })()
      : getBuildingLevelImageSource(detail.target.name, detail.level);

  const lightning = clampLevel(lightningOverride ?? defaultLightning, refs.lightningLevels.length || 1);
  const eq = clampLevel(eqOverride ?? defaultEQ, refs.eqLevels.length || 1);
  const capacity = capacityOverride ?? capacityInfo.capacity;
  const fireballLevel = clampLevel(fireballLevelOverride ?? defaultFireball, refs.fireballLevels.length || 1);
  const fireballDamage = refs.fireballLevels[fireballLevel - 1]?.damage ?? 0;
  const giantArrowLevel = clampLevel(giantArrowLevelOverride ?? defaultGiantArrow, refs.giantArrowLevels.length || 1);
  const giantArrowDamage = refs.giantArrowLevels[giantArrowLevel - 1]?.damage ?? 0;

  // The Giant Arrow deals double damage to Air Defenses — the only ×2 pairing.
  // It applies to the building the combo is sized against (the highest-HP one).
  const isAirDefense = binding?.target.name === 'Air Defense';
  const effectiveGiantArrowDamage = isAirDefense ? giantArrowDamage * 2 : giantArrowDamage;

  // Page is state-aware: a spell you do not actually have is locked and contributes nothing.
  const lightningUnlocked = capacityInfo.sfLevel > 0;
  const eqUnlocked = capacityInfo.sfLevel >= (refs.eqLevels[0]?.spellFactoryLevelRequired ?? 1);
  const fireballUnlocked = !player || (player.heroEquipment ?? []).some((e) => e.name === 'Fireball');
  const giantArrowUnlocked = !player || (player.heroEquipment ?? []).some((e) => e.name === 'Giant Arrow');

  const effRefs = useMemo(() => {
    if (lightningUnlocked && eqUnlocked) return refs;
    return {
      ...refs,
      lightningLevels: lightningUnlocked
        ? refs.lightningLevels
        : refs.lightningLevels.map((l) => ({ ...l, damage: 0 })),
      eqLevels: eqUnlocked
        ? refs.eqLevels
        : refs.eqLevels.map((l) => ({ ...l, buildingDamagePercent: 0 })),
    };
  }, [refs, lightningUnlocked, eqUnlocked]);

  const lightningDamage = refs.lightningLevels[lightning - 1]?.damage ?? 0;
  const eqPercent = refs.eqLevels[eq - 1]?.buildingDamagePercent ?? 0;

  const combos = useMemo(
    () =>
      computeZapquakeCombos({
        hp: targetHP,
        lightningLevel: lightning,
        eqLevel: eq,
        capacity,
        fireballDamage: fireballOn ? fireballDamage : 0,
        giantArrowDamage: giantArrowOn ? effectiveGiantArrowDamage : 0,
        enabled: { lightning: lightningOn, eq: eqOn, fireball: fireballOn, giantArrow: giantArrowOn },
        refs: effRefs,
      }),
    [targetHP, lightning, eq, capacity, lightningOn, eqOn, fireballOn, fireballDamage, giantArrowOn, effectiveGiantArrowDamage, effRefs],
  );

  // Surface a varied set instead of only the single cheapest tier: the
  // cheapest overall, the cheapest with no equipment (spell-only zapquake),
  // and the cheapest that leans on Fireball / Giant Arrow. Anything already
  // shown by an earlier group is deduped, so pure repeats never appear twice.
  const bestCombos = useMemo(() => {
    if (combos.length === 0) return combos;
    const eqPreferred = (a: ZapquakeCombo, b: ZapquakeCombo) =>
      (a.eq === 0 ? 0 : 1) - (b.eq === 0 ? 0 : 1) || a.lightning - b.lightning;
    const cheapestOf = (pool: ZapquakeCombo[]) => {
      if (pool.length === 0) return [];
      const sorted = [...pool].sort(eqPreferred);
      const min = sorted[0].housing;
      return sorted.filter((c) => c.housing === min);
    };
    const cheapest = cheapestOf(combos);
    const spellOnly = cheapestOf(combos.filter((c) => c.fireball === 0 && c.giantArrow === 0));
    const withEquip = cheapestOf(combos.filter((c) => c.fireball > 0 || c.giantArrow > 0));

    const out: ZapquakeCombo[] = [];
    const seen = new Set<string>();
    for (const list of [cheapest, spellOnly, withEquip]) {
      for (const c of list) {
        const key = `${c.fireball}-${c.giantArrow}-${c.lightning}-${c.eq}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(c);
      }
    }
    return out;
  }, [combos]);

  const groupedTargets = useMemo(() => {
    const order: ZapquakeTarget['category'][] = ['Defenses', 'Crafted Defenses', 'Town Hall', 'Resources', 'Heroes'];
    return order
      .map((category) => ({ category, items: targets.filter((t) => t.category === category) }))
      .filter((g) => g.items.length > 0);
  }, [targets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh().catch(() => { });
    setRefreshing(false);
  }, [refresh]);

  const noData = refs.lightningLevels.length === 0 || refs.eqLevels.length === 0;

  return (
    <SafeAreaView style={styles.container} >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.textSecondary}
            colors={[Colors.textSecondary]}
            progressBackgroundColor={Colors.bgCard}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Zapquaker</Text>
          <Text style={styles.subtitle}>Lightning + Earthquake combos per building</Text>
        </View>

        {noData && (
          <Card>
            <Text style={styles.errorText}>Game data failed to load — pull to refresh.</Text>
          </Card>
        )}

        {!noData && (
          <>
            <Card title="Your spells" subtitle="Defaults come from your profile">
              <View style={styles.spellRow}>
                <SpellIconBadge locked={!lightningUnlocked}>{lightningLevelIcon(lightning)}</SpellIconBadge>
                <View style={styles.spellInfo}>
                  <Text style={styles.spellName}>Lightning Spell</Text>
                  <Text style={styles.spellStat}>
                    {lightningDamage.toLocaleString()} damage · {refs.lightningHousing} slot
                  </Text>
                </View>
                <View style={styles.spellControlRow}>
                  <PressableRipple onPress={() => setLightningOn((v) => !v)} hitSlop={6} style={[styles.stepperBadge, lightningOn ? styles.stepperBadgeOn : styles.stepperBadgeOff]}>
                    <Text style={styles.stepperBadgeText}>{lightningOn ? 'On' : 'Off'}</Text>
                  </PressableRipple>
                  {lightningOverride != null && (
                    <PressableRipple onPress={() => setLightningOverride(null)} hitSlop={6} style={styles.resetBtn}>
                      <Text style={styles.resetText}>Profile</Text>
                    </PressableRipple>
                  )}
                  <Stepper
                    value={lightning}
                    min={1}
                    max={refs.lightningLevels.length}
                    onChange={(v) => setLightningOverride(v)}
                  />
                </View>
              </View>
              <View style={styles.spellDivider} />
              <View style={styles.spellRow}>
                <SpellIconBadge locked={!eqUnlocked}>{earthquakeLevelIcon(eq)}</SpellIconBadge>
                <View style={styles.spellInfo}>
                  <Text style={styles.spellName}>Earthquake Spell</Text>
                  <Text style={styles.spellStat}>
                    {eqPercent}% of max HP per cast · {refs.eqHousing} slot
                  </Text>
                </View>
                <View style={styles.spellControlRow}>
                  <PressableRipple onPress={() => setEQOn((v) => !v)} hitSlop={6} style={[styles.stepperBadge, eqOn ? styles.stepperBadgeOn : styles.stepperBadgeOff]}>
                    <Text style={styles.stepperBadgeText}>{eqOn ? 'On' : 'Off'}</Text>
                  </PressableRipple>
                  {eqOverride != null && (
                    <PressableRipple onPress={() => setEQOverride(null)} hitSlop={6} style={styles.resetBtn}>
                      <Text style={styles.resetText}>Profile</Text>
                    </PressableRipple>
                  )}
                  <Stepper
                    value={eq}
                    min={1}
                    max={refs.eqLevels.length}
                    onChange={(v) => setEQOverride(v)}
                  />
                </View>
              </View>
              <View style={styles.spellDivider} />
              <View style={styles.spellRow}>
                <SpellIconBadge locked={!fireballUnlocked}>{fireballIcon(fireballLevel)}</SpellIconBadge>
                <View style={styles.spellInfo}>
                  <Text style={styles.spellName}>Fireball · Warden</Text>
                  <Text style={styles.spellStat}>
                    {fireballUnlocked
                      ? `${fireballDamage.toLocaleString()} damage · once per raid`
                      : 'Not unlocked — equip Fireball on the Warden first'}
                  </Text>
                </View>
                <View style={styles.spellControlRow}>
                  <PressableRipple onPress={() => setFireballOn((v) => !v)} hitSlop={6} style={[styles.stepperBadge, fireballOn ? styles.stepperBadgeOn : styles.stepperBadgeOff]}>
                    <Text style={styles.stepperBadgeText}>{fireballOn ? 'On' : 'Off'}</Text>
                  </PressableRipple>
                  {fireballOn && (
                    <Stepper
                      value={fireballLevel}
                      min={1}
                      max={refs.fireballLevels.length}
                      onChange={(v) => setFireballLevelOverride(v)}
                    />
                  )}
                </View>
              </View>
              <View style={styles.spellDivider} />
              <View style={styles.spellRow}>
                <SpellIconBadge locked={!giantArrowUnlocked}>{giantArrowIcon(giantArrowLevel)}</SpellIconBadge>
                <View style={styles.spellInfo}>
                  <Text style={styles.spellName}>Giant Arrow · Queen</Text>
                  <Text style={styles.spellStat}>
                    {giantArrowUnlocked
                      ? `${effectiveGiantArrowDamage.toLocaleString()} damage${isAirDefense ? ' · 2× vs Air Defenses' : ''} · once per raid`
                      : 'Not unlocked — equip Giant Arrow on the Queen first'}
                  </Text>
                </View>
                <View style={styles.spellControlRow}>
                  <PressableRipple onPress={() => setGiantArrowOn((v) => !v)} hitSlop={6} style={[styles.stepperBadge, giantArrowOn ? styles.stepperBadgeOn : styles.stepperBadgeOff]}>
                    <Text style={styles.stepperBadgeText}>{giantArrowOn ? 'On' : 'Off'}</Text>
                  </PressableRipple>
                  {giantArrowOn && (
                    <Stepper
                      value={giantArrowLevel}
                      min={1}
                      max={refs.giantArrowLevels.length}
                      onChange={(v) => setGiantArrowLevelOverride(v)}
                    />
                  )}
                </View>
              </View>
            </Card>

            <Card
              title="Spell capacity"
              subtitle={
                capacityInfo.derived
                  ? `Estimated for Town Hall ${th} — import a CoC export in Import/Export for your real levels`
                  : `Spell Factory Lv ${capacityInfo.sfLevel} (${capacityInfo.sfCapacity}) + Dark Spell Factory Lv ${capacityInfo.dsfLevel} (${capacityInfo.dsfCapacity})`
              }
            >
              <View style={styles.capacityRow}>
                <View style={styles.capacityValue}>
                  <Text style={styles.capacityNumber}>{capacity}</Text>
                  <Text style={styles.capacityLabel}>total slots</Text>
                </View>
                <Stepper
                  value={capacity}
                  min={0}
                  max={maxCapacity}
                  onChange={(v) => setCapacityOverride(v !== capacityInfo.capacity ? v : null)}
                />
              </View>
            </Card>

            <Card
              title="Targets"
              subtitle={
                targetNames.length === 0
                  ? 'Pick one or more buildings to zap'
                  : `${targetNames.length} selected · highest HP drives`
              }
            >
              {targetNames.length > 0 && (
                <View style={styles.chipWrap}>
                  {targetDetails.map(({ target: t, level, hp }) => (
                    <PressableRipple key={t.name} style={styles.targetChip} onPress={() => toggleTarget(t.name)}>
                      <Text style={styles.targetChipText}>{t.name}</Text>
                      <Text style={styles.targetChipMeta}>
                        Lv {level} · {hp.toLocaleString()}
                      </Text>
                      <Ionicons name="close" size={12} color={Colors.textTertiary} />
                    </PressableRipple>
                  ))}
                </View>
              )}

              <PressableRipple
                style={styles.targetPill}
                onPress={() => setSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Choose target buildings"
              >
                <Text style={styles.targetName}>
                  {targetNames.length === 0 ? 'Add buildings…' : 'Add / remove buildings'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textTertiary} />
              </PressableRipple>

              {targetDetails.map(({ target: t, level, hp }) => {
                const image = getTargetImage({ target: t, level });
                return (
                  <View key={t.name} style={styles.targetMetaRow}>
                    {image && (
                      <View style={styles.targetImageWrap}>
                        <Image source={image} style={styles.targetImage} resizeMode="contain" />
                      </View>
                    )}
                    <View style={[styles.spellInfo, styles.targetInfo]}>
                      <Text style={styles.targetHP}>
                        {hp.toLocaleString()} HP
                      </Text>
                      <Text style={styles.spellStat}>
                        {t.name === binding?.target.name ? 'Highest · ' : 'Lv '}
                        {t.category}
                      </Text>
                    </View>
                    <Stepper
                      value={level}
                      min={1}
                      max={t.levels.length}
                      onChange={(v) => setLevelOverrides((prev) => ({ ...prev, [t.name]: v }))}
                    />
                  </View>
                );
              })}
            </Card>

            <Card
              title="Combos"
              subtitle={
                targetNames.length === 0 ? undefined : `${Math.min(bestCombos.length, 6)} best suggestions`
              }
            >
              {targetNames.length === 0 ? (
                <View style={styles.noCombos}>
                  <View style={styles.noCombosIcon}>
                    <Ionicons name="add-circle-outline" size={24} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.noCombosTitle}>No targets yet</Text>
                  <Text style={styles.noCombosText}>
                    Add at least one building above and its zapquake combos will appear here.
                  </Text>
                </View>
              ) : combos.length === 0 ? (
                <View style={styles.noCombos}>
                  <View style={styles.noCombosIcon}>
                    <Ionicons name="flash-outline" size={24} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.noCombosTitle}>Nothing fits</Text>
                  <Text style={styles.noCombosText}>
                    No enabled combination inside your capacity destroys these buildings. Turn a spell
                    back on, upgrade your spells, raise spell capacity, or lower the level of a target.
                  </Text>
                </View>
              ) : (
                bestCombos
                  .slice(0, 6)
                  .map((combo, i) => (
                    <ComboRow
                      key={`${combo.fireball}-${combo.giantArrow}-${combo.lightning}-${combo.eq}`}
                      combo={combo}
                      best={i === 0}
                      lightningLevel={lightning}
                      eqLevel={eq}
                      fireballLevel={fireballLevel}
                      giantArrowLevel={giantArrowLevel}
                    />
                  ))
              )}
            </Card>

            <View style={styles.noteCard}>
              <View style={styles.noteBody}>
                {[
                  `Every Earthquake hits for a slice of the building max HP. The first deals ${eqPercent}%, and each extra one deals less (1/3, 1/5, 1/7 of the first), so 4 EQs reach about ${(eqPercent * eqCumulativeFraction(4)).toFixed(0)}% of max HP.`,
                  'EQ alone cannot destroy a building, and storages resist it.',
                  'The Town Hall and Clan Castle cannot be hit with Lightning at all.',
                  'Lightning always deals its full listed damage per spell.',
                  'Fireball (Warden) and Giant Arrow (Queen) are once-per-raid equipment hits that take no spell slot.',
                  'The Giant Arrow deals double damage to Air Defenses — combos aimed at one already count the ×2 hit.',
                  'With several targets, these combos are sized against the highest-HP one.',
                ].map((line, i) => (
                  <View key={i} style={styles.noteLine}>
                    <View style={styles.noteBullet} />
                    <Text style={styles.noteText}>{line}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Pick a building"
        subtitle="Town Hall, Clan Castle & storages are excluded"
        icon="grid-outline"
      >
        {groupedTargets.map((group) => (
          <View key={group.category} style={styles.groupBlock}>
            <Text style={styles.groupHeader}>{group.category}</Text>
            {group.items.map((t) => {
              const selected = targetNames.includes(t.name);
              const levelAtTH = getBuildingMaxLevelAtTH(t.name, th) ?? 0;
              const heroLevel =
                t.category === 'Heroes'
                  ? player?.heroes?.find((x) => x.name === t.name)?.level ?? t.levels.length
                  : 0;
              const iconLevel = heroLevel > 0 ? heroLevel : levelAtTH > 0 ? levelAtTH : 1;
              const heroImage = t.category === 'Heroes' ? getArmyItemImage(t.name, iconLevel) : null;
              const icon = heroImage ?? getBuildingLevelImageSource(t.name, iconLevel);
              return (
                <PressableRipple
                  key={t.name}
                  style={[styles.listRow, selected && { backgroundColor: colors.bgCardHover }]}
                  onPress={() => toggleTarget(t.name)}
                >
                  <View style={styles.listRowMain}>
                    {icon && <Image source={icon} style={styles.listRowIcon} resizeMode="contain" />}
                    <Text style={[styles.listRowText, selected && styles.listRowTextSelected]}>{t.name}</Text>
                  </View>
                  <View style={styles.listRowEnd}>
                    {selected && <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />}
                    <Text style={styles.listRowMeta}>Lv {iconLevel}</Text>
                  </View>
                </PressableRipple>
              );
            })}
          </View>
        ))}
      </BottomSheet>
    </SafeAreaView>
  );
}

function lightningLevelIcon(level: number) {
  return <SpellIcon name="Lightning Spell" level={level} />;
}

function earthquakeLevelIcon(level: number) {
  return <SpellIcon name="Earthquake Spell" level={level} />;
}

function fireballIcon(level: number) {
  return <SpellIcon name="Fireball" level={level} />;
}

function giantArrowIcon(level: number) {
  return <SpellIcon name="Giant Arrow" level={level} />;
}

function SpellIcon({ name, level, size = 34 }: { name: string; level: number; size?: number }) {
  const image = getArmyItemImage(name, level);
  return image ? (
    <Image source={image} style={{ width: size, height: size }} resizeMode="contain" />
  ) : (
    <View style={[styles.spellIcon, styles.spellIconFallback, { width: size, height: size }]}>
      <Ionicons name="flask-outline" size={Math.round(size * 0.6)} color={Colors.textPrimary} />
    </View>
  );
}

function SpellIconBadge({ locked, children }: { locked: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.spellIconWrap}>
      {children}
      {locked && (
        <View style={styles.spellLockPill}>
          <Image source={lockedImage} style={styles.spellLockImage} resizeMode="contain" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingHorizontal: Spacing.base,
    paddingBottom: 96,
  },
  header: {
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
  errorText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  spellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  spellDivider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
  },
  spellIcon: {
    width: 34,
    height: 34,
  },
  spellIconFallback: {
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spellInfo: {
    flex: 1,
  },
  spellName: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  spellStat: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  spellControl: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  spellControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resetBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
  },
  resetText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  stepperBadge: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBadgeOn: {
    backgroundColor: Colors.accentSubtle,
  },
  stepperBadgeOff: {
    backgroundColor: Colors.bgSubtle,
  },
  stepperBadgeText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  spellIconWrap: {
    position: 'relative',
  },
  spellLockPill: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spellLockImage: {
    width: 10,
    height: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepperDisabled: {
    opacity: 0.5,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  stepperValue: {
    minWidth: 26,
    textAlign: 'center',
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  capacityValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  capacityNumber: {
    ...Typography.title1,
    color: Colors.textPrimary,
  },
  capacityLabel: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    borderWidth: 0.75,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  targetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.accentGhost,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  targetChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  targetChipMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  targetName: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  targetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm
  },
  targetInfo: {
    justifyContent: 'center',
    gap: 6,
  },
  targetImageWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetImage: {
    width: 40,
    height: 40,
  },
  targetHP: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  noCombos: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: Spacing.xl,
  },
  noCombosIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  noCombosTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  noCombosText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  comboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
  },
  comboRowBest: {
    backgroundColor: Colors.accentGhost,
  },
  comboSpells: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  spellChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: Colors.accentSubtle,
  },
  spellChipText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  bestChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.textPrimary,
  },
  bestChipText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.bg,
  },
  comboMeta: {
    alignItems: 'flex-end',
    marginLeft: Spacing.md,
  },
  comboSlots: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  comboOverkill: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  noteCard: {
    padding: Spacing.base,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.borderSubtle,
  },
  noteBody: {
    flex: 1,
    gap: 6,
  },
  noteLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  noteBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.textTertiary,
    marginTop: 6,
  },
  noteText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  groupBlock: {
    marginBottom: Spacing.md,
  },
  groupHeader: {
    ...Typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },
  listRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  listRowIcon: {
    width: 28,
    height: 28,
  },
  listRowText: {
    ...Typography.subhead,
    color: Colors.textPrimary,
  },
  listRowTextSelected: {
    fontWeight: '700',
  },
  listRowMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  listRowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});