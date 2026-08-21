import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { Chip } from '../../src/components/Chip';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SettingRow } from '../../src/components/SettingRow';
import { ItemCard } from '../../src/components/ItemCard';
import { MaxTimeScreenSkeleton } from '../../src/components/SkeletonScreens';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { useBuilderCount } from '../../src/hooks/useBuilderCount';
import { useDiscounts, type ScopeDiscount, type Discounts } from '../../src/hooks/useDiscounts';
import { getArmyTroopDetail, getArmyItemImage, getAllItemsAtTH, RESOURCE_META, type CostResource } from '../../src/utils/armyData';
import { getBuildingItemImage, BUILDING_RESOURCE_META, type BuildingCostResource } from '../../src/utils/buildingData';
import { PACKAGE_RESOURCE_IMAGES } from '../../src/data/packageImages';
import { computeMaxTime, type PipelineResult, type PipelineItemRow, type PipelineKey } from '../../src/utils/maxTime';
import { computeThReadiness } from '../../src/utils/thReadiness';
import { formatCost, formatTime, formatTimeShort, formatCostBreakdown } from '../../src/utils/upgradeCosts';
import type { TroopDetail } from '../../src/api/troopDetail';

const PIPELINE_META: Record<PipelineKey, { title: string; icon: keyof typeof Ionicons.glyphMap; desc: string }> = {
  lab: { title: 'Laboratory', icon: 'flask-outline', desc: 'Troops, spells & sieges — one research at a time' },
  builders: { title: 'Builders', icon: 'hammer-outline', desc: 'Buildings & heroes — scheduled across your builders' },
  pets: { title: 'Pet House', icon: 'paw-outline', desc: 'Pets — one upgrade at a time' },
  equipment: { title: 'Equipment', icon: 'diamond-outline', desc: 'Blacksmith — instant, ores only' },
};

const READINESS_PIPELINE_DESC: Record<string, string> = {
  lab: 'troops · spells · sieges',
  builders: 'buildings · heroes · walls',
  pets: 'pets',
};

const RESOURCE_ORDER: (CostResource | BuildingCostResource)[] = [
  'Gold',
  'Elixir',
  'Dark Elixir',
  'Builder Gold',
  'Builder Elixir',
  'Shiny Ore',
  'Glowing Ore',
  'Starry Ore',
];

const BUILDER_PILLS = [2, 3, 4, 5];

function applyScope(timeSec: number, cost: number, byResource: Record<string, number>, scope: ScopeDiscount) {
  const t = Math.max(0, Math.round(timeSec * (1 - scope.timePercent / 100)));
  const c = Math.max(0, Math.round(cost * (1 - scope.costPercent / 100)));
  const res: Record<string, number> = {};
  for (const [r, v] of Object.entries(byResource)) res[r] = Math.max(0, Math.round(v * (1 - scope.costPercent / 100)));
  return { timeSec: t, cost: c, byResource: res };
}

function rowScope(row: PipelineItemRow, heroNames: Set<string>, discounts: Discounts): ScopeDiscount {
  return heroNames.has(row.name) ? discounts.army : discounts.buildings;
}

function fmtDelta(sec: number): string {
  return sec > 0 ? `+${formatTimeShort(sec)}` : '—';
}

export default function MaxTimeScreen() {
  const { player, loading } = usePlayer();
  const { colors } = useTheme();
  const { count: builderCount, setBuilderCount, loaded: builderLoaded } = useBuilderCount();
  const { discounts } = useDiscounts();
  const [details, setDetails] = useState<Record<string, TroopDetail | null> | null>(null);
  const [expanded, setExpanded] = useState<Record<PipelineKey, boolean>>({ lab: false, builders: false, pets: false, equipment: false });
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [buildersExpanded, setBuildersExpanded] = useState(false);
  const [labExpanded, setLabExpanded] = useState(false);

  const th = player?.townHallLevel ?? 1;

  const armyNames = useMemo(() => {
    if (!player) return [] as string[];
    const names = new Set<string>();
    [...(player.troops ?? []), ...(player.spells ?? []), ...(player.heroes ?? []), ...(player.pets ?? [])]
      .filter((i) => i.village !== 'builderBase')
      .forEach((i) => names.add(i.name));
    // Include not-yet-unlocked items so their details are available too.
    for (const item of getAllItemsAtTH(th + 1)) names.add(item.name);
    return [...names];
  }, [player, th]);

  const heroNames = useMemo(() => new Set((player?.heroes ?? []).map((h) => h.name)), [player]);

  useEffect(() => {
    let active = true;
    setDetails(null);
    if (!player || armyNames.length === 0) {
      setDetails({});
      return;
    }
    (async () => {
      const fetched = await Promise.all(armyNames.map((n) => getArmyTroopDetail(n).catch(() => null)));
      if (!active) return;
      const next: Record<string, TroopDetail | null> = {};
      fetched.forEach((d, i) => { next[armyNames[i]] = d; });
      setDetails(next);
    })();
    return () => { active = false; };
  }, [player, armyNames]);

  const result = useMemo(() => {
    if (!player || !details) return null;
    return computeMaxTime({ player, th, builderCount, armyDetails: details });
  }, [player, th, builderCount, details]);

  const readiness = useMemo(() => {
    if (!player) return null;
    return computeThReadiness(player, th);
  }, [player, th]);

  const discounted = useMemo(() => {
    if (!result) return null;
    const lab = applyScope(result.lab.timeSec, result.lab.cost, result.lab.byResource, discounts.army);
    const pets = applyScope(result.pets.timeSec, result.pets.cost, result.pets.byResource, discounts.army);
    const equipment = applyScope(result.equipment.timeSec, result.equipment.cost, result.equipment.byResource, discounts.army);
    const builders = applyScope(result.builders.timeSec, result.builders.cost, result.builders.byResource, discounts.buildings);
    const totalByResource: Record<string, number> = {};
    for (const p of [lab, builders, pets, equipment]) {
      for (const [r, v] of Object.entries(p.byResource)) totalByResource[r] = (totalByResource[r] ?? 0) + v;
    }
    return {
      lab,
      builders,
      pets,
      equipment,
      headlineTime: Math.max(lab.timeSec, builders.timeSec, pets.timeSec, equipment.timeSec),
      totalByResource,
    };
  }, [result, discounts]);

  const nextResult = useMemo(() => {
    if (!player || !details) return null;
    return computeMaxTime({ player, th: th + 1, builderCount, armyDetails: details });
  }, [player, th, builderCount, details]);

  const nextDiscounted = useMemo(() => {
    if (!nextResult) return null;
    const lab = applyScope(nextResult.lab.timeSec, nextResult.lab.cost, nextResult.lab.byResource, discounts.army);
    const pets = applyScope(nextResult.pets.timeSec, nextResult.pets.cost, nextResult.pets.byResource, discounts.army);
    const equipment = applyScope(nextResult.equipment.timeSec, nextResult.equipment.cost, nextResult.equipment.byResource, discounts.army);
    const builders = applyScope(nextResult.builders.timeSec, nextResult.builders.cost, nextResult.builders.byResource, discounts.buildings);
    return {
      lab,
      builders,
      pets,
      equipment,
      headlineTime: Math.max(lab.timeSec, builders.timeSec, pets.timeSec, equipment.timeSec),
    };
  }, [nextResult, discounts]);

  if (loading || !player || !builderLoaded || !result || !discounted) {
    return (
      <MaxTimeScreenSkeleton />
    );
  }

  const summaryTime = discounted ? formatTime(discounted.headlineTime) : '…';

  const rowTimeSec = (row: PipelineItemRow, key: PipelineKey, scope: ScopeDiscount) => {
    const itemScope = key === 'builders' ? rowScope(row, heroNames, discounts) : scope;
    return Math.max(0, Math.round(row.timeSec * (1 - itemScope.timePercent / 100)));
  };

  const renderItems = (items: PipelineItemRow[], key: PipelineKey, scope: ScopeDiscount) =>
    [...items]
      .sort((a, b) => {
        const ta = rowTimeSec(a, key, scope);
        const tb = rowTimeSec(b, key, scope);
        return ta - tb;
      })
      .map((row, i) => {
        const itemScope = key === 'builders' ? rowScope(row, heroNames, discounts) : scope;
        const timeSec = rowTimeSec(row, key, scope);
        const cost = Math.max(0, Math.round(row.cost * (1 - itemScope.costPercent / 100)));
        const byResource: Record<string, number> = {};
        for (const [r, v] of Object.entries(row.byResource)) byResource[r] = Math.max(0, Math.round(v * (1 - itemScope.costPercent / 100)));
        const isBuilding = key === 'builders' && !heroNames.has(row.name);
        const iconSource = isBuilding
          ? getBuildingItemImage(row.name, row.iconLevel)
          : getArmyItemImage(row.name);
        return (
          <ItemCard
            key={row.name}
            name={row.name}
            level={row.currentLevel}
            maxLevel={row.maxLevel}
            thMaxLevel={row.maxLevel}
            iconSource={iconSource ?? undefined}
            costLabel={formatCostBreakdown(byResource) || formatCost(cost)}
            costResources={Object.keys(byResource).length > 0 ? byResource : undefined}
            timeLabel={timeSec > 0 ? formatTimeShort(timeSec) : ''}
            isLast={i === items.length - 1}
          />
        );
      });

  const renderResourceRows = (byResource: Record<string, number>) => {
    const entries = (Object.entries(byResource).filter(([, v]) => v > 0) as [string, number][])
      .filter(([r]) => r !== 'Unknown')
      .sort((a, b) => {
        const ia = RESOURCE_ORDER.indexOf(a[0] as (CostResource | BuildingCostResource));
        const ib = RESOURCE_ORDER.indexOf(b[0] as (CostResource | BuildingCostResource));
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
    const withIcon = entries.filter(([r]) => PACKAGE_RESOURCE_IMAGES[r]);
    const fallback = entries.filter(([r]) => !PACKAGE_RESOURCE_IMAGES[r]);
    return (
      <>
        {withIcon.map(([r, v]) => (
          <View key={r} style={styles.oreRow}>
            <Image source={PACKAGE_RESOURCE_IMAGES[r]} style={styles.oreIcon} resizeMode="contain" />
            <Text style={[styles.oreLabel, { color: RESOURCE_META[r as CostResource]?.color ?? '#94A3B8' }]}>
              {RESOURCE_META[r as CostResource]?.label ?? BUILDING_RESOURCE_META[r as BuildingCostResource]?.label ?? r}
            </Text>
            <Text style={styles.oreValue}>{formatCost(v)}</Text>
          </View>
        ))}
        {fallback.length > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Resources</Text>
            <Text style={styles.summaryValue}>{formatCostBreakdown(byResource)}</Text>
          </View>
        )}
      </>
    );
  };

  const renderPipeline = (p: PipelineResult, scope: ScopeDiscount, isLast: boolean) => {
    const meta = PIPELINE_META[p.key];
    const isOpen = expanded[p.key];
    const d = discounted ? discounted[p.key] : null;
    const isEquipment = p.key === 'equipment';
    const buildingSplitSec = (sec: number, isHero = false) => {
      const pct = isHero ? discounts.army.timePercent : discounts.buildings.timePercent;
      return Math.max(0, Math.round(sec * (1 - pct / 100)));
    };
    const headerIconSource = p.key === 'lab'
      ? getBuildingItemImage('Lab')
      : p.key === 'builders'
        ? getBuildingItemImage('Builder Hut')
        : isEquipment
          ? (player?.heroEquipment?.[0] ? getArmyItemImage(player.heroEquipment[0].name) : undefined)
          : getBuildingItemImage('Pet House');
    return (
      <React.Fragment key={p.key}>
        <SettingRow
          icon={meta.icon}
          iconSource={headerIconSource ?? undefined}
          title={meta.title}
          desc={meta.desc}
          compact
          isFirst={isOpen}
          isLast={isLast && !isOpen}
          onPress={() => setExpanded((prev) => ({ ...prev, [p.key]: !prev[p.key] }))}
          children={
            <View style={styles.pipelineBadge}>
              <Text style={styles.pipelineTime}>{isEquipment ? 'Instant' : d ? formatTimeShort(d.timeSec) : '…'}</Text>
            </View>
          }
        />
        {isOpen && (
          <View style={styles.pipelineBody}>
            {p.items.length > 0 ? (
              <>
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Time</Text>
                    <Text style={styles.summaryValue}>{isEquipment ? 'Instant' : formatTime(d ? d.timeSec : p.timeSec)}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  {p.split && (
                    <>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Buildings only</Text>
                        <Text style={styles.summaryValue}>
                          {formatTime(buildingSplitSec(p.split.buildingsOnlySec))}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Heroes only</Text>
                        <Text style={styles.summaryValue}>
                          {formatTime(buildingSplitSec(p.split.heroesOnlySec, true))}
                        </Text>
                      </View>
                      {p.split.optimalHeroBuilders >= 0 && (
                        <View style={styles.summaryRow}>
                          <Text style={styles.summaryLabel}>Optimal split</Text>
                          <Text style={styles.summaryValue}>
                            {p.split.optimalHeroBuilders}H / {p.split.optimalBuildingBuilders}B →{' '}
                            {formatTime(buildingSplitSec(p.split.optimalSec))}
                          </Text>
                        </View>
                      )}
                      <View style={styles.summaryDivider} />
                    </>
                  )}
                  {renderResourceRows(d ? d.byResource : p.byResource)}
                </View>
                {renderItems(p.items, p.key, scope)}
              </>
            ) : (
              <Text style={styles.emptyText}>Nothing left to upgrade</Text>
            )}
            {!isLast && <View style={styles.sectionSeparator} />}
          </View>
        )}
      </React.Fragment>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Time to Max</Text>
          <Text style={styles.subtitle}>Remaining upgrades for Town Hall {th}</Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Estimated time to max</Text>
          <Text style={styles.heroTime}>{summaryTime}</Text>
          <Text style={styles.heroNote}>
            Laboratory, builders & pets run in parallel — this is the longest pipeline
          </Text>
          {discounted && Object.keys(discounted.totalByResource).length > 0 && (
            <View style={styles.heroResourcesGrid}>
              {(Object.entries(discounted.totalByResource).filter(([, v]) => v > 0) as [string, number][])
                .filter(([r]) => r !== 'Unknown')
                .sort((a, b) => {
                  const ia = RESOURCE_ORDER.indexOf(a[0] as (CostResource | BuildingCostResource));
                  const ib = RESOURCE_ORDER.indexOf(b[0] as (CostResource | BuildingCostResource));
                  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                })
                .map(([r, v], index, arr) => {
                  const icon = PACKAGE_RESOURCE_IMAGES[r];
                  const color = RESOURCE_META[r as CostResource]?.color ?? BUILDING_RESOURCE_META[r as BuildingCostResource]?.color ?? '#94A3B8';
                  return (
                    <View
                      key={r}
                      style={[
                        styles.heroResourceCell,
                        index === 0 && { borderTopLeftRadius: Radius.xl * 1.25 },
                        index === 1 && { borderTopRightRadius: Radius.xl * 1.25 },
                        index === arr.length - 2 && index % 2 === 0 && { borderBottomLeftRadius: Radius.xl * 1.25 },
                        index === arr.length - 1 && { borderBottomRightRadius: Radius.xl * 1.25 },
                      ]}
                    >
                      {icon ? (
                        <Image source={icon} style={styles.heroResourceIcon} resizeMode="contain" />
                      ) : (
                        <View style={[styles.heroResourceDot, { backgroundColor: color }]} />
                      )}
                      <Text style={[styles.heroResourceValue, { color }]}>{formatCost(v)}</Text>
                    </View>
                  );
                })}
            </View>
          )}
        </View>

        <View style={styles.sectionHeaderWrap}>
          <SectionHeader title="Builders" />
        </View>
        <View style={styles.builderCard}>
          <View style={styles.builderTextBlock}>
            <Text style={styles.builderTitle}>Builders</Text>
            <Text style={styles.builderDesc}>Building & hero time is divided across these</Text>
          </View>
          <View style={styles.builderChips}>
            {BUILDER_PILLS.map((n) => (
              <Chip
                key={n}
                label={String(n)}
                selected={builderCount === n}
                onPress={() => setBuilderCount(n)}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionHeaderWrap}>
          <SectionHeader title="Pipelines" />
        </View>
        <View style={styles.pipelineSections}>
          {renderPipeline(result.lab, discounts.army, false)}
          {renderPipeline(result.builders, discounts.buildings, false)}
          {renderPipeline(result.pets, discounts.army, false)}
          {renderPipeline(result.equipment, discounts.army, true)}
        </View>

        <View style={styles.sectionHeaderWrap}>
          <SectionHeader title="TH Upgrade Readiness" />
        </View>
        <View style={styles.readinessSection}>
          <SettingRow
            icon="trending-up-outline"
            title={readiness ? `Ready for TH${readiness.nextTh}?` : 'TH Upgrade Readiness'}
            desc={readiness ? readiness.verdictLabel : ''}
            compact
            isFirst
            isLast={!readinessOpen}
            onPress={() => setReadinessOpen((o) => !o)}
            children={
              readiness && (
                <View style={styles.pipelineBadge}>
                  <Text style={styles.pipelineTime}>{Math.round(readiness.score)}%</Text>
                </View>
              )
            }
          />
          {readinessOpen && readiness && (
            <View style={styles.readinessBody}>
              <View style={styles.readinessTop}>
                <Text
                  style={[
                    styles.readinessVerdict,
                    { color: readiness.verdict === 'ready' ? Colors.success : readiness.verdict === 'almost' ? Colors.warning : Colors.destructive },
                  ]}
                >
                  {readiness.verdictLabel}
                </Text>
                <Text style={styles.readinessScore}>{Math.round(readiness.score)}%</Text>
              </View>
              <View style={styles.readinessTrack}>
                <View style={[styles.readinessFill, { width: `${Math.max(2, readiness.score)}%` }]} />
              </View>
              <Text style={styles.readinessNote}>{readiness.note}</Text>
              {readiness.nextUnlocks.length > 0 && (
                <Text style={styles.readinessNext}>
                  Unlocks at TH{readiness.nextTh}: {readiness.nextUnlocks.map((u) => u.value).join(' · ')}
                </Text>
              )}
            </View>
          )}
          {readinessOpen && readiness && (
            <React.Fragment>
              {readiness.pipelines.map((p, i) => {
                const isBuilders = p.key === 'builders';
                const isLab = p.key === 'lab';
                const isOpen = isBuilders ? buildersExpanded : isLab ? labExpanded : false;
                const isExpandable = isBuilders || isLab;
                return (
                  <React.Fragment key={p.key}>
                    <SettingRow
                      icon={PIPELINE_META[p.key].icon}
                      title={PIPELINE_META[p.key].title}
                      desc={READINESS_PIPELINE_DESC[p.key]}
                      compact
                      isLast={isExpandable ? !isOpen : i === readiness.pipelines.length - 1}
                      onPress={isExpandable ? (isBuilders ? () => setBuildersExpanded((o) => !o) : () => setLabExpanded((o) => !o)) : undefined}
                      children={
                        <View style={styles.readinessChildren}>
                          <View style={styles.pipelineBadge}>
                            <Text style={styles.pipelineTime}>{Math.round(p.pct)}%</Text>
                          </View>
                          {isExpandable && (
                            <Ionicons
                              name="chevron-down"
                              size={16}
                              color={colors.textTertiary}
                              style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                            />
                          )}
                        </View>
                      }
                    />
                    {isExpandable && isOpen && (
                      <View style={styles.pipelineExpandBody}>
                        {p.children.map((c) => (
                          <View key={c.key} style={styles.readinessCatRow}>
                            <Text style={styles.readinessCatLabel}>{c.label}</Text>
                            <View style={styles.readinessCatTrack}>
                              <View style={[styles.readinessCatFill, { width: `${Math.max(2, c.pct)}%` }]} />
                            </View>
                            <Text style={styles.readinessCatPct}>{Math.round(c.pct)}%</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          )}
          {readinessOpen && readiness && discounted && nextDiscounted && (
            <React.Fragment>
              <SettingRow
                icon="trending-up-outline"
                title={`Rush to TH${readiness.nextTh}`}
                desc={
                  nextDiscounted.headlineTime > discounted.headlineTime
                    ? `with current levels · ${fmtDelta(nextDiscounted.headlineTime - discounted.headlineTime)} extra`
                    : 'with current levels · no extra time'
                }
                compact
                isFirst
                isLast
                children={
                  <View style={styles.pipelineBadge}>
                    <Text style={styles.pipelineTime}>{formatTimeShort(nextDiscounted.headlineTime)}</Text>
                  </View>
                }
              />
              <Text style={[styles.readinessNext, styles.readinessFooter]}>
                TH{readiness.nextTh} adds → Lab {fmtDelta(Math.max(0, nextDiscounted.lab.timeSec - discounted.lab.timeSec))} · Builders{' '}
                {fmtDelta(Math.max(0, nextDiscounted.builders.timeSec - discounted.builders.timeSec))} · Pets{' '}
                {fmtDelta(Math.max(0, nextDiscounted.pets.timeSec - discounted.pets.timeSec))} · Equipment Instant
              </Text>
            </React.Fragment>
          )}
        </View>
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
    paddingBottom: 150,
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
  heroCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: Radius.xxl,
    backgroundColor: Colors.bgCard,
  },
  heroLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  heroTime: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '800',
  },
  heroNote: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  heroResourcesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    justifyContent: 'space-between',
  },
  heroResourceCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    minWidth: '48%',
    flex: 1,
  },
  heroResourceIcon: {
    width: 32,
    height: 32,
    marginRight: Spacing.lg,
  },
  heroResourceDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: Spacing.lg,
  },
  heroResourceValue: {
    ...Typography.body,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  readinessSection: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
    borderRadius: Radius.xl * 1.25,
    overflow: 'hidden',
  },
  readinessBody: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  readinessTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  readinessText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  readinessLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  readinessVerdict: {
    ...Typography.headline,
    fontWeight: '700',
  },
  readinessScore: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  readinessTrack: {
    height: 8,
    borderRadius: 6,
    backgroundColor: Colors.progressTrack,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  readinessFill: {
    height: '100%',
    backgroundColor: Colors.textPrimary,
    borderRadius: 6,
  },
  readinessNote: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  readinessNext: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 16,
  },
  readinessFooter: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  readinessChildren: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pipelineExpandBody: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  readinessCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  readinessCatLabel: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    width: 86,
    fontWeight: '600',
  },
  readinessCatTrack: {
    flex: 1,
    height: 6,
    borderRadius: 5,
    backgroundColor: Colors.progressTrack,
    overflow: 'hidden',
  },
  readinessCatFill: {
    height: '100%',
    backgroundColor: Colors.textSecondary,
    borderRadius: 6,
  },
  readinessCatPct: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    width: 34,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  builderCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  builderTextBlock: {
    flex: 1,
  },
  builderTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  builderDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  builderChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionHeaderWrap: {
    paddingHorizontal: Spacing.base,
  },
  pipelineSections: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
    borderRadius: Radius.xl * 1.25,
    overflow: 'hidden',
  },
  pipelineBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineTime: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pipelineBody: {
    paddingTop: 0,
  },
  sectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    margin: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  summaryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: Spacing.md,
  },
  oreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  oreIcon: {
    width: 18,
    height: 18,
  },
  oreLabel: {
    ...Typography.footnote,
    flex: 1,
    fontWeight: '600',
  },
  oreValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
});
