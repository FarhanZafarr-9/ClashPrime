import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { filterHomeTroops } from '../../src/types/clash';
import { getMaxLevelAtTH } from '../../src/utils/thMaxLevels';
import { getTroopImageUrl, getHeroImageUrl, getPetImageUrl, getEquipmentImageUrl, getHeroSlug, setTroopImageOverride } from '../../src/utils/troopImages';
import { getTroopDetail, TroopDetail } from '../../src/api/troopDetail';
import { Card } from '../../src/components/Card';
import { ItemCard } from '../../src/components/ItemCard';
import { ProgressRing } from '../../src/components/ProgressRing';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { ProfileScreenSkeleton } from '../../src/components/SkeletonScreens';

type Tab = 'heroes' | 'pets' | 'troops' | 'spells' | 'equipment' | 'achievements';

export default function PlayerProfileScreen() {
  const { player, loading, refresh } = usePlayer();
  const { isDark, colors } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('heroes');
  const [refreshing, setRefreshing] = useState(false);
  // Name of the item whose detail panel is currently expanded inline.
  const [expandedName, setExpandedName] = useState<string | null>(null);
  // Detail cache keyed by name so re-expansion is instant; null = not yet fetched.
  const [details, setDetails] = useState<Record<string, TroopDetail | null>>({});

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
        if (detail.imageUrl) setTroopImageOverride(name, detail.imageUrl);
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
          if (detail.imageUrl) setTroopImageOverride(detail.name, detail.imageUrl);
          nextDetails[detail.name] = detail;
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
  const homeAchievements = player.achievements.filter((a) => a.village === 'home');

  const overallProgress = (() => {
    const th = player.townHallLevel;
    const all = [
      ...filterHomeTroops(player.troops),
      ...player.spells.filter((s) => s.village === 'home' || !s.village),
      ...player.heroes.filter((h) => h.village === 'home'),
      ...player.heroEquipment,
    ];
    const maxed = all.filter((i) => {
      const thMax = getMaxLevelAtTH(i.name, th);
      return thMax !== null ? i.level >= thMax : i.level >= i.maxLevel;
    }).length;
    return all.length > 0 ? maxed / all.length : 0;
  })();

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
      // Still fetching.
      return (
        <View style={styles.panelLoading}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={[styles.panelLoadingText, { color: colors.textTertiary }]}>Loading stats…</Text>
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

    const infoItems: { label: string; value: string }[] = [];
    if (detail.info.housingSpace > 0) infoItems.push({ label: 'Housing', value: String(detail.info.housingSpace) });
    if (detail.info.attackSpeed) infoItems.push({ label: 'Speed', value: detail.info.attackSpeed });
    if (detail.info.targetType) infoItems.push({ label: 'Target', value: detail.info.targetType });
    if (detail.info.range) infoItems.push({ label: 'Range', value: detail.info.range });
    if (detail.info.favoriteTarget) infoItems.push({ label: 'Fav. Target', value: detail.info.favoriteTarget });
    if (detail.info.damageType) infoItems.push({ label: 'Damage Type', value: detail.info.damageType });

    const chunkedInfoItems: typeof infoItems[] = [];
    for (let i = 0; i < infoItems.length; i += 2) {
      chunkedInfoItems.push(infoItems.slice(i, i + 2));
    }
    const getFlex = (item: { label: string; value: string }) =>
      (item.label.length + item.value.length) > 12 ? 2 : 1;

    return (
      <View style={[styles.panel, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
        {(detail.imageUrl || detail.description) && (
          <View style={styles.panelHeader}>
            {detail.imageUrl ? (
              <Image source={{ uri: detail.imageUrl }} style={[styles.panelImage, { backgroundColor: colors.bgCard }]} />
            ) : null}
            {detail.description ? (
              <Text style={[styles.panelDesc, { color: colors.textTertiary }]}>{detail.description}</Text>
            ) : null}
          </View>
        )}

        {infoItems.length > 0 && (
          <View style={styles.detailStatsGrid}>
            {chunkedInfoItems.map((chunk, rowIdx) => (
              <View key={rowIdx} style={styles.detailInfoRow}>
                {chunk.map((item) => (
                  <View key={item.label} style={[styles.detailInfoItem, { flex: getFlex(item), backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <Text style={[styles.detailInfoLabel, { color: colors.textMuted }]}>{item.label}</Text>
                    <Text style={[styles.detailInfoValue, { color: colors.textPrimary }]}>{item.value}</Text>
                  </View>
                ))}
                {chunk.length === 1 && <View style={{ flex: 1 }} />}
              </View>
            ))}
          </View>
        )}

        {visibleDetailLevels.length > 0 && (
          <>
            <Text style={[styles.detailSectionTitle, { color: colors.textPrimary }]}>Level Stats</Text>
            <View style={[styles.detailTable, { borderColor: colors.border }]}>
              <View style={[styles.detailTableRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailTableCell, styles.detailTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>Lvl</Text>
                <Text style={[styles.detailTableCell, styles.detailTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>DPS</Text>
                <Text style={[styles.detailTableCell, styles.detailTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>HP</Text>
                <Text style={[styles.detailTableCell, styles.detailTableHeader, { backgroundColor: colors.bgCard, color: colors.textMuted }]}>{isHero ? 'Hall' : 'Lab'}</Text>
              </View>
              {visibleDetailLevels.map((l) => (
                <View key={l.level} style={[styles.detailTableRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.detailTableCell, { color: colors.textSecondary }]}>{l.level}</Text>
                  <Text style={[styles.detailTableCell, { color: colors.textSecondary }]}>{l.dps}</Text>
                  <Text style={[styles.detailTableCell, { color: colors.textSecondary }]}>{l.hitpoints}</Text>
                  <Text style={[styles.detailTableCell, { color: colors.textSecondary }]}>{l.labLevel ?? '—'}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.detailThNote, { color: colors.textMuted }]}>
              {isBB
                ? `Showing all Builder Base levels for ${detail.name}`
                : isHero
                  ? maxHeroLevel !== null
                    ? `Showing all hero levels that are reachable at TH ${player.townHallLevel} (Max Lv${maxHeroLevel})`
                    : `Showing all hero levels that are reachable with Hero Hall Lv${heroHallMaxLevel}`
                  : `Showing all troop levels that are reachable with Lab Lv${laboratoryMaxLevel}`}
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
    { key: 'achievements', label: 'Awards' },
  ];

  const hasHeroes = homeHeroes.length + builderHeroes.length > 0;
  const hasPets = homePets.length > 0;
  const hasTroops = homeTroops.length + builderTroops.length > 0;
  const hasSpells = player.spells.filter((s) => s.village === 'home' || !s.village).length > 0;
  const hasEquipment = player.heroEquipment.length > 0;
  const hasAchievements = homeAchievements.length > 0;

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'heroes') return hasHeroes;
    if (tab.key === 'pets') return hasPets;
    if (tab.key === 'troops') return hasTroops;
    if (tab.key === 'spells') return hasSpells;
    if (tab.key === 'equipment') return hasEquipment;
    if (tab.key === 'achievements') return hasAchievements;
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
          <Text style={styles.title}>Profile</Text>
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

        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{player.name.charAt(0)}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{player.name}</Text>
              <Text style={styles.profileTag}>{player.tag}</Text>
              <View style={styles.profileBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>TH{player.townHallLevel}</Text>
                </View>
                {player.leagueTier && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {player.leagueTier.name.split(' ').slice(0, 2).join(' ')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.progressSection}>
            <ProgressRing
              size={72}
              strokeWidth={6}
              progress={overallProgress}
              label={`${Math.round(overallProgress * 100)}%`}
              sublabel="overall"
              color={Colors.textPrimary}
            />
            <View style={styles.progressStats}>
              <Text style={styles.progressLabel}>Total Progress</Text>
              <Text style={styles.progressDetail}>
                {(() => {
                  const th = player.townHallLevel;
                  const all = [
                    ...filterHomeTroops(player.troops),
                    ...player.spells.filter((s) => s.village === 'home' || !s.village),
                    ...player.heroes.filter((h) => h.village === 'home'),
                    ...player.heroEquipment,
                  ];
                  const maxed = all.filter((i) => {
                    const thMax = getMaxLevelAtTH(i.name, th);
                    return thMax !== null ? i.level >= thMax : i.level >= i.maxLevel;
                  }).length;
                  return `${maxed} / ${all.length} items maxed`;
                })()}
              </Text>
            </View>
          </View>

          {player.clan && (
            <View style={styles.clanRow}>
              <View style={styles.clanInfo}>
                <Text style={styles.clanLabel}>Clan</Text>
                <Text style={styles.clanName}>{player.clan.name}</Text>
              </View>
              <View style={styles.clanInfo}>
                <Text style={styles.clanLabel}>Role</Text>
                <Text style={styles.clanName}>{player.role || 'Member'}</Text>
              </View>
              <View style={styles.clanInfo}>
                <Text style={styles.clanLabel}>War Stars</Text>
                <Text style={styles.clanName}>{player.warStars.toLocaleString()}</Text>
              </View>
            </View>
          )}
        </Card>

        <ScrollView
          horizontal
          scrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.tabsContainer}
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: isActive 
                      ? (isDark ? colors.accent : colors.accentSubtle)
                      : colors.bgCard,
                    borderColor: isActive
                      ? (isDark ? colors.accent : colors.accentSubtle)
                      : colors.border,
                  }
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: isActive
                        ? (isDark ? colors.bg : colors.textPrimary)
                        : colors.textSecondary,
                      fontWeight: isActive ? '700' : '600',
                    }
                  ]}
                >
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
                        icon={getPetImageUrl(p.name) || undefined}
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
                        icon={getEquipmentImageUrl(e.name) || undefined}
                        onPress={() => toggleDetail(e.name)}
                      />
                      {renderDetailPanel(e.name)}
                    </React.Fragment>
                  ))}
                </>
              )}
            </>
          )}

          {activeTab === 'achievements' && (
            <>
              {homeAchievements.length === 0 ? (
                <EmptyState
                  icon="🏆"
                  title="No achievements"
                  description="Achievements are earned by completing in-game milestones. They will appear here once synced."
                />
              ) : (
                <>
                  <SectionHeader title={`Achievements (${homeAchievements.length})`} />
                  {homeAchievements.map((a, idx) => (
                    <View key={`${a.name}-${a.village}-${idx}`} style={styles.achievementCard}>
                      <View style={styles.achievementIcon}>
                        <Ionicons name="trophy-outline" size={16} color={Colors.textSecondary} />
                      </View>
                      <View style={styles.achieveLeft}>
                        <Text style={styles.achieveName}>{a.name}</Text>
                        <Text style={styles.achieveInfo} numberOfLines={1}>
                          {a.completionInfo || a.info}
                        </Text>
                      </View>
                      <View style={styles.achieveRight}>
                        <View style={styles.starsRow}>
                          {[1, 2, 3].map((s) => (
                            <Ionicons
                              key={s}
                              name={s <= a.stars ? 'star' : 'star-outline'}
                              size={12}
                              color={s <= a.stars ? Colors.textPrimary : Colors.textMuted}
                            />
                          ))}
                        </View>
                        <Text style={styles.achieveBadge}>{a.stars}/3</Text>
                      </View>
                    </View>
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
  headerRefreshBtn: {
    padding: Spacing.xs,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  profileCard: {
    marginHorizontal: Spacing.base,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.title1,
    color: Colors.textTertiary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...Typography.title3,
    color: Colors.textPrimary,
  },
  profileTag: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  profileBadges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    backgroundColor: Colors.accentSubtle,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.base,
  },
  progressStats: {
    flex: 1,
  },
  progressLabel: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  progressDetail: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  clanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clanInfo: {
    alignItems: 'center',
    flex: 1,
  },
  clanLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clanName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  tabsContainer: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
    paddingVertical: Spacing.base,
  },
  tab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  tabText: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.bgElevated,
    fontWeight: '700',
  },
  tabContent: {
    paddingHorizontal: Spacing.base,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  achievementIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  achieveLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  achieveName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  achieveInfo: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  achieveRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  achieveBadge: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
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
  panelLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  panelLoadingText: {
    ...Typography.caption,
    color: Colors.textTertiary,
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
  // ── Reusable: info grid + stats table used inside the panel ──
  detailStatsGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  detailInfoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  detailInfoItem: {
    alignItems: 'center',
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  detailInfoLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailInfoValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  detailThNote: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
    fontStyle: 'italic',
  },
  detailSectionTitle: {
    ...Typography.headline,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    fontSize: 14,
  },
  detailTable: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    marginBottom: Spacing.base,
  },
  detailTableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  detailTableCell: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textSecondary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    textAlign: 'center',
  },
  detailTableHeader: {
    color: Colors.textMuted,
    fontWeight: '600',
    backgroundColor: Colors.bgSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
