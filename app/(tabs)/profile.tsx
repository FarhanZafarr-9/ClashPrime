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
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { filterHomeTroops } from '../../src/types/clash';
import { getMaxLevelAtTH } from '../../src/utils/thMaxLevels';
import { getTroopImageUrl, getHeroImageUrl, getPetImageUrl, getEquipmentImageUrl } from '../../src/utils/troopImages';
import { getTroopDetail, TroopDetail } from '../../src/api/troopDetail';
import { Card } from '../../src/components/Card';
import { ItemCard } from '../../src/components/ItemCard';
import { ProgressRing } from '../../src/components/ProgressRing';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/components/EmptyState';

type Tab = 'heroes' | 'pets' | 'troops' | 'spells' | 'equipment' | 'achievements';

export default function PlayerProfileScreen() {
  const { player, loading, refresh } = usePlayer();
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
          info: { trainingTime: '', range: '', housingSpace: 0, attackSpeed: '', damageType: '', targetType: '' },
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
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.textPrimary} />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!player) return null;

  const th = player.townHallLevel;
  const homeHeroes = player.heroes.filter((h) => h.village === 'home');
  const builderHeroes = player.heroes.filter((h) => h.village === 'builderBase');
  const homeTroops = filterHomeTroops(player.troops);
  const builderTroops = player.troops.filter((t) => t.village === 'builderBase');
  const homePets = (player.pets ?? []).filter((p) => p.village === 'home');
  const homeAchievements = player.achievements.filter((a) => a.village === 'home');

  const overallProgress = (() => {
    const th = player.townHallLevel;
    const all = [
      ...filterHomeTroops(player.troops),
      ...player.spells.filter((s) => s.village === 'home'),
      ...player.heroes.filter((h) => h.village === 'home'),
      ...player.heroEquipment,
    ];
    const maxed = all.filter((i) => {
      const thMax = getMaxLevelAtTH(i.name, th);
      return thMax !== null ? i.level >= thMax : i.level >= i.maxLevel;
    }).length;
    return all.length > 0 ? maxed / all.length : 0;
  })();

  const TABS: { key: Tab; label: string }[] = [
    { key: 'heroes', label: 'Heroes' },
    { key: 'pets', label: 'Pets' },
    { key: 'troops', label: 'Troops' },
    { key: 'spells', label: 'Spells' },
    { key: 'equipment', label: 'Gear' },
    { key: 'achievements', label: 'Awards' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
                    ...player.spells.filter((s) => s.village === 'home'),
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
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.tab,
                activeTab === tab.key && styles.tabActive,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
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
              {player.spells.filter((s) => s.village === 'home').length === 0 ? (
                <EmptyState
                  icon="✨"
                  title="No spells yet"
                  description="Spells unlock at TH5. Your first spell, the Lightning Spell, is available at TH5."
                />
              ) : (
                <>
                  <SectionHeader title="Spells" />
                  {player.spells.filter((s) => s.village === 'home').map((s) => (
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
        <Pressable style={styles.detailOverlay} onPress={() => { setDetailModal(null); setDetailLoading(false); }}>
          <Pressable style={styles.detailContent} onPress={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator size="large" color={Colors.textPrimary} />
                <Text style={styles.detailLoadingText}>Loading stats…</Text>
              </View>
            ) : detailModal ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  {detailModal.imageUrl ? (
                    <Image source={{ uri: detailModal.imageUrl }} style={styles.detailImage} />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{detailModal.name}</Text>
                    <Text style={styles.detailDesc} numberOfLines={3}>{detailModal.description}</Text>
                  </View>
                </View>

                {detailModal.info.housingSpace > 0 && (
                  <View style={styles.detailInfoRow}>
                    <View style={styles.detailInfoItem}>
                      <Text style={styles.detailInfoLabel}>Housing</Text>
                      <Text style={styles.detailInfoValue}>{detailModal.info.housingSpace}</Text>
                    </View>
                    <View style={styles.detailInfoItem}>
                      <Text style={styles.detailInfoLabel}>Speed</Text>
                      <Text style={styles.detailInfoValue}>{detailModal.info.attackSpeed}</Text>
                    </View>
                    <View style={styles.detailInfoItem}>
                      <Text style={styles.detailInfoLabel}>Range</Text>
                      <Text style={styles.detailInfoValue}>{detailModal.info.range}</Text>
                    </View>
                    <View style={[styles.detailInfoItem, { flex: 1.4 }]}>
                      <Text style={styles.detailInfoLabel}>Target</Text>
                      <Text style={styles.detailInfoValue}>{detailModal.info.targetType}</Text>
                    </View>
                  </View>
                )}

                {detailModal.levels.length > 0 && (
                  <>
                    <Text style={styles.detailSectionTitle}>Level Stats</Text>
                    <View style={styles.detailTable}>
                      <View style={styles.detailTableRow}>
                        <Text style={[styles.detailTableCell, styles.detailTableHeader]}>Lvl</Text>
                        <Text style={[styles.detailTableCell, styles.detailTableHeader]}>DPS</Text>
                        <Text style={[styles.detailTableCell, styles.detailTableHeader]}>HP</Text>
                        <Text style={[styles.detailTableCell, styles.detailTableHeader]}>TH</Text>
                      </View>
                      {detailModal.levels
                        .filter((l) => l.thRequired == null || l.thRequired <= player!.townHallLevel)
                        .map((l) => (
                          <View key={l.level} style={styles.detailTableRow}>
                            <Text style={styles.detailTableCell}>{l.level}</Text>
                            <Text style={styles.detailTableCell}>{l.dps}</Text>
                            <Text style={styles.detailTableCell}>{l.hitpoints}</Text>
                            <Text style={styles.detailTableCell}>{l.thRequired ?? '—'}</Text>
                          </View>
                        ))}
                    </View>
                    <Text style={styles.detailThNote}>Showing levels up to TH{player!.townHallLevel}</Text>
                  </>
                )}

                <Pressable style={styles.detailCloseBtn} onPress={() => { setDetailModal(null); setDetailLoading(false); }}>
                  <Text style={styles.detailCloseText}>Close</Text>
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
    borderRadius: 32,
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  tabText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.bg,
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: Spacing.base,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  achieveLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  achieveName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  achieveInfo: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  achieveRight: {
    alignItems: 'flex-end',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  detailOverlay: {
    flex: 1,
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
  detailInfoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  detailInfoItem: {
    flex: 1,
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
