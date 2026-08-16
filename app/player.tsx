import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Image,
  Keyboard,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import PressableRipple from '../src/components/PressableRipple';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../src/theme';
import { Card } from '../src/components/Card';
import { ItemCard } from '../src/components/ItemCard';
import { SettingRow } from '../src/components/SettingRow';
import { AchievementCard } from '../src/components/AchievementCard';
import { groupAchievementsByStars, getTotalStars, type StarGroup } from '../src/utils/achievements';
import { getApiToken, getAccounts, ensureAccountRegistered, cachePlayer, getActiveAccountTag, setPlayerTag, setActiveAccountTag } from '../src/hooks/usePlayer';
import { usePlayer } from '../src/hooks/usePlayerContext';
import { ClashAPI, ClashAPIError } from '../src/api/clash';
import type { ClashPlayer, Hero, Pet, HeroEquipment, Achievement } from '../src/types/clash';
import { isSuperTroop } from '../src/types/clash';
import { getTownHallImageUrl } from '../src/utils/thImages';
import { getBuildingLevelImageSource, formatCompact } from '../src/utils/buildingImages';
import { getTroopImageUrl, getHeroImageUrl, getPetImageUrl, getEquipmentImageUrl } from '../src/utils/troopImages';
import { entityRef } from '../src/data/entityReference';

const ROLE_LABELS: Record<string, string> = {
  leader: 'Leader',
  coLeader: 'Co-Leader',
  admin: 'Elder',
  member: 'Member',
};

function normalizeTag(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/[^#A-Z0-9]/g, '');
  if (!t) return '';
  return t.startsWith('#') ? t : `#${t}`;
}

const fmt = (n: number | undefined | null) => (n == null ? '—' : n.toLocaleString());

type StatRow = { label: string; desc?: string; value: number | string; icon: keyof typeof Ionicons.glyphMap; accentColor?: string };
type StatGroup = { title: string; icon: keyof typeof Ionicons.glyphMap; desc: string; rows: StatRow[] };

const ACHIEVEMENT_GROUP_META: Record<StarGroup, { icon: keyof typeof Ionicons.glyphMap; desc: string }> = {
  none: { icon: 'time-outline', desc: 'No stars yet' },
  one: { icon: 'star-outline', desc: '1 of 3 stars' },
  two: { icon: 'star-half-outline', desc: '2 of 3 stars' },
  three: { icon: 'trophy-outline', desc: 'All 3 stars' },
};

function CollapsibleSection({
  title,
  icon,
  description,
  count,
  totalLevel,
  totalMax,
  badge,
  isFirst,
  isLast,
  compact,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  count: number;
  totalLevel: number;
  totalMax: number;
  badge?: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  const isSectionMaxed = totalMax > 0 && totalLevel >= totalMax;
  return (
    <>
      <SettingRow
        icon={icon}
        title={title}
        desc={description}
        isFirst={isFirst || open}
        isLast={isLast}
        compact={compact}
        onPress={() => setOpen((o) => !o)}
      >
        {badge != null ? badge : (
          <View style={styles.sectionBadges}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{count}</Text>
            </View>
            <View style={[styles.sectionBadge, isSectionMaxed && styles.sectionBadgeMaxed, isFirst && styles.sectionBadgeFirst, isLast && styles.sectionBadgeLast]}>
              <Text style={[styles.sectionBadgeText, isSectionMaxed && styles.sectionBadgeTextMaxed]}>{formatCompact(totalLevel)}</Text>
              <Text style={[styles.sectionBadgeLabel, isSectionMaxed && styles.sectionBadgeTextMaxed]}>/ {formatCompact(totalMax)}</Text>
            </View>
          </View>
        )}
      </SettingRow>
      {open && (
        <View style={styles.sectionBody}>
          {children}
          {!isLast && <View style={styles.sectionSeparator} />}
        </View>
      )}
    </>
  );
}

export default function PlayerInspectScreen() {  const router = useRouter();
  const { refreshAccounts } = usePlayer();
  const params = useLocalSearchParams<{ tag?: string }>();
  const [query, setQuery] = useState(params.tag ?? '');
  const [player, setPlayer] = useState<ClashPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const load = useCallback(async (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag) return;
    setQuery(tag);
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      const token = await getApiToken();
      if (!token) {
        setError('No API token configured. Add an account in Settings first.');
        return;
      }
      const api = new ClashAPI(token);
      const data = await api.getPlayer(tag);
      setPlayer(data);
      const accounts = await getAccounts();
      setSaved(accounts.some((a) => a.tag === data.tag));
    } catch (e: any) {
      setPlayer(null);
      setError(e instanceof ClashAPIError ? e.message : (e?.message || 'Failed to load player.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (params.tag) load(params.tag);
  }, [params.tag, load]);

  const addToAccounts = useCallback(async () => {
    if (!player) return;
    setAdding(true);
    try {
      await ensureAccountRegistered({ tag: player.tag, name: player.name, townHallLevel: player.townHallLevel ?? 0 });
      await cachePlayer(player, player.tag);
      const activeTag = await getActiveAccountTag();
      if (!activeTag) {
        await setPlayerTag(player.tag);
        await setActiveAccountTag(player.tag);
      }
      await refreshAccounts();
      setSaved(true);
    } catch {
      setError('Could not save this account.');
    } finally {
      setAdding(false);
    }
  }, [player, refreshAccounts]);

  const copyTag = useCallback(() => {
    if (player) Clipboard.setStringAsync(player.tag);
  }, [player]);

  const openInGame = useCallback(() => {
    if (player) Linking.openURL(`https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=${encodeURIComponent(player.tag)}`);
  }, [player]);

  const heroRows = (player?.heroes ?? []).filter((h: Hero) => h.village === 'home');
  const homeTroops = (player?.troops ?? []).filter((t) => t.village === 'home');
  const homeTroopsPets = homeTroops.filter((t) => entityRef(t.name)?.category === 'pets');
  const superTroopRows = homeTroops.filter((t) => isSuperTroop(t.name));
  const darkTroopRows = homeTroops.filter((t) => !isSuperTroop(t.name) && entityRef(t.name)?.category === 'darkTroops');
  const troopRows = homeTroops.filter((t) => {
    if (isSuperTroop(t.name)) return false;
    const cat = entityRef(t.name)?.category;
    return cat !== 'siege' && cat !== 'pets' && cat !== 'darkTroops';
  });
  const siegeRows = homeTroops.filter((t) => entityRef(t.name)?.category === 'siege');
  const petRows: Pet[] =
    homeTroopsPets.length > 0
      ? homeTroopsPets
      : (player?.pets ?? []).filter((p) => p.village === 'home');
  const spellRows = (player?.spells ?? []).filter((s) => s.village === 'home');
  const equipRows = (player?.heroEquipment ?? []).filter((e: HeroEquipment) => e.village === 'home');

  const lastArmySectionKey = [
    { key: 'heroes', rows: heroRows },
    { key: 'troops', rows: troopRows },
    { key: 'dark', rows: darkTroopRows },
    { key: 'super', rows: superTroopRows },
    { key: 'siege', rows: siegeRows },
    { key: 'spells', rows: spellRows },
    { key: 'pets', rows: petRows },
    { key: 'equip', rows: equipRows },
  ].filter((g) => g.rows.length > 0).pop()?.key;

  const sumLevel = (rows: { level: number }[]) => rows.reduce((a, r) => a + r.level, 0);
  const sumMax = (rows: { maxLevel: number }[]) => rows.reduce((a, r) => a + r.maxLevel, 0);

  const achievements = player?.achievements ?? [];
  const achievementGroups = useMemo(() => groupAchievementsByStars(achievements), [achievements]);
  const starTotals = useMemo(() => getTotalStars(achievements), [achievements]);
  const allAchievementsComplete = starTotals.max > 0 && starTotals.earned >= starTotals.max;

  const statGroups: StatGroup[] =
    player == null
      ? []
      : [
    {
      title: 'PvP',
      icon: 'trophy-outline',
      desc: 'Attack & defense record',
      rows: [
        { label: 'Trophies', desc: 'Current trophy count', value: player.trophies, icon: 'trophy-outline' },
        { label: 'Best Trophies', desc: 'All-time best', value: player.bestTrophies, icon: 'trophy', accentColor: Colors.warning },
        { label: 'War Stars', desc: 'Clan war stars', value: player.warStars, icon: 'star-outline' },
        { label: 'Attack Wins', desc: 'Attacks won', value: player.attackWins, icon: 'flame-outline' },
        { label: 'Defense Wins', desc: 'Defenses won', value: player.defenseWins, icon: 'shield-outline' },
      ],
    },
    {
      title: 'Clan',
      icon: 'people-outline',
      desc: 'Clan participation',
      rows: [
        { label: 'Donations', desc: 'Troops donated', value: player.donations, icon: 'heart-outline' },
        { label: 'Received', desc: 'Troops received', value: player.donationsReceived, icon: 'arrow-down-outline' },
        { label: 'Capital Gold', desc: 'Capital gold donated', value: player.clanCapitalContributions, icon: 'flag-outline' },
      ],
    },
    {
      title: 'Builder Base',
      icon: 'hammer-outline',
      desc: 'Builder village record',
      rows: [
        ...(player.builderHallLevel != null ? [{ label: 'Builder Hall', desc: 'Current hall level', value: player.builderHallLevel, icon: 'hammer-outline' as const }] : []),
        ...(player.builderBaseTrophies != null ? [{ label: 'Builder Trophies', desc: 'Current trophy count', value: player.builderBaseTrophies, icon: 'hammer' as const }] : []),
        ...(player.bestBuilderBaseTrophies != null ? [{ label: 'Best Builder', desc: 'All-time best', value: player.bestBuilderBaseTrophies, icon: 'trophy' as const, accentColor: Colors.warning }] : []),
      ],
    },
    ...(player.legendStatistics
      ? [{
          title: 'Legend League',
          icon: 'shield-outline' as const,
          desc: 'Legend season history',
          rows: [
            { label: 'Legend Trophies', desc: 'Current score', value: player.legendStatistics.legendTrophies, icon: 'star-outline' as const },
            ...(player.legendStatistics.currentSeason ? [{ label: 'This Season', desc: 'Season trophies', value: player.legendStatistics.currentSeason.trophies, icon: 'calendar-outline' as const }] : []),
            ...(player.legendStatistics.bestSeason ? [{ label: 'Best Season', desc: 'Best season result', value: `#${player.legendStatistics.bestSeason.rank} · ${player.legendStatistics.bestSeason.trophies}`, icon: 'trophy' as const, accentColor: Colors.warning }] : []),
            ...(player.legendStatistics.previousSeason ? [{ label: 'Last Season', desc: 'Last season result', value: `#${player.legendStatistics.previousSeason.rank} · ${player.legendStatistics.previousSeason.trophies}`, icon: 'time-outline' as const }] : []),
          ],
        }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <PressableRipple style={styles.backBtn} onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </PressableRipple>
        <View style={styles.headerText}>
          <Text style={styles.title}>Player Inspect</Text>
          <Text style={styles.subtitle}>Search any player by tag</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textTertiary} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Player tag, e.g. #ABC123"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => load(query)}
          />
          <PressableRipple style={styles.searchBtn} onPress={() => load(query)} disabled={!query.trim() || loading}>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.bg} />
            ) : (
              <Text style={styles.searchBtnText}>Search</Text>
            )}
          </PressableRipple>
        </View>
      </View>

      {loading && !player ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.textPrimary} />
        </View>
      ) : error ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Card>
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <PressableRipple style={styles.retryBtn} onPress={() => load(query)}>
              <Text style={styles.retryText}>Retry</Text>
            </PressableRipple>
          </Card>
        </ScrollView>
      ) : player ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── Identity card ── */}
          <Card>
            <View style={styles.playerRow}>
              <View style={styles.avatar}>
                {getTownHallImageUrl(player.townHallLevel) ? (
                  <Image source={{ uri: getTownHallImageUrl(player.townHallLevel)! }} style={styles.avatarImage} resizeMode="contain" />
                ) : (() => {
                  const bhSrc = getBuildingLevelImageSource('Builder Hall', player.builderHallLevel ?? 1);
                  return bhSrc ? (
                    <Image source={bhSrc} style={styles.avatarImage} resizeMode="contain" />
                  ) : (
                    <Text style={styles.avatarText}>{player.name.charAt(0)}</Text>
                  );
                })()}
              </View>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
                <Text style={styles.playerTag}>{player.tag}</Text>
                <View style={styles.chipRow}>
                  {player.role && (
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{ROLE_LABELS[player.role] ?? player.role}</Text>
                    </View>
                  )}
                  {player.warPreference && (
                    <View style={[styles.chip, player.warPreference === 'out' && styles.chipOut]}>
                      <Text style={styles.chipText}>War: {player.warPreference === 'in' ? 'In' : 'Out'}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.thBadge}>
                <Text style={styles.thLevel}>{player.townHallLevel ?? '?'}</Text>
                <Text style={styles.thLabel}>TH</Text>
              </View>
            </View>

            {player.clan && (
              <View style={styles.clanRow}>
                {player.clan.badgeUrls?.small ? (
                  <Image source={{ uri: player.clan.badgeUrls.small }} style={styles.clanBadge} resizeMode="contain" />
                ) : (
                  <Ionicons name="shield-outline" size={16} color={Colors.textTertiary} />
                )}
                <Text style={styles.clanName} numberOfLines={1}>{player.clan.name}</Text>
                <Text style={styles.clanLevel}>Lv {player.clan.clanLevel}</Text>
              </View>
            )}

            {(player.league ?? player.leagueTier) && (
              <View style={styles.leagueRow}>
                {(player.league?.iconUrls?.small ?? player.leagueTier?.iconUrls?.small) ? (
                  <Image source={{ uri: player.league?.iconUrls?.small ?? player.leagueTier?.iconUrls?.small }} style={styles.leagueIcon} resizeMode="contain" />
                ) : (
                  <Ionicons name="trophy-outline" size={14} color={Colors.warning} />
                )}
                <Text style={styles.leagueName} numberOfLines={1}>{(player.league?.name ?? player.leagueTier?.name) || ''}</Text>
                <Text style={styles.leagueTrophies}>{fmt(player.trophies)}</Text>
              </View>
            )}

            <View style={styles.actionRow}>
              <PressableRipple style={[styles.actionBtn, saved && styles.actionBtnSaved]} disabled={saved || adding} onPress={addToAccounts}>
                {adding ? (
                  <ActivityIndicator size="small" color={saved ? Colors.textPrimary : Colors.bg} />
                ) : (
                  <>
                    <Ionicons name={saved ? 'checkmark' : 'person-add-outline'} size={14} color={saved ? Colors.textPrimary : Colors.bg} />
                    <Text style={[styles.actionBtnText, saved && styles.actionBtnTextSaved]}>{saved ? 'Added' : 'Add account'}</Text>
                  </>
                )}
              </PressableRipple>
              <PressableRipple style={[styles.actionBtn, styles.actionBtnGhost]} onPress={copyTag}>
                <Ionicons name="copy-outline" size={14} color={Colors.textPrimary} />
                <Text style={[styles.actionBtnText, styles.actionBtnTextGhost]}>Copy tag</Text>
              </PressableRipple>
            </View>

            <PressableRipple style={styles.openGameBtn} onPress={openInGame}>
              <Ionicons name="game-controller-outline" size={14} color={Colors.textPrimary} />
              <Text style={styles.openGameBtnText}>Open in game</Text>
            </PressableRipple>
          </Card>

          {/* ── Stats ── */}
          <View style={styles.armyCard}>
            {statGroups.filter((g) => g.rows.length > 0).map((group, gi, groups) => (
              <CollapsibleSection
                key={group.title}
                isFirst={gi === 0}
                isLast={gi === groups.length - 1}
                icon={group.icon}
                title={group.title}
                description={group.desc}
                count={group.rows.length}
                totalLevel={0}
                totalMax={0}
                compact
                badge={(
                  <View style={[styles.sectionBadge, gi === 0 && styles.sectionBadgeFirst, gi === groups.length - 1 && styles.sectionBadgeLast]}>
                    <Text style={styles.sectionBadgeText}>{group.rows.length}</Text>
                  </View>
                )}
              >
                {group.rows.map((row, ri) => (
                  <View key={`${group.title}-${ri}`} style={[styles.statCard, ri === group.rows.length - 1 && styles.statCardLast]}>
                    <View style={styles.statCardIcon}>
                      <Ionicons name={row.icon} size={16} color={Colors.textPrimary} />
                    </View>
                    <View style={styles.statCardText}>
                      <Text style={styles.statCardLabel}>{row.label}</Text>
                      {row.desc ? <Text style={styles.statCardSub}>{row.desc}</Text> : null}
                    </View>
                    <Text style={[styles.statCardValue, row.accentColor ? { color: row.accentColor } : null]}>
                      {typeof row.value === 'number' ? row.value.toLocaleString() : row.value}
                    </Text>
                  </View>
                ))}
              </CollapsibleSection>
            ))}
          </View>

          <View style={styles.sectionDivider} />

          {/* ── Army ── */}
          {heroRows.length + troopRows.length + superTroopRows.length + darkTroopRows.length + siegeRows.length + spellRows.length + petRows.length + equipRows.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>No army data returned for this player.</Text>
            </Card>
          ) : (
            <View style={styles.armyCard}>
              <CollapsibleSection isFirst isLast={lastArmySectionKey === 'heroes'} compact title="Heroes" icon="shield-half-outline" description="Hero levels" count={heroRows.length} totalLevel={sumLevel(heroRows)} totalMax={sumMax(heroRows)}>
            {heroRows.map((h, i) => (
              <ItemCard
                key={`${h.name}-${i}`}
                name={h.name}
                level={h.level}
                maxLevel={h.maxLevel}
                icon={getHeroImageUrl(h.name) || undefined}
                isLast={i === heroRows.length - 1}
              />
            ))}
          </CollapsibleSection>
          <CollapsibleSection compact title="Troops" icon="bonfire-outline" description="Troop levels" count={troopRows.length} totalLevel={sumLevel(troopRows)} totalMax={sumMax(troopRows)} isLast={lastArmySectionKey === 'troops'}>
            {troopRows.map((t, i) => (
              <ItemCard
                key={`${t.name}-${i}`}
                name={t.name}
                level={t.level}
                maxLevel={t.maxLevel}
                icon={getTroopImageUrl(t.name, t.level) || undefined}
                isLast={i === troopRows.length - 1}
              />
            ))}
          </CollapsibleSection>
          <CollapsibleSection compact title="Dark Elixir" icon="water-outline" description="Dark troop levels" count={darkTroopRows.length} totalLevel={sumLevel(darkTroopRows)} totalMax={sumMax(darkTroopRows)} isLast={lastArmySectionKey === 'dark'}>
            {darkTroopRows.map((t, i) => (
              <ItemCard
                key={`${t.name}-${i}`}
                name={t.name}
                level={t.level}
                maxLevel={t.maxLevel}
                icon={getTroopImageUrl(t.name, t.level) || undefined}
                isLast={i === darkTroopRows.length - 1}
              />
            ))}
          </CollapsibleSection>
          <CollapsibleSection compact title="Super Troops" icon="rocket-outline" description="Super troop levels" count={superTroopRows.length} totalLevel={sumLevel(superTroopRows)} totalMax={sumMax(superTroopRows)} isLast={lastArmySectionKey === 'super'}>
            {superTroopRows.map((t, i) => (
              <ItemCard
                key={`${t.name}-${i}`}
                name={t.name}
                level={t.level}
                maxLevel={t.maxLevel}
                icon={getTroopImageUrl(t.name, t.level) || undefined}
                isLast={i === superTroopRows.length - 1}
              />
            ))}
          </CollapsibleSection>
          <CollapsibleSection compact title="Siege Machines" icon="build-outline" description="Siege levels" count={siegeRows.length} totalLevel={sumLevel(siegeRows)} totalMax={sumMax(siegeRows)} isLast={lastArmySectionKey === 'siege'}>
            {siegeRows.map((s, i) => (
              <ItemCard
                key={`${s.name}-${i}`}
                name={s.name}
                level={s.level}
                maxLevel={s.maxLevel}
                icon={getTroopImageUrl(s.name, s.level) || undefined}
                isLast={i === siegeRows.length - 1}
              />
            ))}
          </CollapsibleSection>
          <CollapsibleSection compact title="Spells" icon="flash-outline" description="Spell levels" count={spellRows.length} totalLevel={sumLevel(spellRows)} totalMax={sumMax(spellRows)} isLast={lastArmySectionKey === 'spells'}>
            {spellRows.map((s, i) => (
              <ItemCard
                key={`${s.name}-${i}`}
                name={s.name}
                level={s.level}
                maxLevel={s.maxLevel}
                icon={getTroopImageUrl(s.name, s.level) || undefined}
                isLast={i === spellRows.length - 1}
              />
            ))}
          </CollapsibleSection>
          <CollapsibleSection compact title="Pets" icon="paw-outline" description="Pet levels" count={petRows.length} totalLevel={sumLevel(petRows)} totalMax={sumMax(petRows)} isLast={lastArmySectionKey === 'pets'}>
            {petRows.map((p, i) => (
              <ItemCard
                key={`${p.name}-${i}`}
                name={p.name}
                level={p.level}
                maxLevel={p.maxLevel}
                icon={getPetImageUrl(p.name) || undefined}
                isLast={i === petRows.length - 1}
              />
            ))}
          </CollapsibleSection>
          <CollapsibleSection compact title="Equipment" icon="hammer-outline" description="Equipment levels" count={equipRows.length} totalLevel={sumLevel(equipRows)} totalMax={sumMax(equipRows)} isLast={lastArmySectionKey === 'equip'}>
            {equipRows.map((e, i) => (
              <ItemCard
                key={`${e.name}-${i}`}
                name={e.name}
                level={e.level}
                maxLevel={e.maxLevel}
                icon={getEquipmentImageUrl(e.name) || undefined}
                isLast={i === equipRows.length - 1}
              />
            ))}
          </CollapsibleSection>
            </View>
          )}

          <View style={styles.sectionDivider} />

          {/* ── Achievements ── */}
          {achievements.length > 0 && (
            <View style={styles.armyCard}>
              <SettingRow
                icon="star-outline"
                title="Achievements"
                isFirst
                compact
                desc={
                  <View style={styles.achievementHeaderDesc}>
                    <View style={styles.achievementHeaderBar}>
                      <View style={[styles.achievementHeaderFill, { width: `${allAchievementsComplete ? 100 : starTotals.max > 0 ? (starTotals.earned / starTotals.max) * 100 : 0}%` }]} />
                    </View>
                  </View>
                }
              >
                <View style={styles.sectionBadges}>
                  <View style={[styles.sectionBadge, styles.sectionBadgeFirst, allAchievementsComplete && styles.sectionBadgeMaxed]}>
                    <Text style={[styles.sectionBadgeText, allAchievementsComplete && styles.sectionBadgeTextMaxed]}>{formatCompact(starTotals.earned)}</Text>
                    <Text style={[styles.sectionBadgeLabel, allAchievementsComplete && styles.sectionBadgeTextMaxed]}>/ {formatCompact(starTotals.max)}</Text>
                  </View>
                </View>
              </SettingRow>
              {[...achievementGroups].reverse().map((group, gi) => (
                <CollapsibleSection
                  key={group.group}
                  isLast={gi === achievementGroups.length - 1}
                  compact
                  icon={ACHIEVEMENT_GROUP_META[group.group].icon}
                  title={group.label}
                  description={ACHIEVEMENT_GROUP_META[group.group].desc}
                  count={group.items.length}
                  totalLevel={0}
                  totalMax={0}
                  badge={(
                    <View style={[styles.sectionBadge, gi === achievementGroups.length - 1 && styles.sectionBadgeLast]}>
                      <Text style={styles.sectionBadgeText}>{group.items.length}</Text>
                    </View>
                  )}
                >
                  {group.items.map((a, idx) => (
                    <AchievementCard
                      key={`${a.name}-${idx}`}
                      achievement={a}
                      showVillage
                      isFirst={idx === 0}
                      isLast={idx === group.items.length - 1}
                    />
                  ))}
                </CollapsibleSection>
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      ) : (
        <View style={styles.centerBox}>
          <Ionicons name="person-outline" size={40} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Search a player</Text>
          <Text style={styles.emptySub}>Enter a player tag above to inspect their profile.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...Typography.title3, color: Colors.textPrimary, letterSpacing: -0.3, lineHeight: 22 },
  subtitle: { ...Typography.caption, color: Colors.textMuted },
  searchWrap: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.subhead,
    color: Colors.textPrimary,
    paddingVertical: Spacing.sm,
  },
  searchBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
  },
  searchBtnText: { ...Typography.subhead, color: Colors.bg, fontWeight: '700' },
  scroll: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xs, gap: Spacing.base },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  emptyTitle: { ...Typography.headline, color: Colors.textPrimary },
  emptySub: { ...Typography.subhead, color: Colors.textTertiary, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 52, height: 52 },
  avatarText: { fontSize: 26, fontWeight: '800', color: Colors.textSecondary },
  playerInfo: { flex: 1 },
  playerName: { ...Typography.headline, color: Colors.textPrimary, letterSpacing: -0.3 },
  playerTag: { ...Typography.caption, color: Colors.textMuted, fontVariant: ['tabular-nums'], marginTop: 1 },
  chipRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentGhost,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  chipOut: { opacity: 0.7 },
  chipText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  thBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thLevel: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  thLabel: { ...Typography.caption, color: Colors.textTertiary, fontSize: 9, letterSpacing: 1 },
  clanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  clanBadge: { width: 22, height: 22 },
  clanName: { flex: 1, ...Typography.subhead, color: Colors.textPrimary, fontWeight: '600' },
  clanLevel: { ...Typography.caption, color: Colors.textTertiary },
  leagueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  leagueIcon: { width: 22, height: 22 },
  leagueName: { flex: 1, ...Typography.subhead, color: Colors.textSecondary },
  leagueTrophies: { ...Typography.subhead, color: Colors.textPrimary, fontWeight: '700', fontVariant: ['tabular-nums'] },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
  },
  actionBtnSaved: { backgroundColor: Colors.accentGhost },
  actionBtnText: { ...Typography.subhead, color: Colors.bg, fontWeight: '700' },
  actionBtnTextSaved: { color: Colors.textPrimary },
  actionBtnGhost: { backgroundColor: Colors.bgSubtle },
  actionBtnTextGhost: { color: Colors.textPrimary },
  openGameBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
  },
  openGameBtnText: { ...Typography.subhead, color: Colors.textPrimary, fontWeight: '600' },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  errorText: { flex: 1, ...Typography.subhead, color: Colors.textSecondary, lineHeight: 18 },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
  },
  retryText: { ...Typography.subhead, color: Colors.bg, fontWeight: '700' },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.lg,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },
  statCardLast: {
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  statCardIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardText: {
    flex: 1,
  },
  statCardLabel: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  statCardSub: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: Spacing.xs / 2,
  },
  statCardValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '700',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  armyCard: {
    gap: Spacing.xs,
    borderRadius: Radius.xl * 1.25,
    overflow: 'hidden',
  },
  sectionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionBadge: {
    minWidth: 36,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  sectionBadgeMaxed: {
    backgroundColor: Colors.warning,
  },
  sectionBadgeFirst: {
    borderTopRightRadius: Radius.lg,
  },
  sectionBadgeLast: {
    borderBottomRightRadius: Radius.lg,
  },
  sectionBadgeText: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sectionBadgeTextMaxed: {
    color: Colors.bg,
  },
  sectionBadgeLabel: {
    fontSize: 8,
    lineHeight: 9,
    color: Colors.textPrimary,
    opacity: 0.7,
    fontVariant: ['tabular-nums'],
  },
  sectionBody: { paddingTop: 0 },
  sectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    margin: Spacing.lg,
  },
  emptyText: { ...Typography.subhead, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
  achievementHeaderDesc: {
    marginTop: 6,
  },
  achievementHeaderBar: {
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  achievementHeaderFill: {
    height: '100%',
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },
});
