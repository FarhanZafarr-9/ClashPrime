import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { filterHomeTroops } from '../../src/types/clash';
import { getMaxLevelAtTH } from '../../src/utils/thMaxLevels';
import { getTroopImageUrl, getHeroImageUrl, getPetImageUrl, getEquipmentImageUrl, getHeroSlug } from '../../src/utils/troopImages';
import { getTroopDetail, TroopDetail } from '../../src/api/troopDetail';
import { ItemCard } from '../../src/components/ItemCard';

import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { ProfileScreenSkeleton } from '../../src/components/SkeletonScreens';
import { Skeleton } from '../../src/components/Skeleton';


type Tab = 'heroes' | 'pets' | 'troops' | 'spells' | 'equipment';

const TAB_ICONS: Record<Tab, { set: 'ion' | 'mc'; name: string }> = {
  heroes: { set: 'ion', name: 'shield-half-outline' },
  pets: { set: 'mc', name: 'paw' },
  troops: { set: 'mc', name: 'sword-cross' },
  spells: { set: 'ion', name: 'flask-outline' },
  equipment: { set: 'ion', name: 'trophy-outline' },
};

// Decodes an "Unlock Requirement" value (e.g. "Buy in X event for 3,100 ... or
// purchasable from the Trader for 1,500") into discrete unlock methods.
function parseUnlockRequirements(raw: string): { source: string; cost?: string; kind: 'event' | 'shop' | 'other' }[] {
  const text = (raw || '').trim();
  if (!text) return [];
  const items: { source: string; cost?: string; kind: 'event' | 'shop' | 'other' }[] = [];
  const eventRe = /Buy in\s+([\s\S]+?)\s+event for\s+([\d,]+)/gi;
  let m: RegExpExecArray | null;
  let foundEvent = false;
  while ((m = eventRe.exec(text)) !== null) {
    items.push({ source: m[1].trim(), cost: m[2].trim(), kind: 'event' });
    foundEvent = true;
  }
  if (foundEvent) {
    const shop = text.match(/purchasable from the\s+([\s\S]+?)\s+for\s+([\d,]+)/i);
    if (shop) items.push({ source: shop[1].trim(), cost: shop[2].trim(), kind: 'shop' });
    return items;
  }
  return [{ source: text, kind: 'other' }];
}

export default function PlayerProfileScreen() {
  const { player, loading, refresh } = usePlayer();
  const { isDark, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('heroes');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedName, setExpandedName] = useState<string | null>(null);

  const [details, setDetails] = useState<Record<string, TroopDetail | null>>({});
  const [showFullLevels, setShowFullLevels] = useState<Record<string, boolean>>({});

  type StatPill = { icon: keyof typeof Ionicons.glyphMap; value: string };

  function formatStatPills(info: TroopDetail['info']): StatPill[] {
    const pills: StatPill[] = [];

    if (info.damageType) {
      const dt = info.damageType.toLowerCase();
      let icon: keyof typeof Ionicons.glyphMap = 'flash-outline';
      let label = '';

      if (dt.includes('melee')) { icon = 'cut-outline'; label = 'Melee'; }
      else if (dt.includes('ranged')) { icon = 'arrow-up-outline'; label = 'Ranged'; }
      else if (dt.includes('splash')) {
        icon = 'flame-outline';
        const r = dt.match(/[\d.]+/);
        label = r ? `Splash ${r[0]}` : 'Splash';
      }
      else if (dt.includes('single')) { icon = 'locate-outline'; label = 'Single'; }
      else { label = dt.replace(/tile radius/i, '').trim(); }

      if (info.targetType) {
        const tt = info.targetType.toLowerCase();
        if (tt.includes('ground') && tt.includes('air')) label += ' · All';
        else if (tt.includes('ground')) label += ' · Ground';
        else if (tt.includes('air')) label += ' · Air';
      }
      pills.push({ icon, value: label });
    }

    if (info.attackSpeed) {
      const speedVal = info.attackSpeed.toLowerCase();
      const damageKeywords = /melee|ranged|splash|tile|radius|ground|air|single/i;
      if (!damageKeywords.test(speedVal)) {
        const s = speedVal.replace(/ seconds?/i, 's');
        pills.push({ icon: 'time-outline', value: s });
      }
    }

    if (info.range) {
      const r = info.range.replace(/ tiles?/i, '').trim();
      pills.push({ icon: 'radio-outline', value: r });
    }

    if (info.housingSpace > 0) {
      pills.push({ icon: 'cube-outline', value: `${info.housingSpace}` });
    }

    if (info.favoriteTarget) {
      pills.push({ icon: 'heart-half-outline', value: info.favoriteTarget });
    }

    return pills;
  }

  const toggleDetail = useCallback(async (name: string) => {
    // Collapse if already open.
    if (expandedName === name) {
      setExpandedName(null);
      return;
    }
    setExpandedName(name);
    // Fetch on first expansion (or if a previous fetch failed).
    if (details[name] === undefined) {
      let detail = await getTroopDetail(name);
      if (detail) {
        const allItems = player
          ? [
            ...player.heroes,
            ...player.troops,
            ...player.spells,
            ...player.heroEquipment,
            ...(player.pets ?? []),
          ]
          : [];
        const match = allItems.find((i) => i.name === name);
        if (match) {
          detail.currentLevel = match.level;
          detail.maxLevel = match.maxLevel;
        }
      } else if (player) {
        const heroUrl = getHeroImageUrl(name);
        const petUrl = getPetImageUrl(name);
        const equipUrl = getEquipmentImageUrl(name);
        const imageUrl = heroUrl || petUrl || equipUrl;
        if (imageUrl) {
          const allItems = [
            ...player.heroes,
            ...player.troops,
            ...player.spells,
            ...player.heroEquipment,
            ...(player.pets ?? []),
          ];
          const match = allItems.find((i) => i.name === name);
          detail = {
            name, slug: '', description: '', imageUrl,
            currentLevel: match?.level,
            maxLevel: match?.maxLevel,
            levels: match ? [{ level: match.level, dps: 0, damagePerHit: 0, hitpoints: 0, upgradeCost: '', upgradeTime: '', xp: 0, labLevel: null, thRequired: null }] : [],
            info: { range: '', housingSpace: 0, attackSpeed: '', damageType: '', targetType: '', favoriteTarget: '' },
          };
        }
      }
      setDetails((prev) => ({ ...prev, [name]: detail ?? null }));

      // Prefetch images for caching
      const urls = [
        detail?.imageUrl,
        getHeroImageUrl(name),
        getTroopImageUrl(name),
        getPetImageUrl(name),
        getEquipmentImageUrl(name),
      ].filter((u): u is string => !!u);
      urls.forEach((url) => Image.prefetch(url).catch(() => {}));
    }
  }, [expandedName, details, player]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();

    // Re-fetch all troops/spells/heroes/pets/equipment, bypassing the cache so
    // that previously missing images or details get updated. Awaiting the full
    // batch keeps the spinner visible until every detail/image is refetched.
    if (player) {
      const allItems = [
        ...player.heroes,
        ...player.troops,
        ...player.spells,
        ...player.heroEquipment,
        ...(player.pets ?? []),
      ];
      const fetched = await Promise.all(
        allItems.map((item) => getTroopDetail(item.name, true).catch(() => null))
      );
      const nextDetails: Record<string, TroopDetail | null> = {};
      fetched.forEach((detail) => {
        if (detail) {
          nextDetails[detail.name] = detail;
          // Prefetch images for caching
          const urls = [
            detail.imageUrl,
            getHeroImageUrl(detail.name),
            getTroopImageUrl(detail.name),
            getPetImageUrl(detail.name),
            getEquipmentImageUrl(detail.name),
          ].filter((u): u is string => !!u);
          urls.forEach((url) => Image.prefetch(url).catch(() => {}));
        }
      });
      setDetails((prev) => ({ ...prev, ...nextDetails }));
    }

    setRefreshing(false);
  }, [refresh, player]);

  if (loading && !player) {
    return <ProfileScreenSkeleton />;
  }

  if (!player) return null;

  const th = player.townHallLevel;
  const homeHeroes = player.heroes.filter((h) => h.village === 'home');
  const builderHeroes = th >= 6 ? player.heroes.filter((h) => h.village === 'builderBase') : [];
  const homeTroops = filterHomeTroops(player.troops);
  const builderTroops = th >= 6 ? player.troops.filter((t) => t.village === 'builderBase') : [];
  const homePets = (player.pets ?? []).filter((p) => p.village === 'home' || !p.village);
  const laboratoryMaxLevel = getMaxLevelAtTH('Lab', player.townHallLevel) ?? 0;
  const heroHallMaxLevel = getMaxLevelAtTH('Hero Hall', player.townHallLevel) ?? 0;

  const isBuilderBaseName = (name: string) =>
    player.troops.some((t) => t.name === name && t.village === 'builderBase') ||
    player.heroes.some((h) => h.name === name && h.village === 'builderBase');

  // Returns the level rows to show for an expanded item, applying the right
  // gating per village/hero. Builder Base units are never filtered by the Home Lab.
  const getVisibleLevels = (detail: TroopDetail): TroopDetail['levels'] => {
    const isHero = !!getHeroSlug(detail.name);
    const isBB = isBuilderBaseName(detail.name);
    if (isBB) return detail.levels;
    // Spells/equipment don't have DPS/HP, so they aren't gated by the troop Lab — show all.
    const hasTroopStats = detail.levels.some((l) => l.dps > 0 || l.hitpoints > 0);
    if (!hasTroopStats) return detail.levels;
    const maxHeroLevel = isHero ? getMaxLevelAtTH(detail.name, player.townHallLevel) : null;
    return detail.levels.filter((l) => {
      if (isHero) {
        if (maxHeroLevel !== null) return l.level <= maxHeroLevel;
        return l.labLevel == null || l.labLevel <= heroHallMaxLevel;
      }
      return l.labLevel == null || l.labLevel <= laboratoryMaxLevel;
    });
  };

  // Inline expansion panel rendered directly under a tapped card (replaces the
  // old modal). Because it lives in the page's own ScrollView, the stats table
  // scrolls naturally with the page — no nested-scroll quirks.
  const renderDetailPanel = (name: string) => {
    if (expandedName !== name) return null;
    const detail = details[name];

    if (detail === undefined) {
      return (
        <View style={[styles.panel, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
          {/* Description skeleton */}
          <View style={{ marginBottom: Spacing.base, gap: 4 }}>
            <Skeleton width="100%" height={10} borderRadius={3} />
            <Skeleton width="75%" height={10} borderRadius={3} />
          </View>
          {/* Pills skeleton */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.base }}>
            {[60, 50, 70, 40].map((w, i) => (
              <Skeleton key={i} width={w} height={22} borderRadius={11} />
            ))}
          </View>
          {/* Stats table skeleton */}
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: Radius.sm, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
              {['Lvl', 'DPS', 'HP', 'Cost', 'Time', 'Lab'].map((_, i) => (
                <View key={i} style={{ flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, alignItems: 'center' }}>
                  <Skeleton width={i === 0 ? 20 : 30} height={10} borderRadius={3} />
                </View>
              ))}
            </View>
            {[0, 1, 2].map((r) => (
              <View key={r} style={{ flexDirection: 'row', borderBottomWidth: r < 2 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }}>
                {[0, 1, 2, 3, 4, 5].map((c) => (
                  <View key={c} style={{ flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, alignItems: 'center' }}>
                    <Skeleton width={c === 0 ? 16 : c === 3 ? 36 : 28} height={10} borderRadius={3} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    }
    if (detail === null) {
      return (
        <View style={[styles.panelEmpty, { borderColor: colors.border }]}>
          <Text style={[styles.panelEmptyText, { color: colors.textTertiary }]}>
            No detailed stats available for {name}.
          </Text>
        </View>
      );
    }

    const isHero = !!getHeroSlug(detail.name);
    const isBB = isBuilderBaseName(detail.name);
    const maxHeroLevel = isHero ? getMaxLevelAtTH(detail.name, player.townHallLevel) : null;
    const visibleDetailLevels = getVisibleLevels(detail);

    const currentLevel = detail.currentLevel ?? 0;
    const showFull = showFullLevels[name] || false;

    let displayLevels: TroopDetail['levels'];
    if (showFull || visibleDetailLevels.length <= 3) {
      displayLevels = visibleDetailLevels;
    } else {
      const currentIdx = visibleDetailLevels.findIndex((l) => l.level === currentLevel);
      const start = Math.max(0, currentIdx - 1);
      const end = Math.min(visibleDetailLevels.length, currentIdx + 2);
      displayLevels = visibleDetailLevels.slice(start, end);
    }

    const pills = formatStatPills(detail.info);
    const infoItems = pills.length ? pills : (detail.infoPairs ?? []).map((p) => ({ icon: 'information-circle-outline' as const, value: `${p.label}: ${p.value}` }));
    const unlockReq = detail.infoPairs?.find((i) => i.label === 'Unlock Requirement');
    const unlockReqItems = unlockReq ? parseUnlockRequirements(unlockReq.value) : [];
    const unlockHasCost = unlockReqItems.some((r) => r.cost);

    const isTroopLike = (detail.levels[0]?.dps ?? 0) > 0 || (detail.levels[0]?.hitpoints ?? 0) > 0;
    const extraLabels = detail.levels[0]?.extra?.map((e) => e.label) ?? [];

    return (
      <View style={[styles.panel, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
        {detail.description ? (
          <View style={styles.panelHeader}>
            <Text style={[styles.panelDesc, { color: colors.textTertiary }]}>{detail.description}</Text>
          </View>
        ) : null}

        {pills.length > 0 && (
          <View style={styles.panelPillsRow}>
            {pills.map((pill) => (
              <View key={pill.value} style={[styles.panelPill, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Ionicons name={pill.icon} size={11} color={colors.textSecondary} />
                <Text style={[styles.panelPillText, { color: colors.textPrimary }]}>{pill.value}</Text>
              </View>
            ))}
          </View>
        )}

        {unlockReqItems.length > 0 ? (
          <View style={[styles.panelTable, { borderColor: colors.border }]}>
            <View style={[styles.panelTableRow, { borderBottomColor: colors.border }]}>
              <Text
                style={[
                  styles.panelTableCell,
                  styles.panelTableHeader,
                  { backgroundColor: colors.bgCard, color: colors.textMuted, textAlign: 'center', flex: unlockHasCost ? 2 : 1 },
                ]}
              >
                {unlockHasCost ? 'Unlock Method' : 'Unlock Requirement'}
              </Text>
              {unlockHasCost ? (
                <Text
                  style={[
                    styles.panelTableCell,
                    styles.panelTableHeader,
                    { backgroundColor: colors.bgCard, color: colors.textMuted },
                  ]}
                >
                  Cost
                </Text>
              ) : null}
            </View>
            {unlockReqItems.map((r, i) => (
              <View key={i} style={[styles.panelTableRow, { borderBottomColor: colors.border }]}>
                <Text
                  style={[
                    styles.panelTableCell,
                    { color: colors.textSecondary, textAlign: 'center', flex: unlockHasCost ? 2 : 1, paddingLeft: Spacing.base },
                  ]}
                >
                  {r.source}
                </Text>
                {unlockHasCost ? (
                  <Text style={[styles.panelTableCell, { color: colors.textPrimary, fontWeight: '600' }]}>{r.cost}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {visibleDetailLevels.length > 0 && (
          <>
            <Text style={[styles.panelSectionTitle, { color: colors.textPrimary }]}>Level Stats</Text>
            <View style={[styles.panelTable, { borderColor: colors.border }]}>
              <View style={[styles.panelTableRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>Lvl</Text>
                {isTroopLike ? (
                  <>
                    <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>DPS</Text>
                    <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>HP</Text>
                  </>
                ) : (
                  extraLabels.map((lbl) => (
                    <Text key={lbl} style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>{lbl}</Text>
                  ))
                )}
                <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>Cost</Text>
                <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>Time</Text>
                <Text style={[styles.panelTableCell, styles.panelTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>{isHero ? 'Hero Hall' : isBB ? 'Star Laboratory' : 'Laboratory'}</Text>
              </View>
              {displayLevels.map((l) => {
                const isCurrentRow = l.level === currentLevel;
                return (
                  <View key={l.level} style={[styles.panelTableRow, { borderBottomColor: colors.border }, isCurrentRow && { backgroundColor: colors.accentGhost }]}>
                    <Text style={[styles.panelTableCell, { color: colors.textSecondary }]}>{l.level}</Text>
                    {isTroopLike ? (
                      <>
                        <Text style={[styles.panelTableCell, { color: colors.textSecondary }]}>{l.dps}</Text>
                        <Text style={[styles.panelTableCell, { color: colors.textSecondary }]}>{l.hitpoints}</Text>
                      </>
                    ) : (
                      extraLabels.map((lbl) => (
                        <Text key={lbl} style={[styles.panelTableCell, { color: colors.textSecondary }]}>
                          {l.extra?.find((e) => e.label === lbl)?.value ?? '—'}
                        </Text>
                      ))
                    )}
                    <Text style={[styles.panelTableCell, { color: colors.textSecondary }]}>{l.upgradeCost || '—'}</Text>
                    <Text style={[styles.panelTableCell, { color: colors.textSecondary }]}>{l.upgradeTime || '—'}</Text>
                    <Text style={[styles.panelTableCell, { color: colors.textSecondary }]}>{l.labLevel ?? '—'}</Text>
                  </View>
                );
              })}
            </View>
            {visibleDetailLevels.length > 3 && (
              <Pressable
                style={styles.expandTableBtn}
                onPress={() => setShowFullLevels((prev) => ({ ...prev, [name]: !showFull }))}
              >
                <Ionicons name={showFull ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textSecondary} />
                <Text style={styles.expandTableText}>
                  {showFull ? 'Show fewer' : `Show all ${visibleDetailLevels.length} levels`}
                </Text>
              </Pressable>
            )}
            <Text style={[styles.panelNote, { color: colors.textMuted }]}>
              {isBB
                ? `Showing all Builder Base levels for ${detail.name}`
                : isHero
                  ? maxHeroLevel !== null
                    ? `Showing all hero levels that are reachable at TH ${player.townHallLevel} (Max Lv${maxHeroLevel})`
                    : `Showing all hero levels that are reachable with Hero Hall Lv${heroHallMaxLevel}`
                  : isTroopLike
                    ? `Showing all troop levels that are reachable with Lab Lv${laboratoryMaxLevel}`
                    : `Showing all levels for ${detail.name}`}
            </Text>
          </>
        )}
      </View>
    );
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'heroes', label: 'Heroes' },
    { key: 'pets', label: 'Pets' },
    { key: 'troops', label: 'Troops' },
    { key: 'spells', label: 'Spells' },
    { key: 'equipment', label: 'Gear' },
  ];

  const hasHeroes = homeHeroes.length + builderHeroes.length > 0;
  const hasPets = homePets.length > 0;
  const hasTroops = homeTroops.length + builderTroops.length > 0;
  const hasSpells = player.spells.filter((s) => s.village === 'home' || !s.village).length > 0;
  const hasEquipment = player.heroEquipment.length > 0;

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'heroes') return hasHeroes;
    if (tab.key === 'pets') return hasPets;
    if (tab.key === 'troops') return hasTroops;
    if (tab.key === 'spells') return hasSpells;
    if (tab.key === 'equipment') return hasEquipment;
    return true;
  });

  React.useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
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
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Army</Text>
            <Text style={styles.subtitle}>All your troops, heroes, spells & equipment</Text>
          </View>
          <Pressable
            onPress={onRefresh}
            disabled={refreshing}
            hitSlop={12}
            style={styles.headerRefreshBtn}
            accessibilityLabel="Force refresh all images and details"
            accessibilityRole="button"
          >
            <Ionicons
              name={refreshing ? 'sync-circle' : 'refresh-circle-outline'}
              size={28}
              color={refreshing ? Colors.textTertiary : Colors.textSecondary}
            />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.tabsContainer}
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const iconDef = TAB_ICONS[tab.key];
            const iconColor = isActive ? Colors.bg : Colors.textSecondary;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                {iconDef.set === 'mc' ? (
                  <MaterialCommunityIcons name={iconDef.name as any} size={14} color={iconColor} />
                ) : (
                  <Ionicons name={iconDef.name as any} size={14} color={iconColor} />
                )}
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.tabContent}>
          {activeTab === 'heroes' && (
            <>
              {homeHeroes.length === 0 && builderHeroes.length === 0 ? (
                <EmptyState
                  icon="👑"
                  title="No heroes yet"
                  description="Heroes unlock at higher Town Hall levels. Your first hero, the Barbarian King, is available at TH7."
                />
              ) : (
                <>
                  {homeHeroes.length > 0 && (
                    <>
                      <SectionHeader title="Home Village" />
                      {homeHeroes.map((h) => (
                        <React.Fragment key={h.name}>
                          <ItemCard
                            name={h.name}
                            level={h.level}
                            maxLevel={h.maxLevel}
                            thMaxLevel={getMaxLevelAtTH(h.name, th)}
                            subtitle={h.equipment?.map((e) => e.name).join(', ')}
                            icon={getHeroImageUrl(h.name) || getTroopImageUrl(h.name) || undefined}
                            onPress={() => toggleDetail(h.name)}
                          />
                          {renderDetailPanel(h.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                  {builderHeroes.length > 0 && (
                    <>
                      <SectionHeader title="Builder Base" />
                      {builderHeroes.map((h) => (
                        <React.Fragment key={h.name}>
                          <ItemCard
                            name={h.name}
                            level={h.level}
                            maxLevel={h.maxLevel}
                            icon={getHeroImageUrl(h.name) || getTroopImageUrl(h.name) || undefined}
                            onPress={() => toggleDetail(h.name)}
                          />
                          {renderDetailPanel(h.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'pets' && (
            <>
              {homePets.length === 0 ? (
                <EmptyState
                  icon="🐾"
                  title="No pets yet"
                  description="Pets unlock at TH14 with the Pet House. They follow and fight alongside your heroes in battle."
                />
              ) : (
                <>
                  <SectionHeader title="Home Village Pets" />
                  {homePets.map((p) => (
                    <React.Fragment key={p.name}>
                      <ItemCard
                        name={p.name}
                        level={p.level}
                        maxLevel={p.maxLevel}
                        thMaxLevel={getMaxLevelAtTH(p.name, th)}
                        icon={getTroopImageUrl(p.name) || getPetImageUrl(p.name) || undefined}
                        onPress={() => toggleDetail(p.name)}
                      />
                      {renderDetailPanel(p.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          )}

          {activeTab === 'troops' && (
            <>
              {homeTroops.length === 0 && builderTroops.length === 0 ? (
                <EmptyState
                  icon="⚔️"
                  title="No troops yet"
                  description="Troops unlock as you progress. Your first troop, the Barbarian, is available from TH1."
                />
              ) : (
                <>
                  {homeTroops.length > 0 && (
                    <>
                      <SectionHeader title="Home Village" />
                      {homeTroops.map((t) => (
                        <React.Fragment key={t.name}>
                          <ItemCard
                            name={t.name}
                            level={t.level}
                            maxLevel={t.maxLevel}
                            thMaxLevel={getMaxLevelAtTH(t.name, th)}
                            icon={getTroopImageUrl(t.name) || undefined}
                            onPress={() => toggleDetail(t.name)}
                          />
                          {renderDetailPanel(t.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                  {builderTroops.length > 0 && (
                    <>
                      <SectionHeader title="Builder Base" />
                      {builderTroops.map((t) => (
                        <React.Fragment key={t.name}>
                          <ItemCard
                            name={t.name}
                            level={t.level}
                            maxLevel={t.maxLevel}
                            icon={getTroopImageUrl(t.name) || undefined}
                            onPress={() => toggleDetail(t.name)}
                          />
                          {renderDetailPanel(t.name)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'spells' && (
            <>
              {player.spells.filter((s) => s.village === 'home' || !s.village).length === 0 ? (
                <EmptyState
                  icon="✨"
                  title="No spells yet"
                  description="Spells unlock at TH5. Your first spell, the Lightning Spell, is available at TH5."
                />
              ) : (
                <>
                  <SectionHeader title="Spells" />
                  {player.spells.filter((s) => s.village === 'home' || !s.village).map((s) => (
                    <React.Fragment key={s.name}>
                      <ItemCard
                        name={s.name}
                        level={s.level}
                        maxLevel={s.maxLevel}
                        thMaxLevel={getMaxLevelAtTH(s.name, th)}
                        icon={getTroopImageUrl(s.name) || undefined}
                        onPress={() => toggleDetail(s.name)}
                      />
                      {renderDetailPanel(s.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          )}

          {activeTab === 'equipment' && (
            <>
              {player.heroEquipment.length === 0 ? (
                <EmptyState
                  icon="🛡️"
                  title="No equipment yet"
                  description="Hero equipment unlocks at TH15 with the Blacksmith. Equip your heroes with special abilities."
                />
              ) : (
                <>
                  <SectionHeader title="Hero Equipment" />
                  {player.heroEquipment.map((e) => (
                    <React.Fragment key={e.name}>
                      <ItemCard
                        name={e.name}
                        level={e.level}
                        maxLevel={e.maxLevel}
                        icon={getTroopImageUrl(e.name) || getEquipmentImageUrl(e.name) || undefined}
                        onPress={() => toggleDetail(e.name)}
                      />
                      {renderDetailPanel(e.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          )}


        </View>

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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerRefreshBtn: {
    padding: Spacing.xs,
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
  tabsContainer: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  tabText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.bg,
  },
  tabContent: {
    paddingHorizontal: Spacing.base,
  },

  // ── Inline detail panel (expands below a tapped card) ──
  panel: {
    marginTop: 2,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelEmpty: {
    paddingVertical: Spacing.base,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  panelEmptyText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  panelImage: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
  },
  panelDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
    flex: 1,
  },
  // ── Stat pills (icon + concise tag) ──
  panelPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.base,
  },
  panelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  panelPillText: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 10,
  },
  panelNote: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
    fontStyle: 'italic',
  },
  panelSectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
  expandTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    marginTop: -Spacing.base,
  },
  expandTableText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  panelTable: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    marginBottom: Spacing.base,
    overflow: 'hidden',
  },
  panelTableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  panelTableCell: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textSecondary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    textAlign: 'center',
  },
  panelTableHeader: {
    color: Colors.textMuted,
    fontWeight: '600',
    backgroundColor: Colors.bgSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
