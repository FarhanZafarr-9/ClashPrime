import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { filterHomeTroops } from '../../src/types/clash';
import { getMaxLevelAtTH } from '../../src/utils/thMaxLevels';
import { getTroopImageUrl, getHeroImageUrl, getPetImageUrl, getEquipmentImageUrl, getHeroSlug } from '../../src/utils/troopImages';
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
  const [detailModal, setDetailModal] = useState<TroopDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = useCallback(async (name: string) => {
    setDetailLoading(true);
    setDetailModal(null);

    let detail = await getTroopDetail(name);
    if (detail && player) {
      const allItems = [
        ...player.heroes,
        ...player.troops,
        ...player.spells,
        ...player.heroEquipment,
        ...(player.pets ?? []),
      ];
      const match = allItems.find((i) => i.name === name);
      if (match) {
        detail.currentLevel = match.level;
        detail.maxLevel = match.maxLevel;
      }
    }
    if (!detail && player) {
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

    setDetailModal(detail);
    setDetailLoading(false);
  }, [player]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

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
  const isHeroDetail = detailModal ? !!getHeroSlug(detailModal.name) : false;
  const maxHeroLevel = detailModal && isHeroDetail ? getMaxLevelAtTH(detailModal.name, player.townHallLevel) : null;

  const visibleDetailLevels = detailModal
    ? detailModal.levels.filter((l) => {
        if (isHeroDetail) {
          if (maxHeroLevel !== null) {
            return l.level <= maxHeroLevel;
          }
          return l.labLevel == null || l.labLevel <= heroHallMaxLevel;
        }
        return l.labLevel == null || l.labLevel <= laboratoryMaxLevel;
      })
    : [];

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
          showsHorizontalScrollIndicator={false}
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
                        <ItemCard
                          key={h.name}
                          name={h.name}
                          level={h.level}
                          maxLevel={h.maxLevel}
                          thMaxLevel={getMaxLevelAtTH(h.name, th)}
                          subtitle={h.equipment?.map((e) => e.name).join(', ')}
                          icon={getHeroImageUrl(h.name) || getTroopImageUrl(h.name) || undefined}
                          onPress={() => openDetail(h.name)}
                        />
                      ))}
                    </>
                  )}
                  {builderHeroes.length > 0 && (
                    <>
                      <SectionHeader title="Builder Base" />
                      {builderHeroes.map((h) => (
                        <ItemCard
                          key={h.name}
                          name={h.name}
                          level={h.level}
                          maxLevel={h.maxLevel}
                        />
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
                    <ItemCard
                      key={p.name}
                      name={p.name}
                      level={p.level}
                      maxLevel={p.maxLevel}
                      thMaxLevel={getMaxLevelAtTH(p.name, th)}
                      icon={getPetImageUrl(p.name) || undefined}
                      onPress={() => openDetail(p.name)}
                    />
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
                        <ItemCard
                          key={t.name}
                          name={t.name}
                          level={t.level}
                          maxLevel={t.maxLevel}
                          thMaxLevel={getMaxLevelAtTH(t.name, th)}
                          icon={getTroopImageUrl(t.name) || undefined}
                          onPress={() => openDetail(t.name)}
                        />
                      ))}
                    </>
                  )}
                  {builderTroops.length > 0 && (
                    <>
                      <SectionHeader title="Builder Base" />
                      {builderTroops.map((t) => (
                        <ItemCard
                          key={t.name}
                          name={t.name}
                          level={t.level}
                          maxLevel={t.maxLevel}
                        />
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
                    <ItemCard
                      key={s.name}
                      name={s.name}
                      level={s.level}
                      maxLevel={s.maxLevel}
                      thMaxLevel={getMaxLevelAtTH(s.name, th)}
                      icon={getTroopImageUrl(s.name) || undefined}
                      onPress={() => openDetail(s.name)}
                    />
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
                    <ItemCard
                      key={e.name}
                      name={e.name}
                      level={e.level}
                      maxLevel={e.maxLevel}
                      icon={getEquipmentImageUrl(e.name) || undefined}
                      onPress={() => openDetail(e.name)}
                    />
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

      <Modal
        visible={detailLoading || detailModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setDetailModal(null); setDetailLoading(false); }}
      >
        <Pressable
          style={[styles.detailOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.4)' }]}
          onPress={() => { setDetailModal(null); setDetailLoading(false); }}
        >
          <Pressable style={[styles.detailContent, { backgroundColor: colors.bgCard, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator size="large" color={colors.textPrimary} />
                <Text style={[styles.detailLoadingText, { color: colors.textTertiary }]}>Loading stats…</Text>
              </View>
            ) : detailModal ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  {detailModal.imageUrl ? (
                    <Image source={{ uri: detailModal.imageUrl }} style={[styles.detailImage, { backgroundColor: colors.bgSubtle }]} />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailName, { color: colors.textPrimary }]}>{detailModal.name}</Text>
                    <Text style={[styles.detailDesc, { color: colors.textTertiary }]} numberOfLines={3}>{detailModal.description}</Text>
                  </View>
                </View>

                {(() => {
                  const infoItems: { label: string; value: string }[] = [];
                  if (detailModal.info.housingSpace > 0) {
                    infoItems.push({ label: 'Housing', value: String(detailModal.info.housingSpace) });
                  }
                  if (detailModal.info.attackSpeed) {
                    infoItems.push({ label: 'Speed', value: detailModal.info.attackSpeed });
                  }
                  if (detailModal.info.targetType) {
                    infoItems.push({ label: 'Target', value: detailModal.info.targetType });
                  }
                  if (detailModal.info.range) {
                    infoItems.push({ label: 'Range', value: detailModal.info.range });
                  }
                  if (detailModal.info.favoriteTarget) {
                    infoItems.push({ label: 'Fav. Target', value: detailModal.info.favoriteTarget });
                  }
                  if (detailModal.info.damageType) {
                    infoItems.push({ label: 'Damage Type', value: detailModal.info.damageType });
                  }

                  if (infoItems.length === 0) return null;

                  const chunkedInfoItems: typeof infoItems[] = [];
                  for (let i = 0; i < infoItems.length; i += 2) {
                    chunkedInfoItems.push(infoItems.slice(i, i + 2));
                  }

                  const getFlex = (item: { label: string; value: string }) => {
                    const textLength = item.label.length + item.value.length;
                    return textLength > 12 ? 2 : 1;
                  };

                  return (
                    <View style={styles.detailStatsGrid}>
                      {chunkedInfoItems.map((chunk, rowIdx) => (
                        <View key={rowIdx} style={styles.detailInfoRow}>
                          {chunk.map((item) => (
                            <View key={item.label} style={[styles.detailInfoItem, { flex: getFlex(item), backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
                              <Text style={[styles.detailInfoLabel, { color: colors.textMuted }]}>{item.label}</Text>
                              <Text style={[styles.detailInfoValue, { color: colors.textPrimary }]}>{item.value}</Text>
                            </View>
                          ))}
                          {chunk.length === 1 && (
                            <View style={{ flex: 1 }} />
                          )}
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {visibleDetailLevels.length > 0 && (
                  <>
                    <Text style={[styles.detailSectionTitle, { color: colors.textPrimary }]}>Level Stats</Text>
                    <View style={[styles.detailTable, { borderColor: colors.border }]}>
                      <View style={[styles.detailTableRow, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.detailTableCell, styles.detailTableHeader, { backgroundColor: colors.bgSubtle, color: colors.textMuted }]}>Lvl</Text>
                        <Text style={[styles.detailTableCell, styles.detailTableHeader, { backgroundColor: colors.bgSubtle, color: colors.textMuted }]}>DPS</Text>
                        <Text style={[styles.detailTableCell, styles.detailTableHeader, { backgroundColor: colors.bgSubtle, color: colors.textMuted }]}>HP</Text>
                        <Text style={[styles.detailTableCell, styles.detailTableHeader, { backgroundColor: colors.bgSubtle, color: colors.textMuted }]}>{isHeroDetail ? 'Hall' : 'Lab'}</Text>
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
                      {isHeroDetail
                        ? maxHeroLevel !== null
                          ? `Showing all hero levels that are reachable at TH ${player.townHallLevel} (Max Lv${maxHeroLevel})`
                          : `Showing all hero levels that are reachable with Hero Hall Lv${heroHallMaxLevel}`
                        : `Showing all troop levels that are reachable with Lab Lv${laboratoryMaxLevel}`}
                    </Text>
                  </>
                )}

                <Pressable style={[styles.detailCloseBtn, { backgroundColor: colors.textPrimary }]} onPress={() => { setDetailModal(null); setDetailLoading(false); }}>
                  <Text style={[styles.detailCloseText, { color: colors.bgElevated }]}>Close</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
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
  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  detailContent: {
    width: '88%',
    maxHeight: '80%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  detailLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: Spacing.md,
  },
  detailLoadingText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  detailHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  detailImage: {
    width: 64,
    height: 64,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
  },
  detailName: {
    ...Typography.title2,
    color: Colors.textPrimary,
  },
  detailDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 4,
    lineHeight: 16,
  },
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
  detailInfoItemSmall: {
    flex: 1,
  },
  detailInfoItemLarge: {
    flex: 2,
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
  detailLevelSummary: {
    marginBottom: Spacing.base,
  },
  detailLevelInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  detailLevelText: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  detailLevelPct: {
    ...Typography.headline,
    color: Colors.textSecondary,
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
    overflow: 'hidden',
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
  detailCloseBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
  },
  detailCloseText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
});
