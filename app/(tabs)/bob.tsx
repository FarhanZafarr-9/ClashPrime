import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PressableRipple from '../../src/components/PressableRipple';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { useBuilderBaseCount } from '../../src/hooks/useBuilderBaseCount';
import { computeBobPlan, BobPlan, BobChain } from '../../src/utils/bobPlanner';
import { formatCost, formatTime, formatTimeShort } from '../../src/utils/upgradeCosts';
import { BUILDING_RESOURCE_META, BuildingCostResource, isBuilderName, toPackageName } from '../../src/utils/buildingData';
import { PACKAGE_IMAGES, PACKAGE_RESOURCE_IMAGES } from '../../src/data/packageImages';
import { toStoreName } from '../../src/utils/buildingCopies';
import { getBuildingImageSource, getBuildingLevelImageSource } from '../../src/utils/buildingImages';
import { getArmyItemImage } from '../../src/utils/armyData';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';

const GEAR_KEY = 'clashprime_bob_gearups';

function splitChainLabel(label: string): { title: string; sub?: string } {
  const gear = /^Gear up (.+?) \(Lv (\d+)\)$/.exec(label);
  if (gear) return { title: `Gear up ${gear[1]}`, sub: `Lv ${gear[2]}` };
  const up = /^(?:Upgrade|Build) (.+?) Lv (.+)$/.exec(label);
  if (up) return { title: up[1], sub: `Lv ${up[2]}` };
  const plain = /^(.+?) (Lv \d+ → \d+(?: ×\d+)?)(?: \(copy (\d+)\))?$/.exec(label);
  if (plain) return { title: plain[1], sub: plain[3] ? `${plain[2]} · copy ${plain[3]}` : plain[2] };
  return { title: label };
}

function chainCost(c: BobChain): { text: string; color?: string; icon?: number } | null {
  if (c.cost <= 0) return null;
  const entries = (Object.entries(c.byResource ?? {}) as [string, number][]).filter(([, v]) => v > 0);
  if (entries.length === 1) {
    const [res, v] = entries[0];
    const meta = BUILDING_RESOURCE_META[res as BuildingCostResource];
    return { text: formatCost(v), color: meta?.color, icon: PACKAGE_RESOURCE_IMAGES[res] };
  }
  return { text: formatCost(c.cost) };
}

function workerColor(worker: number): string {
  const palette = [Colors.accent, Colors.success, Colors.warning];
  return palette[worker % palette.length];
}

const CHAIN_ICON_CACHE: Record<string, number | { uri: string } | null> = {};

function chainIconSource(label: string): number | { uri: string } | null {
  const gear = /^Gear up (.+?) \(Lv (\d+)\)$/.exec(label);
  if (gear) {
    const entry = PACKAGE_IMAGES[toPackageName(gear[1])];
    if (entry) {
      const sprite = entry.levels[gear[2]];
      if (sprite) return sprite;
      if (entry.icon) return entry.icon;
    }
    return null;
  }
  const last = label.lastIndexOf(' Lv ');
  let name = last >= 0 ? label.slice(0, last) : label.replace(/^Gear up /, '');
  name = name.replace(/^(Upgrade|Build|Research|Unlock|Raise) /, '');
  let to: number | undefined;
  if (last >= 0) {
    const m = /→ (\d+)/.exec(label.slice(last));
    if (m) to = Number(m[1]);
  }
  const candidates = isBuilderName(name) ? [name] : [name, `BB ${name}`];
  for (const c of candidates) {
    const src = to != null ? getBuildingLevelImageSource(c, to) : getBuildingImageSource(c);
    if (src) return src;
  }
  return getArmyItemImage(name, to ?? null, true) ?? getArmyItemImage(name, to ?? null, false);
}

function chainIcon(label: string): number | { uri: string } | null {
  if (label in CHAIN_ICON_CACHE) return CHAIN_ICON_CACHE[label];
  const src = chainIconSource(label);
  CHAIN_ICON_CACHE[label] = src;
  return src;
}

const RESOURCE_ORDER: BuildingCostResource[] = [
  'Builder Gold',
  'Builder Elixir',
  'Gold',
  'Elixir',
];

function RequirementStateIcon({ done }: { done: boolean }) {
  return (
    <View style={[styles.stateIcon, done ? styles.stateDone : styles.stateTodo]}>
      <Ionicons
        name={done ? 'checkmark' : 'arrow-forward'}
        size={14}
        color={done ? Colors.success : Colors.textTertiary}
      />
    </View>
  );
}

function GearToggle({ done, onPress }: { done: boolean; onPress: () => void }) {
  return (
    <PressableRipple
      style={[styles.gearBox, { borderColor: done ? Colors.success : Colors.border }]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="checkbox"
    >
      {done ? <Ionicons name="checkmark" size={15} color={Colors.success} /> : null}
    </PressableRipple>
  );
}

export default function BobPlannerScreen() {
  const { player } = usePlayer();
  const { count: bbBuilders } = useBuilderBaseCount(player?.builderHallLevel);
  const [gearUps, setGearUps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(GEAR_KEY)
      .then((raw) => {
        if (mounted && raw) setGearUps(JSON.parse(raw));
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const toggleGear = useCallback((key: string) => {
    setGearUps((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(GEAR_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const plan = useMemo<BobPlan | null>(() => {
    if (!player) return null;
    const bh = player.builderHallLevel ?? 1;
    const heroLevels: Record<string, number> = {};
    for (const h of player.heroes ?? []) {
      if (h.village === 'builderBase') heroLevels[h.name] = h.level;
    }
    const troopLevels: Record<string, number> = {};
    for (const t of player.troops ?? []) {
      if (t.village === 'builderBase') troopLevels[t.name] = t.level;
    }
    const homeLevels: Record<string, number> = {};
    const homeSeen = new Set<string>();
    for (const b of player.buildings ?? []) {
      const key = toStoreName(b.name);
      homeLevels[key] = Math.max(homeLevels[key] ?? 0, b.level);
      homeSeen.add(key);
    }
    for (const [key, lvl] of Object.entries(player.buildingLevels ?? {})) {
      if (!homeSeen.has(key) && lvl > (homeLevels[key] ?? 0)) homeLevels[key] = lvl;
    }
    const clockLevel = player.buildingLevels?.['Clock Tower'] ?? 1;
    return computeBobPlan({
      bh,
      bbBuilders,
      buildingLevels: player.buildingLevels,
      buildings: player.buildings,
      heroLevels,
      troopLevels,
      gearUpsDone: gearUps,
      homeLevels,
      clockTowerLevel: clockLevel,
    });
  }, [player, bbBuilders, gearUps]);

  const resources = plan
    ? (Object.entries(plan.resources).filter(([, v]) => v > 0) as [string, number][]).sort((a, b) => {
        const ia = RESOURCE_ORDER.indexOf(a[0] as BuildingCostResource);
        const ib = RESOURCE_ORDER.indexOf(b[0] as BuildingCostResource);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      })
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>6th Builder</Text>
          <Text style={styles.subtitle}>Plan B.O.B.: gear-ups, research, heroes and the Builder Hall</Text>
        </View>

        {!player ? (
          <View style={styles.card}>
            <View style={styles.emptyRow}>
              <Ionicons name="person-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.emptyText}>
                Attach a player profile in Settings so this planner can read your Builder Base, heroes and troops.
              </Text>
            </View>
          </View>
        ) : plan ? (
          <>
            <View style={styles.summary}>
              <View style={styles.summaryMain}>
                <Text style={styles.summaryLabel}>Estimated unlock time</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{formatTime(plan.totalEtaSec)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={styles.summaryPill}>
                  <Ionicons name={plan.bbBuilders >= 3 ? 'checkmark-circle' : 'hammer-outline'} size={13} color={plan.bbBuilders >= 3 ? Colors.success : Colors.textSecondary} />
                  <Text style={styles.summaryPillText}>{plan.bbBuilders} builder{plan.bbBuilders === 1 ? '' : 's'}</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Ionicons name="flask-outline" size={13} color={Colors.textSecondary} />
                  <Text style={styles.summaryPillText}>Star Lab</Text>
                </View>
                <View style={styles.summaryPill}>
                  <Ionicons name="business-outline" size={13} color={Colors.textSecondary} />
                  <Text style={styles.summaryPillText}>BH {plan.bh}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Requirements</Text>
            <View style={styles.list}>
              {plan.requirements.map((req, i) => (
                <View
                  key={req.id}
                  style={[
                    styles.reqRow,
                    i === 0 && styles.rowFirst,
                    i === plan.requirements.length - 1 && styles.rowLast,
                    i < plan.requirements.length - 1 && styles.rowBorder,
                  ]}
                >
                  {req.manual ? (
                    <GearToggle done={req.done} onPress={() => toggleGear(req.id)} />
                  ) : (
                    <RequirementStateIcon done={req.done} />
                  )}
                  <View style={styles.reqIconBox}>
                    <Ionicons name={req.icon as any} size={18} color={req.done ? Colors.success : Colors.textPrimary} />
                  </View>
                  <View style={styles.reqText}>
                    <Text style={[styles.reqLabel, req.done && styles.reqLabelDone]} numberOfLines={1}>{req.label}</Text>
                    <Text style={styles.reqSub} numberOfLines={2}>{req.sub}</Text>
                  </View>
                  <View style={styles.reqRight}>
                    {req.done ? (
                      <View style={styles.doneBadge}>
                        <Text style={styles.doneBadgeText}>done</Text>
                      </View>
                    ) : req.etaSec > 0 ? (
                      <>
                        <Text style={styles.reqTime}>{formatTimeShort(req.etaSec)}</Text>
                        {req.cost > 0 ? (
                          <Text style={styles.reqCost} numberOfLines={1}>{formatCost(req.cost)}</Text>
                        ) : null}
                      </>
                    ) : (
                      <View style={styles.blockedBadge}>
                        <Ionicons name="lock-closed-outline" size={11} color={Colors.textTertiary} />
                        <Text style={styles.blockedBadgeText}>blocked</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {plan.machines.map((m) => (
              <View key={m.id} style={styles.machineCard}>
                <View style={styles.machineHeader}>
                  <View style={styles.machineTitleRow}>
                    <Ionicons
                      name={m.id === 'bb-builder' ? 'hammer-outline' : 'flask-outline'}
                      size={15}
                      color={Colors.textPrimary}
                    />
                    <Text style={styles.machineTitle}>
                      {m.label}{m.id === 'bb-builder' ? `s · ${plan.bbBuilders}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.machineTime}>{formatTime(m.timeSec)}</Text>
                </View>
                {m.chains.map((c, idx) => {
                  const icon = chainIcon(c.label);
                  const { title, sub } = splitChainLabel(c.label);
                  const cost = chainCost(c);
                  return (
                    <View key={`${m.id}-${c.label}`} style={[
                      styles.chainRow,
                      idx === 0 && { borderTopLeftRadius: Radius.xl * 1.35, borderTopRightRadius: Radius.xl * 1.35 },
                      idx === m.chains.length-1 && { borderBottomLeftRadius: Radius.xl * 1.35, borderBottomRightRadius: Radius.xl * 1.35 }
                    ]}>
                      <View style={styles.chainOrderChip}>
                        <Text style={styles.chainOrderText}>{idx + 1}</Text>
                      </View>
                      <View style={styles.chainIconBox}>
                        {icon ? (
                          <Image source={icon} style={styles.chainIcon} resizeMode="contain" />
                        ) : null}
                      </View>
                      <View style={styles.chainText}>
                        <Text style={styles.chainTitle} numberOfLines={1}>{title}</Text>
                        {sub ? (
                          <Text style={styles.chainSub} numberOfLines={1}>{sub}</Text>
                        ) : null}
                      </View>
                      <View style={styles.chainRight}>
                        <View style={styles.chainTop}>
                          {c.worker != null && m.chains.length > 1 && plan.bbBuilders > 1 ? (
                            <Text style={[styles.workerPillText, { color: workerColor(c.worker) }]}>
                              B{c.worker + 1} -
                            </Text>
                          ) : null}
                          <Text style={styles.chainTime}>{formatTimeShort(c.timeSec)}</Text>
                        </View>
                        {cost ? (
                          <View style={styles.chainCostRow}>
                            {cost.icon ? (
                              <Image source={cost.icon} style={styles.chainCostIcon} resizeMode="contain" />
                            ) : null}
                            <Text style={[styles.chainCost, { color: cost.color ?? Colors.textTertiary }]} numberOfLines={1}>
                              {cost.text}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                {m.chains.length === 0 ? (
                  <Text style={styles.machineEmpty}>Nothing to schedule here.</Text>
                ) : null}
              </View>
            ))}

            {plan.clockTower && plan.clockTower.saveSec > 0 ? (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.ctIcon}>
                    <Ionicons name="time-outline" size={16} color={Colors.textPrimary} />
                  </View>
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>Clock Tower value</Text>
                    <Text style={styles.cardSub}>
                      Raising Clock Tower Lv {plan.clockTower.level} → {plan.clockTower.maxLevel} shortens this plan by ≈ {formatTime(plan.clockTower.saveSec)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            {resources.length > 0 ? (
              <View style={styles.resCard}>
                <View style={styles.resHeader}>
                  <Ionicons name="cube-outline" size={15} color={Colors.textPrimary} />
                  <Text style={styles.resHeaderText}>Total cost</Text>
                </View>
                <View style={styles.resGrid}>
                  {resources.map(([res, v]) => {
                    const meta = BUILDING_RESOURCE_META[res as BuildingCostResource];
                    return (
                      <View key={res} style={styles.resCell}>
                        {PACKAGE_RESOURCE_IMAGES[res] ? (
                          <Image source={PACKAGE_RESOURCE_IMAGES[res]} style={styles.resIcon} resizeMode="contain" />
                        ) : (
                          <Text style={styles.resIconText} numberOfLines={1}>{meta?.short ?? res}</Text>
                        )}
                        <Text style={styles.resValue}>{formatCost(v)}</Text>
                        <Text style={[styles.resLabel, { color: meta?.color ?? Colors.textTertiary }]} numberOfLines={1}>
                          {meta?.short ?? res}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {plan.blocking.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>What is blocking you</Text>
                <View style={styles.blockList}>
                  {plan.blocking.map((b, i) => (
                    <View
                      key={b}
                      style={[styles.blockRow, i === plan.blocking.length - 1 && styles.cardRowLast]}
                    >
                      <Ionicons name="alert-circle-outline" size={15} color={Colors.warning} />
                      <Text style={styles.blockText}>{b}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {plan.notes.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Notes</Text>
                <View style={styles.notes}>
                  {plan.notes.map((n, i) => (
                    <View
                      key={`${n}-${i}`}
                      style={[styles.noteRow, i === plan.notes.length - 1 && styles.cardRowLast]}
                    >
                      <Ionicons name="information-circle-outline" size={15} color={Colors.textTertiary} />
                      <Text style={styles.noteText}>{n}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        ) : null}
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
    padding: Spacing.base,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  header: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.title2,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  cardSub: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    flex: 1,
    ...Typography.footnote,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  summary: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  summaryMain: {
    gap: 2,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  summaryValue: {
    ...Typography.title1,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
  },
  summaryPillText: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  sectionTitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
  },
  list: {
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgSubtle,
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.bgCard,
  },
  rowFirst: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  rowLast: {
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  gearBox: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIcon: {
    width: 22,
    height: 22,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateDone: {
    backgroundColor: Colors.accentGhost,
  },
  stateTodo: {
    backgroundColor: Colors.bgCardHover,
  },
  reqIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqText: {
    flex: 1,
  },
  reqLabel: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  reqLabelDone: {
    color: Colors.textSecondary,
  },
  reqSub: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
    lineHeight: 15,
  },
  reqRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  reqTime: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  reqCost: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  doneBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
  },
  doneBadgeText: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm-1,
    backgroundColor: Colors.bgCardHover,
  },
  blockedBadgeText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  machineCard: {
    gap: Spacing.xs,
  },
  machineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  machineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  machineTitle: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  machineTime: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
  },
  chainOrderChip: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainOrderText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chainTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  workerPillText: {
    ...Typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  chainIconBox: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainIcon: {
    width: 24,
    height: 24,
  },
  chainText: {
    flex: 1,
    gap: 2,
  },
  chainTitle: {
    ...Typography.footnote,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  chainSub: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  chainRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  chainTime: {
    ...Typography.footnote,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chainCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  chainCostIcon: {
    width: 12,
    height: 12,
  },
  chainCost: {
    ...Typography.caption,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  machineEmpty: {
    ...Typography.caption,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.sm,
  },
  ctIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  resHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resHeaderText: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  resGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  resCell: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
  },
  resIcon: {
    width: 20,
    height: 20,
  },
  resIconText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textTertiary,
    width: 20,
    textAlign: 'center',
  },
  resValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  resLabel: {
    ...Typography.caption,
    marginLeft: 'auto',
    fontWeight: '600',
  },
  blockList: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 0.75,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  blockText: {
    flex: 1,
    ...Typography.footnote,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  cardRowLast: {
    borderBottomWidth: 0,
  },
  notes: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 0.75,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  noteText: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
});