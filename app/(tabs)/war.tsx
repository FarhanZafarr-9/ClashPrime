import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PressableRipple from '../../src/components/PressableRipple';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, clashFontFamily, useTheme } from '../../src/theme';
import { Skeleton } from '../../src/components/Skeleton';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { ClashAPI, ClashAPIError } from '../../src/api/clash';
import { getApiToken } from '../../src/hooks/usePlayer';
import type { ClanWar, WarLogEntry, WarClanDetail, WarMember, WarState, ClashPlayer } from '../../src/types/clash';
import { filterHomeTroops } from '../../src/types/clash';
import { Card } from '../../src/components/Card';
import { SettingRow } from '../../src/components/SettingRow';
import { getTownHallImageSource } from '../../src/utils/buildingImages';
import { getAllItemsAtTH } from '../../src/utils/thMaxLevels';

const WAR_AUTO_REFRESH_KEY = 'clashprime_war_auto_refresh_ts';
const WAR_AUTO_REFRESH_MS = 30 * 60 * 1000;

async function getWarAutoRefreshTs(clanTag: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(`${WAR_AUTO_REFRESH_KEY}_${clanTag}`);
  return raw ? parseInt(raw, 10) : null;
}

async function setWarAutoRefreshTs(clanTag: string): Promise<void> {
  await AsyncStorage.setItem(`${WAR_AUTO_REFRESH_KEY}_${clanTag}`, String(Date.now()));
}

interface WarScreenData {
  currentWar: ClanWar | null;
  warLog: WarLogEntry[];
}

interface CwlRoundWar {
  round: number;
  war: ClanWar | null;
}

interface CwlLeagueData {
  season: string | null;
  wars: CwlRoundWar[];
}

interface WarIssue {
  key: string;
  title: string;
  message: string;
  severity: 'error' | 'warning';
}

interface WarStatusInfo {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}

const STATUS_CONFIG: Record<WarState, WarStatusInfo> = {
  preparation: { label: 'Preparation', icon: 'hourglass-outline', color: '#FFB74D', bg: 'rgba(255,183,77,0.12)' },
  inWar: { label: 'In War', icon: 'flame-outline', color: '#4FC3F7', bg: 'rgba(79,195,247,0.12)' },
  warEnded: { label: 'War Ended', icon: 'flag-outline', color: '#9E9E9E', bg: 'rgba(158,158,158,0.12)' },
  notInWar: { label: 'No War', icon: 'flag-outline', color: '#9E9E9E', bg: 'rgba(158,158,158,0.12)' },
};

function describeWarError(e: unknown, context: 'currentWar' | 'warLog'): { title: string; message: string } {
  if (e instanceof ClashAPIError) {
    if (e.status === 403) {
      if (context === 'warLog') {
        return {
          title: 'War log unavailable',
          message: 'This clan\u2019s war log can\u2019t be read through the API. It may be private or have fewer than 5 wars on record. Current war data is unaffected.',
        };
      }
      return {
        title: 'Access denied',
        message: 'The current war can\u2019t be read. Your API token may be invalid or lack permission, or the clan\u2019s war data may be private. Check your token in Settings.',
      };
    }
    if (e.status === 429) return { title: 'Rate limited', message: e.message };
    if (e.status === 404) return { title: 'Not found', message: e.message };
    if (e.status === 0) return { title: 'Network error', message: e.message };
    if (e.status >= 500) return { title: 'API unavailable', message: e.message };
  }
  const msg = e instanceof Error ? e.message : String(e ?? 'Unknown error');
  return { title: 'Something went wrong', message: msg };
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDateTime(iso: string): string {
  const d = parseCoCDate(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function parseCoCDate(str: string): Date {
  const y = str.slice(0, 4);
  const m = str.slice(4, 6);
  const d = str.slice(6, 8);
  const h = str.slice(9, 11);
  const min = str.slice(11, 13);
  const s = str.slice(13, 15);
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}.000Z`);
}

function formatTime(iso: string): string {
  const d = parseCoCDate(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays > 30) return `${Math.floor(diffDays / 30)}mo ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  const diffHrs = Math.floor(diffMs / 3600000);
  if (diffHrs > 0) return `${diffHrs}h ago`;
  const diffMin = Math.floor(diffMs / 60000);
  return `${Math.max(1, diffMin)}m ago`;
}

// ── Attack plan heuristics ──
interface AttackSuggestion {
  member: WarMember;
  position: number;
  thDelta: number;
  expectedStars: number;
  remaining: number;
  isMirror: boolean;
  attackedByUs: number;
  ev: number;
  tag: 'best' | 'mirror' | 'cleanup' | 'risky' | null;
}

interface AttackPlan {
  myTH: number;
  offense: number;
  mirror: AttackSuggestion | null;
  suggestions: AttackSuggestion[];
  attacksLeft: number;
  maxAttacks: number;
}

function computeOffensePower(player: ClashPlayer): number {
  const th = player.townHallLevel;
  if (th <= 0) return 0.5;
  const ownedMap = (list: { name: string; level: number }[]): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const it of list) m[it.name.toLowerCase()] = it.level;
    return m;
  };
  const ratio = (owned: Record<string, number>, allAtTH: { name: string; maxLevel: number }[]) => {
    if (allAtTH.length === 0) return 1;
    let sum = 0;
    for (const { name, maxLevel } of allAtTH) {
      const level = owned[name.toLowerCase()] ?? 0;
      sum += maxLevel > 0 ? level / maxLevel : 1;
    }
    return sum / allAtTH.length;
  };
  const homeTroops = filterHomeTroops(player.troops);
  const homeHeroes = player.heroes.filter((h) => h.village === 'home');
  const homeSpells = player.spells.filter((s) => s.village === 'home' || !s.village);
  const all = getAllItemsAtTH(th);
  const ratios = [
    ratio(ownedMap(homeTroops), all.filter((i) => i.type === 'troop')),
    ratio(ownedMap(homeSpells), all.filter((i) => i.type === 'spell')),
    ratio(ownedMap(homeHeroes), all.filter((i) => i.type === 'hero')),
  ];
  if (player.heroEquipment.length > 0) {
    ratios.push(player.heroEquipment.reduce((s, e) => s + (e.maxLevel > 0 ? Math.min(e.level / e.maxLevel, 1) : 1), 0) / player.heroEquipment.length);
  }
  return ratios.length > 0 ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0.5;
}

function estimateFreshStars(myTH: number, targetTH: number, offense: number): number {
  const delta = targetTH - myTH;
  let stars = 2.2 + 0.8 * offense;
  if (delta > 0) stars -= 1.1 * delta;
  else if (delta < 0) stars += 0.35 * delta;
  return Math.max(0, Math.min(3, stars));
}

function estimateCleanupStars(remaining: number, offense: number): number {
  return Math.max(0, Math.min(remaining, remaining * (0.55 + 0.45 * offense)));
}

function buildAttackPlan(opts: {
  player: ClashPlayer | null | undefined;
  clan: WarClanDetail;
  opponent: WarClanDetail;
  myPlayerTag?: string | null;
  clanStars: number;
  opponentStars: number;
  maxAttacks: number;
}): AttackPlan | null {
  const { player, clan, opponent, myPlayerTag, clanStars, opponentStars, maxAttacks } = opts;
  if (!player || !myPlayerTag) return null;
  const me = clan.members.find((m) => m.tag === myPlayerTag);
  if (!me) return null;
  const myAttacks = me.attacks ?? [];
  const attacksLeft = Math.max(0, maxAttacks - myAttacks.length);
  if (attacksLeft === 0) return null;
  const attackedByMe = new Set(myAttacks.map((a) => a.defenderTag));
  const myTH = player.townHallLevel;
  const offense = computeOffensePower(player);

  const attackCounts = new Map<string, number>();
  for (const m of clan.members) {
    for (const a of m.attacks ?? []) {
      attackCounts.set(a.defenderTag, (attackCounts.get(a.defenderTag) ?? 0) + 1);
    }
  }

  const margin = clanStars - opponentStars;
  const suggestions: AttackSuggestion[] = [];
  for (const target of opponent.members) {
    if (attackedByMe.has(target.tag)) continue;
    const takenStars = target.bestOpponentAttack?.stars ?? 0;
    const remaining = Math.max(0, 3 - takenStars);
    if (remaining === 0) continue;
    const freshStars = estimateFreshStars(myTH, target.townhallLevel, offense);
    const expectedStars = remaining < 3 ? estimateCleanupStars(remaining, offense) : freshStars;

    let ev = expectedStars;
    const attackedByUs = attackCounts.get(target.tag) ?? target.opponentAttacks ?? 0;
    if (attackedByUs === 0) ev += 0.1;
    if (margin < 0) ev *= 1 + Math.min(0.25, -margin * 0.05);
    else if (margin >= 6) ev += 0.05;

    suggestions.push({
      member: target,
      position: target.mapPosition,
      thDelta: target.townhallLevel - myTH,
      expectedStars,
      remaining,
      isMirror: target.mapPosition === me.mapPosition,
      attackedByUs,
      ev,
      tag: null,
    });
  }

  suggestions.sort((a, b) => b.ev - a.ev);
  const top = suggestions.slice(0, 5);
  top.forEach((s) => {
    if (s === top[0]) s.tag = 'best';
    else if (s.isMirror) s.tag = 'mirror';
    else if (s.remaining < 3) s.tag = 'cleanup';
    else if (s.expectedStars < 1) s.tag = 'risky';
  });

  return {
    myTH,
    offense,
    mirror: suggestions.find((s) => s.isMirror) ?? null,
    suggestions: top,
    attacksLeft,
    maxAttacks,
  };
}

function WarResultBadge({ result }: { result: string }) {
  const config = {
    win: { label: 'W', color: '#4CAF50', bg: 'rgba(76,175,80,0.15)' },
    lose: { label: 'L', color: '#f44336', bg: 'rgba(244,67,54,0.15)' },
    draw: { label: 'D', color: Colors.textMuted, bg: Colors.bgSubtle },
  }[result] || { label: '—', color: Colors.textMuted, bg: Colors.bgSubtle };
  return (
    <View style={[styles.logResultBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.logResultText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function WarScreenSkeleton() {
  const { colors } = useTheme();
  const rowRadius = Radius.xl * 1.25;
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Skeleton width={80} height={28} borderRadius={6} />
          <Skeleton width={28} height={28} borderRadius={6} />
        </View>
        <Skeleton width={140} height={14} borderRadius={4} style={{ marginTop: 4 }} />
      </View>

      {/* Top tabs */}
      <View style={styles.topTabs}>
        <Skeleton height={40} borderRadius={Radius.md} style={{ flex: 1, borderTopRightRadius: Radius.sm, borderBottomRightRadius: Radius.sm }} />
        <Skeleton height={40} borderRadius={Radius.md} style={{ flex: 1, borderTopLeftRadius: Radius.sm, borderBottomLeftRadius: Radius.sm }} />
      </View>

      <View style={styles.skeletonContent}>
        {/* Legend card */}
        <View style={[styles.skeletonCard, { backgroundColor: colors.bgCardHover }]}>
          <Skeleton width={32} height={32} borderRadius={Radius.md} />
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton width={60} height={13} borderRadius={4} />
            <Skeleton width={130} height={10} borderRadius={3} />
          </View>
          <Skeleton width={14} height={14} borderRadius={7} />
        </View>

        {/* Clan cards + VS */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <View style={[styles.skeletonClanCard, { backgroundColor: colors.bgCardHover }]}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <Skeleton width={80} height={12} borderRadius={4} />
            <Skeleton width={40} height={10} borderRadius={3} />
          </View>
          <View style={{ width: 56, alignItems: 'center', gap: 4 }}>
            <Skeleton width={20} height={10} borderRadius={3} />
            <Skeleton width={32} height={10} borderRadius={3} />
          </View>
          <View style={[styles.skeletonClanCard, { backgroundColor: colors.bgCardHover }]}>
            <Skeleton width={40} height={40} borderRadius={20} />
            <Skeleton width={100} height={12} borderRadius={4} />
            <Skeleton width={40} height={10} borderRadius={3} />
          </View>
        </View>

        {/* Stats table */}
        <View style={[styles.skeletonGroup, { backgroundColor: colors.bgCardHover }]}>
          {[0, 1, 2].map((r) => (
            <View key={r} style={[styles.skeletonTableRow, r < 2 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={{ width: 108, paddingLeft: Spacing.lg, paddingRight: Spacing.xs, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border }}>
                <Skeleton width={50} height={10} borderRadius={3} />
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Skeleton width={40} height={10} borderRadius={3} />
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Skeleton width={40} height={10} borderRadius={3} />
              </View>
            </View>
          ))}
        </View>

        {/* Members section */}
        <View style={styles.skeletonLabel}>
          <Skeleton width={60} height={14} borderRadius={4} />
        </View>
        <View style={styles.skeletonList}>
          {/* members collapse row (expanded by default) */}
          <View style={[styles.skeletonRow, { backgroundColor: colors.bgCardHover, borderTopLeftRadius: rowRadius, borderTopRightRadius: rowRadius }]}>
            <Skeleton width={32} height={32} borderRadius={Radius.md} />
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton width="45%" height={13} borderRadius={4} />
              <Skeleton width="30%" height={10} borderRadius={3} />
            </View>
            <Skeleton width={16} height={16} borderRadius={8} />
          </View>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.skeletonRow, { backgroundColor: colors.bgCardHover }, i === 2 && { borderBottomLeftRadius: rowRadius, borderBottomRightRadius: rowRadius }]}>
              <Skeleton width={20} height={20} borderRadius={4} />
              <View style={{ flex: 1, gap: 4 }}>
                <Skeleton width="55%" height={12} borderRadius={4} />
                <Skeleton width="25%" height={9} borderRadius={3} />
              </View>
              <Skeleton width={24} height={10} borderRadius={3} />
            </View>
          ))}
        </View>

        {/* Enemy members section (collapsed by default, so just the toggle row) */}
        <View style={styles.skeletonLabel}>
          <Skeleton width={90} height={14} borderRadius={4} />
        </View>
        <View style={styles.skeletonList}>
          <View style={[styles.skeletonRow, { backgroundColor: colors.bgCardHover, borderRadius: rowRadius }]}>
            <Skeleton width={32} height={32} borderRadius={Radius.md} />
            <View style={{ flex: 1, gap: 4 }}>
              <Skeleton width="45%" height={13} borderRadius={4} />
              <Skeleton width="30%" height={10} borderRadius={3} />
            </View>
            <Skeleton width={16} height={16} borderRadius={8} />
          </View>
        </View>

        <View style={{ height: 120 }} />
      </View>
    </SafeAreaView>
  );
}

export default function WarScreen() {
  const { player } = usePlayer();
  const [data, setData] = useState<WarScreenData | null>(null);
  const [cwlLeague, setCwlLeague] = useState<CwlLeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchIssues, setFetchIssues] = useState<WarIssue[]>([]);
  const [warLogView, setWarLogView] = useState<'regular' | 'cwl'>('regular');
  const [screenView, setScreenView] = useState<'current' | 'history'>('current');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const clanTag = player?.clan?.tag ?? null;
  const myPlayerTag = player?.tag ?? null;

  const regularWars = (data?.warLog || []).filter(e => e.attacksPerMember === 2);
  const cwlWars = (data?.warLog || []).filter(e => e.attacksPerMember === 1);
  const warLogBlocked = fetchIssues.some(i => i.key === 'warLog' || i.key === 'warLogPrivacy');
  const warLogPrivate = fetchIssues.some(i => i.key === 'warLogPrivacy');
  const cwlActive = (cwlLeague?.wars.length ?? 0) > 0;

  function groupByMonth(entries: WarLogEntry[]): { key: string; label: string; wars: WarLogEntry[]; wins: number; losses: number; draws: number; totalStars: number }[] {
    const groups: Record<string, WarLogEntry[]> = {};
    for (const e of entries) {
      const d = parseCoCDate(e.endTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, wars]) => {
        const d = parseCoCDate(wars[0].endTime);
        const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        const wins = wars.filter(w => w.result === 'win').length;
        const losses = wars.filter(w => w.result === 'lose').length;
        const draws = wars.filter(w => w.result === 'draw').length;
        const totalStars = wars.reduce((s, w) => s + (w.clan.stars || 0), 0);
        return { key, label, wars, wins, losses, draws, totalStars };
      });
  }

  const cwlGroups = groupByMonth(cwlWars);

  const hasHistory = regularWars.length > 0 || cwlGroups.length > 0;
  const showHistorySection = hasHistory || warLogBlocked;

  const loadWarData = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        setError(null);
        setCwlLeague(null);
      }
      setFetchIssues([]);
      const token = await getApiToken();
      if (!token) {
        setError('API token not configured.');
        return;
      }
      if (!clanTag) {
        setError('No clan linked.');
        return;
      }
      const api = new ClashAPI(token);
      const [currentWarRes, warLogRes, leagueGroupRes, clanRes] = await Promise.allSettled([
        api.getCurrentWar(clanTag),
        api.getWarLog(clanTag),
        api.getCwlLeagueGroup(clanTag),
        api.getClan(clanTag),
      ]);

      const leagueGroup = leagueGroupRes.status === 'fulfilled' ? leagueGroupRes.value : null;
      const lgState: string | undefined = leagueGroup?.state;
      const inCwlLeague = !!lgState && lgState !== 'notInWar';
      const warLogPublic = clanRes.status === 'fulfilled' ? clanRes.value.isWarLogPublic : true;

      const addIssue = (issue: WarIssue) =>
        setFetchIssues(prev => (prev.some(i => i.key === issue.key) ? prev : [...prev, issue]));
      const privacyBlocked = (reason: unknown) =>
        reason instanceof ClashAPIError && reason.status === 403 && !warLogPublic;
      const privacyIssue: WarIssue = {
        key: 'warLogPrivacy',
        title: 'Clan war data is private',
        message: 'This clan has Public War Log turned off, so the API hides its war data. A clan leader can enable it under Clan Settings \u2192 Public War Log, then pull to refresh.',
        severity: 'warning',
      };

      let currentWar: ClanWar | null = null;
      if (currentWarRes.status === 'fulfilled') {
        if (currentWarRes.value.state !== 'notInWar') currentWar = currentWarRes.value;
      }
      if (currentWarRes.status === 'rejected' && !inCwlLeague && !privacyBlocked(currentWarRes.reason)) {
        const desc = describeWarError(currentWarRes.reason, 'currentWar');
        addIssue({
          key: 'currentWar',
          title: desc.title,
          message: desc.message,
          severity: currentWarRes.reason instanceof ClashAPIError && currentWarRes.reason.status >= 500 ? 'warning' : 'error',
        });
      }

      let warLog: WarLogEntry[] = [];
      if (warLogRes.status === 'fulfilled') {
        warLog = warLogRes.value.items || [];
      } else if (!inCwlLeague) {
        if (privacyBlocked(warLogRes.reason)) {
          addIssue(privacyIssue);
        } else {
          const desc = describeWarError(warLogRes.reason, 'warLog');
          addIssue({
            key: 'warLog',
            title: desc.title,
            message: desc.message,
            severity: warLogRes.reason instanceof ClashAPIError && warLogRes.reason.status >= 500 ? 'warning' : 'error',
          });
        }
      }

      let cwl: CwlLeagueData | null = null;
      if (inCwlLeague) {
        const rounds: { warTags?: string[] }[] = leagueGroup?.rounds ?? [];
        const wars: CwlRoundWar[] = [];
        const seen = new Set<string>();
        for (const [roundIdx, round] of rounds.entries()) {
          for (const warTag of round?.warTags ?? []) {
            if (!warTag || warTag === '#0' || seen.has(warTag)) continue;
            seen.add(warTag);
            const war = await api.getCwlWar(warTag).catch(() => null);
            if (war && (war.clan?.tag === clanTag || war.opponent?.tag === clanTag)) {
              wars.push({ round: roundIdx + 1, war });
            }
          }
        }
        const collectedRounds = new Set(wars.map((w) => w.round));
        for (let r = 1; r <= rounds.length; r++) {
          if (!collectedRounds.has(r)) wars.push({ round: r, war: null });
        }
        wars.sort((a, b) => a.round - b.round);
        cwl = { season: leagueGroup?.season ?? null, wars };
      }
      setCwlLeague(cwl);

      setData({ currentWar, warLog });
    } catch (e: any) {
      setError(e?.message || 'Failed to load war data');
    }
  }, [clanTag]);

  useEffect(() => {
    (async () => {
      if (data) return;
      await loadWarData();
      if (clanTag) await setWarAutoRefreshTs(clanTag);
      setLoading(false);
    })();
  }, [data, loadWarData, clanTag]);

  useFocusEffect(
    useCallback(() => {
      if (data) {
        (async () => {
          if (clanTag) {
            const lastTs = await getWarAutoRefreshTs(clanTag);
            if (lastTs == null || Date.now() - lastTs >= WAR_AUTO_REFRESH_MS) {
              await loadWarData(true);
              if (clanTag) await setWarAutoRefreshTs(clanTag);
            }
          }
        })();
      }
    }, [clanTag, data, loadWarData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWarData(true);
    setRefreshing(false);
  }, [loadWarData]);

  if (loading) return <WarScreenSkeleton />;

  if (error && !data) {
    const isConfigError = error === 'API token not configured.' || error === 'No clan linked.';
    const configInfo = error === 'API token not configured.'
      ? {
        icon: 'key-outline' as const,
        title: 'API token not configured',
        message: 'Add your Clash of Clans API token in Settings to view live war data.',
      }
      : {
        icon: 'shield-checkmark-outline' as const,
        title: 'No clan linked',
        message: 'Add a player tag in Settings who belongs to a clan to see war data.',
      };
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>War</Text>
          </View>
          <Text style={styles.subtitle}>Current war & history</Text>
        </View>
        <View style={styles.center}>
          {isConfigError ? (
            <>
              <Ionicons name={configInfo.icon} size={44} color={Colors.textTertiary} />
              <Text style={styles.errorTitle}>{configInfo.title}</Text>
              <Text style={styles.errorText}>{configInfo.message}</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-offline-outline" size={48} color={Colors.textTertiary} />
              <Text style={styles.errorTitle}>Couldn&apos;t load war data</Text>
              <Text style={styles.errorText}>{error}</Text>
            </>
          )}
          <PressableRipple onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </PressableRipple>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>War</Text>
          {player?.clan && player.clan.badgeUrls?.medium && (
            <Image source={{ uri: player.clan.badgeUrls.medium }} style={styles.clanBadgeImg} />
          )}
        </View>
        <Text style={styles.subtitle}>
          {player?.clan ? player.clan.name : 'Current war & history'}
        </Text>
      </View>

      <View style={styles.topTabs}>
        <PressableRipple
          style={[styles.topTab, styles.topTabLeft, screenView === 'current' && styles.topTabActive]}
          onPress={() => setScreenView('current')}
        >
          <Ionicons name="flame-outline" size={14} color={screenView === 'current' ? Colors.bg : Colors.textSecondary} />
          <Text style={[styles.topTabText, screenView === 'current' && styles.topTabTextActive]}>Current War</Text>
        </PressableRipple>
        <PressableRipple
          style={[styles.topTab, styles.topTabRight, screenView === 'history' && styles.topTabActive]}
          onPress={() => setScreenView('history')}
        >
          <Ionicons name="time-outline" size={14} color={screenView === 'history' ? Colors.bg : Colors.textSecondary} />
          <Text style={[styles.topTabText, screenView === 'history' && styles.topTabTextActive]}>War History</Text>
        </PressableRipple>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.textMuted}
          />
        }
      >
        <LegendCard />

        {screenView === 'current' ? (
          <>
            {data?.currentWar && (
              <CurrentWarSection war={data.currentWar} now={now} myClanTag={clanTag} myPlayerTag={myPlayerTag} player={player} />
            )}

            {!data?.currentWar && !cwlActive && (
              <Card style={styles.noWarCard}>
                <Ionicons name="flag-outline" size={32} color={Colors.textTertiary} />
                <Text style={styles.noWarTitle}>No Active War</Text>
                <Text style={styles.noWarSub}>
                  {warLogPrivate
                    ? 'War data is hidden because this clan has Public War Log turned off. A leader can enable it in Clan Settings, then pull to refresh.'
                    : showHistorySection
                      ? 'Your clan isn\u2019t in a war right now. Recent results are below.'
                      : 'Your clan isn\u2019t in a regular war or Clan War League right now. Results will appear here once a war ends.'}
                </Text>
              </Card>
            )}

            {fetchIssues.length > 0 && (
              <View style={styles.issueList}>
                {fetchIssues.map((issue) => {
                  const isError = issue.severity === 'error';
                  const accent = isError ? Colors.destructive : Colors.warning;
                  return (
                    <View key={issue.key} style={[styles.issueBanner, isError && styles.issueBannerError]}>
                      <Ionicons name={isError ? 'alert-circle-outline' : 'warning-outline'} size={16} color={accent} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.issueTitle, { color: accent }]}>{issue.title}</Text>
                        <Text style={styles.issueMessage}>{issue.message}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {cwlLeague && cwlActive && (
              <>
                <View style={styles.sectionHeader}>
                  <Ionicons name="flash-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.sectionTitle}>Clan War Leagues</Text>
                </View>
                <Text style={styles.cwlSeasonText}>
                  {cwlLeague.season}{cwlLeague.season ? ' · ' : ''}{cwlLeague.wars.length} round{cwlLeague.wars.length === 1 ? '' : 's'}
                </Text>
                {cwlLeague.wars.map(({ round, war }, i) => (
                  war ? (
                    <CwlRoundCard key={`${round}-${war.endTime}`} round={round} war={war} myClanTag={clanTag} myPlayerTag={myPlayerTag} player={player} now={now} isFirst={i === 0} isLast={i === cwlLeague.wars.length - 1} />
                  ) : (
                    <CwlPendingRoundCard key={`round-${round}`} round={round} isFirst={i === 0} isLast={i === cwlLeague.wars.length - 1} />
                  )
                ))}
              </>
            )}
          </>
        ) : (
          showHistorySection ? (
            <>
              <View style={styles.sectionHeader}>
                <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>War History</Text>
              </View>

            <View style={styles.pillRow}>
          <PressableRipple
            style={[styles.pill, warLogView === 'regular' && styles.pillActive]}
            onPress={() => setWarLogView('regular')}
          >
            <Ionicons name="shield-outline" size={14} color={warLogView === 'regular' ? Colors.bg : Colors.textSecondary} />
            <Text style={[styles.pillText, warLogView === 'regular' && styles.pillTextActive]}>Regular</Text>
          </PressableRipple>
          <PressableRipple
            style={[styles.pill, warLogView === 'cwl' && styles.pillActive]}
            onPress={() => setWarLogView('cwl')}
          >
            <Ionicons name="flash-outline" size={14} color={warLogView === 'cwl' ? Colors.bg : Colors.textSecondary} />
            <Text style={[styles.pillText, warLogView === 'cwl' && styles.pillTextActive]}>CWL</Text>
          </PressableRipple>
        </View>

        {warLogView === 'regular' ? (
          regularWars.length > 0 ? (
            regularWars.map((entry, i) => (
              <WarLogRow key={i} entry={entry} isFirst={i === 0} isLast={i === regularWars.length - 1} />
            ))
          ) : (
            <Card style={styles.noWarCard}>
              <Ionicons name={warLogBlocked ? 'lock-closed-outline' : 'shield-outline'} size={24} color={Colors.textTertiary} />
              <Text style={styles.noWarTitle}>{warLogBlocked ? 'War log unavailable' : 'No Regular Wars Yet'}</Text>
              <Text style={styles.noWarSub}>
                {warLogBlocked && cwlActive
                  ? 'Regular war history can\u2019t be read during a CWL season. It will return after the league ends.'
                  : warLogPrivate
                    ? 'The clan has Public War Log turned off. A leader can enable it in Clan Settings so history shows here.'
                    : warLogBlocked
                      ? 'This clan\u2019s war log is private or has fewer than 5 wars, so it can\u2019t be read through the API.'
                      : 'Regular wars are 2-attack wars. History will appear here after your first war ends.'}
              </Text>
            </Card>
          )
        ) : (
          cwlGroups.length > 0 ? (
            cwlGroups.map(group => (
              <View key={group.key}>
                <View style={styles.cwlGroupHeader}>
                  <Text style={styles.cwlGroupTitle}>{group.label}</Text>
                  <Text style={styles.cwlGroupRecord}>
                    {group.wins}W {group.losses}L {group.draws > 0 ? `${group.draws}D ` : ''}
                    · {group.totalStars}★ · {group.wars.length} wars
                  </Text>
                </View>
                {group.wars.map((entry, i) => (
                  <WarLogRow key={i} entry={entry} isFirst={i === 0} isLast={i === group.wars.length - 1} />
                ))}
              </View>
            ))
          ) : (
            <Card style={styles.noWarCard}>
              <Ionicons name={warLogBlocked ? 'lock-closed-outline' : 'flash-outline'} size={24} color={Colors.textTertiary} />
              <Text style={styles.noWarTitle}>{warLogBlocked ? 'War log unavailable' : 'No CWL Wars'}</Text>
              <Text style={styles.noWarSub}>
                {warLogBlocked && cwlActive
                  ? 'Your clan is currently in a league — see the Clan War Leagues section above for live CWL rounds.'
                  : warLogPrivate
                    ? 'The clan has Public War Log turned off. A leader can enable it in Clan Settings so CWL history shows here.'
                    : warLogBlocked
                      ? 'This clan\u2019s war log is private or has fewer than 5 wars, so CWL history can\u2019t be read through the API.'
                      : 'Clan War Leagues use 1 attack per day. CWL history will show here once your clan participates.'}
              </Text>
            </Card>
          )
        )}
            </>
          ) : (
            <Card style={styles.noWarCard}>
              <Ionicons name="time-outline" size={24} color={Colors.textTertiary} />
              <Text style={styles.noWarTitle}>No War History</Text>
              <Text style={styles.noWarSub}>
                Your clan\u2019s war log history will appear here once available.
              </Text>
            </Card>
          )
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CurrentWarSection({ war, now, isCwl = false, myClanTag, myPlayerTag, player, embedded = false }: { war: ClanWar; now: number; isCwl?: boolean; myClanTag?: string | null; myPlayerTag?: string | null; player?: ClashPlayer | null; embedded?: boolean }) {
  const [showEnemy, setShowEnemy] = useState(false);
  const [showMine, setShowMine] = useState(true);
  const isPreparation = war.state === 'preparation';
  const isInWar = war.state === 'inWar';
  const isWarEnded = war.state === 'warEnded';
  const swapped = myClanTag != null && war.opponent.tag === myClanTag && war.clan.tag !== myClanTag;
  const clan = swapped ? war.opponent : war.clan;
  const opponent = swapped ? war.clan : war.opponent;
  const opponentNames = new Map(opponent.members.map(m => [m.tag, m.name]));
  const clanNames = new Map(clan.members.map(m => [m.tag, m.name]));
  const opponentPos = new Map(opponent.members.map(m => [m.tag, m.mapPosition]));
  const clanPos = new Map(clan.members.map(m => [m.tag, m.mapPosition]));
  const defenderLabel = (tag: string) => {
    const name = opponentNames.get(tag) ?? clanNames.get(tag) ?? tag;
    const pos = opponentPos.get(tag) ?? clanPos.get(tag);
    return pos ? `#${pos} ${name}` : name;
  };
  const members = isCwl
    ? [...clan.members].sort((a, b) => b.townhallLevel - a.townhallLevel)
    : [...clan.members].sort((a, b) => a.mapPosition - b.mapPosition);
  const opponentMembers = isCwl
    ? [...opponent.members].sort((a, b) => b.townhallLevel - a.townhallLevel)
    : [...opponent.members].sort((a, b) => a.mapPosition - b.mapPosition);

  const status = STATUS_CONFIG[war.state] ?? STATUS_CONFIG.notInWar;
  const clanStars = clan.stars ?? 0;
  const oppStars = opponent.stars ?? 0;

  const plan = isInWar || isPreparation
    ? buildAttackPlan({ player, clan, opponent, myPlayerTag, clanStars, opponentStars: oppStars, maxAttacks: isCwl ? 1 : 2 })
    : null;

  let countdown: { icon: keyof typeof Ionicons.glyphMap; text: string } | null = null;
  if (isPreparation) {
    const startMs = parseCoCDate(war.startTime).getTime();
    const left = startMs - now;
    countdown = left > 0
      ? { icon: 'hourglass-outline', text: `War starts in ${formatDuration(left)}` }
      : { icon: 'rocket-outline', text: 'War starting soon…' };
  } else if (isInWar) {
    const endMs = parseCoCDate(war.endTime).getTime();
    const left = endMs - now;
    countdown = left > 0
      ? { icon: 'timer-outline', text: `Ends in ${formatDuration(left)}` }
      : { icon: 'flag-outline', text: 'Finalizing results…' };
  } else if (isWarEnded) {
    countdown = { icon: 'calendar-outline', text: `Ended ${formatDateTime(war.endTime)}` };
  }

  const result = isWarEnded
    ? clanStars > oppStars
      ? { label: 'Victory', color: '#4CAF50', bg: 'rgba(76,175,80,0.12)', icon: 'trophy-outline' as const }
      : oppStars > clanStars
        ? { label: 'Defeat', color: '#f44336', bg: 'rgba(244,67,54,0.12)', icon: 'sad-outline' as const }
        : { label: 'Draw', color: Colors.textSecondary, bg: Colors.bgSubtle, icon: 'hand-left-outline' as const }
    : null;

  return (
    <View>
      {!embedded && (
        <View style={styles.warStatusRow}>
          <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.statusChipText, { color: status.color }]}>{status.label}</Text>
          </View>
          {countdown && (
            <View style={styles.countdownChip}>
              <Ionicons name={countdown.icon} size={12} color={Colors.textSecondary} />
              <Text style={styles.countdownText}>{countdown.text}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.warHeader}>
        <WarClanCard clan={clan} align="left" />
        <View style={styles.vsContainer}>
          <Text style={styles.vsLabel}>VS</Text>
          {!isPreparation && (
            <Text style={[styles.vsScore, clanStars > oppStars && styles.vsScoreWin]}>{clan.stars}</Text>
          )}
          <View style={styles.vsDash}>
            <Text style={styles.vsDashText}>—</Text>
          </View>
          {!isPreparation && (
            <Text style={[styles.vsScoreOpp, oppStars > clanStars && styles.vsScoreOppWin]}>{opponent.stars}</Text>
          )}
          <Text style={styles.vsTeamSize}>{war.teamSize}v{war.teamSize}</Text>
        </View>
        <WarClanCard clan={opponent} align="right" />
      </View>

      {isPreparation && (
        <Card style={{ marginTop: Spacing.md }}>
          <View style={styles.center}>
            <Ionicons name="hourglass-outline" size={24} color={Colors.textTertiary} />
            <Text style={styles.prepText}>Preparation Day</Text>
            <Text style={styles.prepSub}>
              War begins {formatDateTime(war.startTime)} · attacks unlock then
            </Text>
          </View>
        </Card>
      )}

      {!embedded && isWarEnded && result && (
        <View style={[styles.resultBanner, { backgroundColor: result.bg }]}>
          <Ionicons name={result.icon} size={20} color={result.color} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.resultLabel, { color: result.color }]}>{result.label}</Text>
            <Text style={styles.resultSub}>
              {clanStars}★ vs {oppStars}★
              {clan.destructionPercentage != null && opponent.destructionPercentage != null
                ? ` · ${clan.destructionPercentage.toFixed(1)}% vs ${opponent.destructionPercentage.toFixed(1)}%`
                : ''}
            </Text>
          </View>
        </View>
      )}

      {!isPreparation && (
        <View style={styles.warTable}>
          <View style={styles.warTableHeadRow}>
            <View style={styles.warTableHeadBlank} />
            <View style={styles.warTableHeadClan}>
              {clan.badgeUrls?.medium && (
                <Image source={{ uri: clan.badgeUrls.medium }} style={styles.warTableBadge} />
              )}
              <Text style={styles.warTableHead} numberOfLines={1}>{clan.name}</Text>
            </View>
            <View style={styles.warTableHeadClan}>
              {opponent.badgeUrls?.medium && (
                <Image source={{ uri: opponent.badgeUrls.medium }} style={styles.warTableBadge} />
              )}
              <Text style={styles.warTableHead} numberOfLines={1}>{opponent.name}</Text>
            </View>
          </View>
          <View style={[styles.warTableRow, styles.warTableRowAlt]}>
            <View style={styles.warTableLabelWrap}>
              <Ionicons name="star-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.warTableLabel}>Stars</Text>
            </View>
            <Text style={[styles.warTableCell, styles.warTableCellStrong, clanStars > oppStars && styles.warTableCellWin]}>{clan.stars}</Text>
            <Text style={[styles.warTableCell, styles.warTableCellStrong, oppStars > clanStars && styles.warTableCellWin]}>{opponent.stars}</Text>
          </View>
          <View style={styles.warTableRow}>
            <View style={styles.warTableLabelWrap}>
              <Ionicons name="flame-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.warTableLabel}>Destruction</Text>
            </View>
            <Text style={styles.warTableCell}>{clan.destructionPercentage != null ? clan.destructionPercentage.toFixed(1) : '—'}%</Text>
            <Text style={styles.warTableCell}>{opponent.destructionPercentage != null ? opponent.destructionPercentage.toFixed(1) : '—'}%</Text>
          </View>
          <View style={[styles.warTableRow, styles.warTableRowAlt, { borderBottomWidth: 0 }]}>
            <View style={styles.warTableLabelWrap}>
              <Ionicons name="flash-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.warTableLabel}>Attacks</Text>
            </View>
            <Text style={styles.warTableCell}>{clan.attacks ?? '—'}/{isCwl ? war.teamSize : war.teamSize * 2}</Text>
            <Text style={styles.warTableCell}>{opponent.attacks ?? '—'}/{isCwl ? war.teamSize : war.teamSize * 2}</Text>
          </View>
        </View>
      )}

      {plan && (
        <AttackPlanCard plan={plan} preparing={isPreparation} />
      )}

      {!isPreparation && (
        <>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.sectionTitle}>Members</Text>
          </View>
          <View style={{ marginBottom: Spacing.xs }}>
            <SettingRow
              icon="people-outline"
              title={showMine ? 'Hide clan members' : 'Show clan members'}
              desc={`${members.length} member${members.length === 1 ? '' : 's'}`}
              onPress={() => setShowMine((v) => !v)}
              compact
              isFirst
              isLast={!showMine}
            >
              <Ionicons name={showMine ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
            </SettingRow>
          </View>
          {showMine && (
            <View style={styles.memberList}>
              {members.map((m, i) => (
                <MemberRow key={m.tag} member={m} defenderName={defenderLabel} isCwl={isCwl} isMine={myPlayerTag != null && m.tag === myPlayerTag} isLast={i === members.length - 1} />
              ))}
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Ionicons name="shield-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.sectionTitle}>Enemy Members</Text>
          </View>
          <View style={{ marginBottom: Spacing.xs }}>
            <SettingRow
              icon="shield-outline"
              title={showEnemy ? 'Hide enemy members' : 'Show enemy members'}
              desc={`${opponentMembers.length} member${opponentMembers.length === 1 ? '' : 's'}`}
              onPress={() => setShowEnemy((v) => !v)}
              compact
              isFirst
              isLast={!showEnemy}
            >
              <Ionicons name={showEnemy ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
            </SettingRow>
          </View>
          {showEnemy && (
            <React.Fragment>
              <View style={styles.memberList}>
                {opponentMembers.map((m, i) => (
                  <MemberRow key={m.tag} member={m} defenderName={defenderLabel} isCwl={isCwl} isMine={false} isLast={i === opponentMembers.length - 1} />
                ))}
              </View>
            </React.Fragment>
          )}
        </>
      )}
    </View>
  );
}

function WarClanCard({ clan, align }: { clan: WarClanDetail; align: 'left' | 'right' }) {
  return (
    <View style={[styles.warClanCard, align === 'right' && styles.warClanCardRight]}>
      {clan.badgeUrls?.medium && (
        <Image source={{ uri: clan.badgeUrls.medium }} style={styles.warClanBadge} />
      )}
      <Text style={styles.warClanName} numberOfLines={1}>{clan.name}</Text>
      <Text style={styles.warClanLevel}>Lv.{clan.clanLevel}</Text>
    </View>
  );
}

function CwlRoundCard({ round, war, myClanTag, myPlayerTag, player, now, isFirst, isLast }: { round: number; war: ClanWar; myClanTag: string | null; myPlayerTag?: string | null; player?: ClashPlayer | null; now: number; isFirst?: boolean; isLast?: boolean }) {
  const mine = war.clan.tag === myClanTag ? war.clan : war.opponent;
  const theirs = war.clan.tag === myClanTag ? war.opponent : war.clan;
  const myStars = mine.stars ?? 0;
  const theirStars = theirs.stars ?? 0;
  const ended = war.state === 'warEnded';
  const result = ended
    ? myStars > theirStars
      ? { label: 'W', color: '#4CAF50', bg: 'rgba(76,175,80,0.15)' }
      : theirStars > myStars
        ? { label: 'L', color: '#f44336', bg: 'rgba(244,67,54,0.15)' }
        : { label: 'D', color: Colors.textSecondary, bg: Colors.bgSubtle }
    : null;
  const detail = war.state === 'preparation'
    ? `Starts ${formatDateTime(war.startTime)}`
    : war.state === 'inWar'
      ? `Ends ${formatDateTime(war.endTime)}`
      : `${myStars}★ vs ${theirStars}★`;
  const isPreparation = war.state === 'preparation';
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <PressableRipple
        style={[
          styles.cwlRoundCard,
          isFirst && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
          isLast && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
          expanded && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
        ]}
        onPress={() => setExpanded(e => !e)}
      >
        <View style={[styles.itemIconTile, 
          isFirst && { borderTopLeftRadius: Radius.lg },
          isLast && { borderBottomLeftRadius: Radius.lg },
        ]}>
          {theirs.badgeUrls?.medium ? (
            <Image source={{ uri: theirs.badgeUrls.medium }} style={styles.itemIconImage} />
          ) : (
            <Ionicons name="shield-outline" size={18} color={Colors.textTertiary} />
          )}
        </View>
        <View style={styles.logInfo}>
          <Text style={styles.logClanName} numberOfLines={1}>{theirs.name}</Text>
          <Text style={styles.logDetail} numberOfLines={1}>
            {detail}
            {!isPreparation ? ` · ${mine.attacks ?? 0}/${war.teamSize} attacks` : ''}
          </Text>
        </View>
        <View style={styles.cwlRoundRight}>
          <View style={styles.cwlRoundBadge}>
            <Text style={styles.cwlRoundBadgeText}>R{round}</Text>
          </View>
          {result ? (
            <View style={[styles.logResultBadge, { backgroundColor: result.bg }]}>
              <Text style={[styles.logResultText, { color: result.color }]}>{result.label}</Text>
            </View>
          ) : (
            <View style={[styles.logResultBadge, { backgroundColor: isPreparation ? 'rgba(255,183,77,0.15)' : 'rgba(244,67,54,0.15)' }]}>
              <Ionicons name={isPreparation ? 'hourglass-outline' : 'flame-outline'} size={14} color={isPreparation ? '#FFB74D' : '#f44336'} />
            </View>
          )}
        </View>
      </PressableRipple>
      {expanded && (
        <View style={[styles.cwlRoundDetail, isLast && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl }]}>
          <CurrentWarSection war={war} now={now} isCwl myClanTag={myClanTag} myPlayerTag={myPlayerTag} player={player} embedded />
        </View>
      )}
    </View>
  );
}

function CwlPendingRoundCard({ round, isFirst, isLast }: { round: number; isFirst?: boolean; isLast?: boolean }) {
  return (
    <View
      style={[
        styles.cwlRoundCard,
        { opacity: 0.6 },
        isFirst && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
        isLast && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
      ]}
    >
      <View style={[styles.itemIconTile,
        isFirst && { borderTopLeftRadius: Radius.lg },
        isLast && { borderBottomLeftRadius: Radius.lg },
      ]}>
        <Ionicons name="hourglass-outline" size={18} color={Colors.textTertiary} />
      </View>
      <View style={styles.logInfo}>
        <Text style={styles.logClanName} numberOfLines={1}>Awaiting matchup</Text>
        <Text style={styles.logDetail} numberOfLines={1}>Not started yet</Text>
      </View>
      <View style={styles.cwlRoundRight}>
        <View style={styles.cwlRoundBadge}>
          <Text style={styles.cwlRoundBadgeText}>R{round}</Text>
        </View>
      </View>
    </View>
  );
}

const ATTACK_DOT_COLORS: Record<0 | 1 | 2, string> = {
  0: '#f44336',
  1: '#FFB74D',
  2: '#4CAF50',
};

function shieldConfig(member: WarMember): { name: keyof typeof Ionicons.glyphMap; color: string } | null {
  const attacked = member.opponentAttacks ?? 0;
  if (attacked === 0) return null;
  const conceded = member.bestOpponentAttack?.stars ?? 0;
  const saved = 3 - conceded;
  if (saved >= 3) return { name: 'shield-checkmark', color: '#FFFFFF' };
  if (saved === 2) return { name: 'shield-checkmark-outline', color: '#4CAF50' };
  if (saved === 1) return { name: 'shield-half-outline', color: '#FFB74D' };
  return { name: 'shield-outline', color: '#f44336' };
}

function MemberRow({ member, defenderName, isCwl = false, isMine = false, isFirst, isLast }: { member: WarMember; defenderName: (tag: string) => string; isCwl?: boolean; isMine?: boolean; isFirst?: boolean; isLast?: boolean }) {
  const router = useRouter();
  const attacks = member.attacks ?? [];
  const maxAttacks = isCwl ? 1 : 2;
  const thImg = getTownHallImageSource(member.townhallLevel);
  const [expanded, setExpanded] = useState(false);

  const shield = shieldConfig(member);

  return (
    <View>
      <PressableRipple
        style={[
          styles.memberRow,
          isMine && styles.memberRowMine,
          isFirst && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
          isLast && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
          expanded && {borderBottomLeftRadius: 0, borderBottomRightRadius: 0},
        ]}
        onPress={() => setExpanded(e => !e)}
      >
        <View style={styles.memberLeft}>
          <View style={[styles.memberIconTile, isMine && styles.memberIconTileMine]}>
            {thImg ? (
              <Image source={thImg} style={styles.memberIconImage} resizeMode="contain" />
            ) : (
              <Text style={[styles.thBadgeText, isMine && styles.thBadgeTextMine]}>{member.townhallLevel}</Text>
            )}
          </View>
          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, isMine && styles.memberNameMine]} numberOfLines={1}>{member.name}</Text>
            <View style={styles.memberSubRow}>
              <Text style={[styles.memberPosition, isMine && styles.memberPositionMine]}>#{member.mapPosition}</Text>
              <View style={styles.memberSubDot} />
              <Text style={[styles.memberTh, isMine && styles.memberThMine]}>TH{member.townhallLevel}</Text>
            </View>
          </View>
        </View>
        <View style={styles.memberRight}>
          <Ionicons
            name={shield ? shield.name : 'shield-outline'}
            size={13}
            color={shield ? shield.color : Colors.textTertiary}
          />
          <View style={styles.memberDivider} />
          <View style={styles.attackDots}>
            {Array.from({ length: 2 }).map((_, i) => {
              if (isCwl && i >= maxAttacks) {
                return (
                  <View key={i} style={[styles.attackDot, styles.attackDotDisabled]}>
                    <Ionicons name="close" size={8} color={Colors.textMuted} />
                  </View>
                );
              }
              const attack = attacks[i];
              const dotStyle = attack
                ? attack.stars >= 3
                  ? styles.attackDotBest
                  : { backgroundColor: ATTACK_DOT_COLORS[attack.stars as 0 | 1 | 2] }
                : styles.attackDotEmpty;
              return (
                <View
                  key={i}
                  style={[
                    styles.attackDot,
                    dotStyle,
                  ]}
                />
              );
            })}
          </View>
          <PressableRipple
            style={[styles.memberInspectBtn, isMine && styles.memberInspectBtnDisabled]}
            onPress={() => router.push({ pathname: '/player', params: { tag: member.tag } })}
            hitSlop={6}
            disabled={isMine}
            accessibilityLabel={`Inspect ${member.name}`}
          >
            <Ionicons name="search-outline" size={14} color={isMine ? Colors.border : Colors.textTertiary} />
          </PressableRipple>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.textTertiary} />
        </View>
      </PressableRipple>
      {expanded && (
        <View style={[styles.memberDetail, isLast && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl }]}>
          <View style={[styles.memberDetailHeader, { marginTop: 0 }]}>
            <Ionicons name="flash-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.memberDetailLabel}>Attacks</Text>
          </View>
          {attacks.length === 0 ? (
            <Text style={styles.memberDetailEmpty}>No attacks used yet</Text>
          ) : (
            attacks.map((a, i) => (
              <View key={i} style={styles.memberAttackRow}>
                <View style={styles.memberAttackInfo}>
                  <Text style={styles.memberAttackOrder}>{i + 1}</Text>
                  <Text style={styles.memberAttackTarget} numberOfLines={1}>
                    {defenderName(a.defenderTag) || a.defenderTag}
                  </Text>
                </View>
                <View style={styles.memberAttackStarsRow}>
                  {[1, 2, 3].map((s) => (
                    <Ionicons key={s} name={s <= a.stars ? 'star' : 'star-outline'} size={12} color={s <= a.stars ? Colors.warning : Colors.textTertiary} />
                  ))}
                </View>
                <Text style={styles.memberAttackDestruction}>{a.destructionPercentage}%</Text>
                <Text style={styles.memberAttackDuration}>{a.duration}s</Text>
              </View>
            ))
          )}
          <View style={styles.memberDetailHeader}>
            <Ionicons name="shield-outline" size={12} color={Colors.textTertiary} />
            <Text style={styles.memberDetailLabel}>Defense</Text>
          </View>
          {member.bestOpponentAttack ? (
            <View style={styles.memberAttackRow}>
              <View style={styles.memberAttackInfo}>
                <Text style={styles.memberAttackOrder} />
                <Text style={styles.memberAttackTarget} numberOfLines={1}>
                  {defenderName(member.bestOpponentAttack.attackerTag) || member.bestOpponentAttack.attackerTag}
                </Text>
              </View>
              <View style={styles.memberAttackStarsRow}>
                {[1, 2, 3].map((s) => (
                  <Ionicons key={s} name={s <= member.bestOpponentAttack!.stars ? 'star' : 'star-outline'} size={12} color={s <= member.bestOpponentAttack!.stars ? Colors.warning : Colors.textTertiary} />
                ))}
              </View>
              <Text style={styles.memberAttackDestruction}>{member.bestOpponentAttack.destructionPercentage}%</Text>
              <Text style={styles.memberAttackDuration}>{member.bestOpponentAttack.duration}s</Text>
            </View>
          ) : (
            <Text style={styles.memberDetailEmpty}>
              {member.opponentAttacks ? 'Not attacked yet' : 'Not attacked'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function LegendCard() {
  const [open, setOpen] = useState(false);
  const attackRows: { dot: 'best' | 'empty' | string; label: string }[] = [
    { dot: 'best', label: '3★ attack' },
    { dot: ATTACK_DOT_COLORS[2], label: '2★ attack' },
    { dot: ATTACK_DOT_COLORS[1], label: '1★ attack' },
    { dot: ATTACK_DOT_COLORS[0], label: '0★ attack' },
    { dot: 'empty', label: 'Attack not used' },
  ];
  const shieldRows: { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }[] = [
    { icon: 'shield-checkmark', color: '#FFFFFF', label: 'Perfect defense (0★ taken)' },
    { icon: 'shield-checkmark-outline', color: '#4CAF50', label: '1★ conceded' },
    { icon: 'shield-half-outline', color: '#FFB74D', label: '2★ conceded' },
    { icon: 'shield-outline', color: '#f44336', label: '3★ conceded' },
    { icon: 'shield-outline', color: Colors.textTertiary, label: 'Not attacked' },
  ];

  return (
    <Card compact style={styles.legendCard}>
      <PressableRipple style={styles.planHeader} onPress={() => setOpen(o => !o)}>
        <View style={styles.planHeaderIcon}>
          <Ionicons name="color-palette-outline" size={15} color={Colors.textPrimary} />
        </View>
        <View style={styles.planHeaderText}>
          <Text style={styles.planTitle}>Legend</Text>
          <Text style={styles.planSubtitle}>Member row attack & defense colors</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textMuted} />
      </PressableRipple>

      {open && (
        <View style={styles.legendBody}>
          <View style={styles.legendColumn}>
            <Text style={styles.planSectionLabel}>Attacks</Text>
            {attackRows.map(r => (
              <View key={r.label} style={styles.legendRow}>
                <View style={styles.legendDotSlot}>
                  <View
                    style={[
                      styles.legendDot,
                      r.dot === 'best' && styles.legendDotBest,
                      r.dot === 'empty' && styles.legendDotEmpty,
                      r.dot !== 'best' && r.dot !== 'empty' && { backgroundColor: r.dot },
                    ]}
                  />
                </View>
                <Text style={styles.legendLabel}>{r.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legendColumn}>
            <Text style={styles.planSectionLabel}>Defense</Text>
            {shieldRows.map(r => (
              <View key={r.label} style={styles.legendRow}>
                <View style={styles.legendShieldSlot}>
                  <Ionicons name={r.icon} size={15} color={r.color} />
                </View>
                <Text style={styles.legendLabel}>{r.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

function AttackPlanCard({ plan, preparing = false }: { plan: AttackPlan; preparing?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(true);
  const starsColor = (s: number) => (s >= 2.5 ? '#4CAF50' : s >= 1.5 ? '#FFB74D' : '#f44336');
  const deltaColor = (d: number) => (d > 0 ? '#f44336' : d < 0 ? '#4CAF50' : Colors.textMuted);
  const deltaLabel = (d: number) => (d === 0 ? 'Same TH' : `${d > 0 ? '+' : ''}${d} TH`);
  const tags = (s: AttackSuggestion) => {
    const out: { label: string; color: string; bg: string }[] = [];
    if (s.tag === 'best') out.push({ label: 'Best', color: '#4CAF50', bg: 'rgba(76,175,80,0.15)' });
    if (s.isMirror) out.push({ label: 'Mirror', color: Colors.textSecondary, bg: Colors.bgSubtle });
    if (s.tag === 'cleanup') out.push({ label: 'Cleanup', color: '#4FC3F7', bg: 'rgba(79,195,247,0.15)' });
    if (s.tag === 'risky') out.push({ label: 'Risky', color: '#f44336', bg: 'rgba(244,67,54,0.15)' });
    return out;
  };

  return (
    <Card compact style={styles.planCard}>
      <PressableRipple style={styles.planHeader} onPress={() => setOpen(o => !o)}>
        <View style={styles.planHeaderIcon}>
          <Ionicons name="locate-outline" size={15} color={Colors.textPrimary} />
        </View>
        <View style={styles.planHeaderText}>
          <Text style={styles.planTitle}>Attack Plan</Text>
          <Text style={styles.planSubtitle}>
            TH{plan.myTH} · Offense {Math.round(plan.offense * 100)}% · {preparing
              ? `targets locked in, attacks unlock when war starts`
              : `${plan.attacksLeft}/${plan.maxAttacks} attack${plan.attacksLeft === 1 ? '' : 's'} left`}
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textMuted} />
      </PressableRipple>

      {open && (
        <View style={styles.planBody}>
          {plan.mirror && (
            <View style={styles.planMirror}>
              <View style={styles.planMirrorInfo}>
                <Text style={styles.planMirrorLabel}>Your mirror</Text>
                <Text style={styles.planMirrorName} numberOfLines={1}>{plan.mirror.member.name}</Text>
              </View>
              <View style={styles.planMirrorRight}>
                <Text style={[styles.planDelta, { color: deltaColor(plan.mirror.thDelta) }]}>
                  {deltaLabel(plan.mirror.thDelta)}
                </Text>
                <Text style={[styles.planStars, { color: starsColor(plan.mirror.expectedStars) }]}>
                  {plan.mirror.expectedStars.toFixed(1)}★
                </Text>
              </View>
            </View>
          )}

          <View style={styles.planDivider} />
          <Text style={styles.planSectionLabel}>Best options</Text>
          {plan.suggestions.map((s, i) => (
            <View key={s.member.tag} style={[styles.planRow, i === plan.suggestions.length - 1 && styles.planRowLast]}>
              <View style={styles.planRowLeft}>
                <View style={[styles.planPosBadge, { backgroundColor: colors.bgCardHover }]}>
                  <Text style={styles.planPos}>{s.position}</Text>
                </View>
                <View style={styles.planRowName}>
                  <Text style={styles.planName} numberOfLines={1}>{s.member.name}</Text>
                  <View style={styles.planTagRow}>
                    {tags(s).map(t => (
                      <View key={t.label} style={[styles.planTag, { backgroundColor: t.bg }]}>
                        <Text style={[styles.planTagText, { color: t.color }]}>{t.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <View style={styles.planRowRight}>
                <Text style={[styles.planDelta, { color: deltaColor(s.thDelta) }]}>
                  {deltaLabel(s.thDelta)}
                </Text>
                <Text style={[styles.planStars, { color: starsColor(s.expectedStars) }]}>
                  {s.expectedStars.toFixed(1)}★
                </Text>
              </View>
            </View>
          ))}
          <Text style={styles.planNote}>
            Heuristic based on TH difference and your offense — defense strength isn&apos;t available from the API.
          </Text>
        </View>
      )}
    </Card>
  );
}

function WarLogRow({ entry, isFirst, isLast }: { entry: WarLogEntry; isFirst?: boolean; isLast?: boolean }) {
  const [expanded, setExpanded] = useState(false);


  return (
    <View>
      <PressableRipple
        style={[
          styles.logRow,
          expanded && styles.logRowExpanded,
          (isFirst || expanded) && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
          isLast && !expanded && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
          expanded && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
        ]}
        onPress={() => setExpanded(e => !e)}
      >
        <View style={[styles.itemIconTile,
          (isFirst || expanded) && { borderTopLeftRadius: Radius.lg },
          isLast && !expanded && { borderBottomLeftRadius: Radius.lg },
          expanded && { borderBottomLeftRadius: 0 },
        ]}>
          {entry.opponent.badgeUrls?.medium ? (
            <Image source={{ uri: entry.opponent.badgeUrls.medium }} style={styles.itemIconImage} />
          ) : (
            <Ionicons name="shield-outline" size={18} color={Colors.textTertiary} />
          )}
        </View>
        <View style={styles.logInfo}>
          <Text style={styles.logClanName} numberOfLines={1}>{entry.opponent.name}</Text>
          <Text style={styles.logDetail}>{formatTime(entry.endTime)}</Text>
        </View>
        <Text style={styles.logStars}>
          <Text style={{ color: (entry.clan.stars || 0) > (entry.opponent.stars || 0) ? '#4CAF50' : Colors.textSecondary, fontFamily: clashFontFamily() }}>
            {entry.clan.stars ?? '—'}
          </Text>
          <Text style={{ color: Colors.textMuted, fontFamily: clashFontFamily() }}> - </Text>
          <Text style={{ color: (entry.opponent.stars || 0) > (entry.clan.stars || 0) ? '#f44336' : Colors.textSecondary, fontFamily: clashFontFamily() }}>
            {entry.opponent.stars ?? '—'}
          </Text>
        </Text>
        <WarResultBadge result={entry.result} />
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textTertiary} />
      </PressableRipple>
      {expanded && (
        <View style={[styles.warTable, styles.warTableExpanded, { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl }]}>
          <View style={styles.warTableHeadRow}>
            <View style={styles.warTableHeadBlank} />
            <View style={styles.warTableHeadClan}>
              {entry.clan.badgeUrls?.medium && (
                <Image source={{ uri: entry.clan.badgeUrls.medium }} style={styles.warTableBadge} />
              )}
              <Text style={styles.warTableHead} numberOfLines={1}>{entry.clan.name}</Text>
            </View>
            <View style={styles.warTableHeadClan}>
              {entry.opponent.badgeUrls?.medium && (
                <Image source={{ uri: entry.opponent.badgeUrls.medium }} style={styles.warTableBadge} />
              )}
              <Text style={styles.warTableHead} numberOfLines={1}>{entry.opponent.name}</Text>
            </View>
          </View>
          <View style={[styles.warTableRow, styles.warTableRowAlt]}>
            <View style={styles.warTableLabelWrap}>
              <Ionicons name="star-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.warTableLabel}>Stars</Text>
            </View>
            <Text style={[styles.warTableCell, styles.warTableCellStrong, (entry.clan.stars || 0) > (entry.opponent.stars || 0) && styles.warTableCellWin]}>{entry.clan.stars ?? '—'}</Text>
            <Text style={[styles.warTableCell, styles.warTableCellStrong, (entry.opponent.stars || 0) > (entry.clan.stars || 0) && styles.warTableCellWin]}>{entry.opponent.stars ?? '—'}</Text>
          </View>
          <View style={styles.warTableRow}>
            <View style={styles.warTableLabelWrap}>
              <Ionicons name="flame-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.warTableLabel}>Destruction</Text>
            </View>
            <Text style={styles.warTableCell}>{entry.clan.destructionPercentage?.toFixed(1) ?? '—'}%</Text>
            <Text style={styles.warTableCell}>{entry.opponent.destructionPercentage?.toFixed(1) ?? '—'}%</Text>
          </View>
          <View style={[styles.warTableRow, styles.warTableRowAlt, { borderBottomWidth: 0 }]}>
            <View style={styles.warTableLabelWrap}>
              <Ionicons name="flash-outline" size={11} color={Colors.textMuted} />
              <Text style={styles.warTableLabel}>Attacks</Text>
            </View>
            <Text style={styles.warTableCell}>{entry.clan.attacks ?? '—'}</Text>
            <Text style={styles.warTableCell}>{entry.opponent.attacks ?? '—'}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { ...Typography.largeTitle, color: Colors.textPrimary },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  clanBadgeImg: { width: 28, height: 28 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  errorText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  retryBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.bgSubtle },
  retryText: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  skeletonContent: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, gap: Spacing.sm },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
  },
  skeletonClanCard: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  skeletonGroup: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  skeletonTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  skeletonLabel: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  skeletonList: {
    gap: Spacing.xs,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  emptyText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },

  noWarCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  noWarTitle: { ...Typography.title3, color: Colors.textPrimary },
  noWarSub: { ...Typography.caption, color: Colors.textMuted },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  topTabs: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.md,
  },
  topTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  topTabLeft: {
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
    borderTopRightRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
  },
  topTabRight: {
    borderTopLeftRadius: Radius.sm,
    borderBottomLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.md,
    borderBottomRightRadius: Radius.md,
  },
  topTabActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  topTabText: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  topTabTextActive: {
    color: Colors.bg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  pillText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.bg,
  },
  cwlGroupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  cwlGroupTitle: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  cwlGroupRecord: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 10,
  },
  issueList: { gap: Spacing.sm },
  issueBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: 'rgba(255,204,0,0.08)',
    borderRadius: Radius.sm,
    borderWidth: 0.75,
    borderColor: 'rgba(255,204,0,0.25)',
  },
  issueBannerError: {
    backgroundColor: 'rgba(244,67,54,0.08)',
    borderColor: 'rgba(244,67,54,0.3)',
  },
  issueTitle: { ...Typography.caption, fontWeight: '700' },
  issueMessage: { ...Typography.caption, color: Colors.textSecondary, fontSize: 10, marginTop: 1 },

  warStatusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  statusChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  countdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  countdownText: { ...Typography.caption, color: Colors.textSecondary, fontSize: 10 },

  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    marginTop: Spacing.md,
  },
  resultLabel: { ...Typography.subhead, fontWeight: '700' },
  resultSub: { ...Typography.caption, color: Colors.textSecondary, fontSize: 10, marginTop: 1 },

  errorTitle: { ...Typography.title3, color: Colors.textPrimary, textAlign: 'center', marginTop: Spacing.xs },

  warHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  warClanCard: { flex: 1, alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 0.75, borderColor: Colors.border },
  warClanCardRight: {},
  warClanBadge: { width: 40, height: 40 },
  warClanName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', textAlign: 'center', maxWidth: '100%' },
  warClanLevel: { ...Typography.caption, color: Colors.textMuted },
  vsContainer: { alignItems: 'center', gap: 1, width: 56 },
  vsLabel: { ...Typography.caption, color: Colors.textMuted, fontWeight: '700', fontSize: 9, letterSpacing: 1 },
  vsScore: { ...Typography.title1, color: Colors.textPrimary, lineHeight: 32 },
  vsScoreWin: { color: '#4CAF50' },
  vsScoreOpp: { ...Typography.title1, color: Colors.textMuted, lineHeight: 32 },
  vsScoreOppWin: { color: '#f44336' },
  vsDash: { width: 16, height: 2, borderRadius: 1, backgroundColor: Colors.border },
  vsDashText: { display: 'none' },
  vsTeamSize: { ...Typography.caption, color: Colors.textTertiary, fontSize: 9 },

  warTable: {
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  warTableExpanded: {
    marginTop: 0,
    borderWidth: 0,
    borderRadius: 0,
    marginBottom: Spacing.md,
  },
  warTableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgSubtle,
  },
  warTableRowAlt: {
    backgroundColor: Colors.bgCard,
  },
  warTableHeadRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgSubtle,
  },
  warTableHeadBlank: {
    width: 108,
  },
  warTableHeadClan: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.xs,
  },
  warTableBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  warTableHead: {
    flexShrink: 1,
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 9,
  },
  warTableCell: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textSecondary,
    paddingVertical: 6,
    paddingHorizontal: Spacing.xs,
    textAlign: 'center',
  },
  warTableCellStrong: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '700',
  },
  warTableCellWin: { color: '#4CAF50', fontWeight: '700' },
  warTableLabelWrap: {
    width: 108,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingVertical: 6,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  warTableLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 10,
    flexShrink: 0,
    textAlign: 'left',
  },
  prepText: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', marginTop: Spacing.xs },
  prepSub: { ...Typography.caption, color: Colors.textMuted },

  memberList: { gap: Spacing.xs },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
  },
  memberRowMine: {
    backgroundColor: Colors.textPrimary,
    borderWidth: 0.75,
    borderColor: Colors.bg,
  },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  memberIconTile: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberIconTileMine: {
    backgroundColor: Colors.bg,
  },
  memberIconImage: {
    width: 24,
    height: 24,
  },
  thBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  thBadgeTextMine: { color: Colors.textPrimary },
  memberName: { ...Typography.subhead, color: Colors.textPrimary, flexShrink: 1 },
  memberNameMine: { color: Colors.bg, fontWeight: '700' },
  memberInfo: { flex: 1, gap: 2, minWidth: 0 },
  memberSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberPosition: { ...Typography.caption, color: Colors.textTertiary, fontSize: 11 },
  memberPositionMine: { color: Colors.bg, opacity: 0.75 },
  memberSubDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.border },
  memberTh: { ...Typography.caption, color: Colors.textTertiary, fontSize: 11 },
  memberThMine: { color: Colors.bg, opacity: 0.75 },
  memberRight: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  memberInspectBtn: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInspectBtnDisabled: {
    backgroundColor: 'transparent',
  },
  memberDivider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: Colors.border },
  attackDots: { flexDirection: 'row', gap: 6 },
  attackDot: { width: 10, height: 10, borderRadius: 3 },
  attackDotBest: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  attackDotEmpty: { backgroundColor: Colors.border },
  attackDotDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  memberDetail: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSubtle,
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
  },
  memberDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.sm,
    marginBottom: 3,
  },
  memberDetailLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  memberDetailEmpty: { ...Typography.caption, color: Colors.textMuted, paddingVertical: 2 },
  planCard: { marginTop: Spacing.md },
  legendCard: { marginBottom: Spacing.xs },
  legendBody: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  legendColumn: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  legendDotSlot: { width: 16, alignItems: 'center', justifyContent: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 4 },
  legendDotBest: { backgroundColor: '#FFFFFF' },
  legendDotEmpty: { backgroundColor: Colors.border },
  legendShieldSlot: { width: 16, alignItems: 'center', justifyContent: 'center' },
  legendLabel: { ...Typography.caption, color: Colors.textSecondary, fontSize: 11, flex: 1 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  planHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planHeaderText: { flex: 1 },
  planTitle: { ...Typography.subhead, color: Colors.textPrimary, fontWeight: '700' },
  planSubtitle: { ...Typography.caption, color: Colors.textTertiary, fontSize: 10, marginTop: 1 },
  planBody: { marginTop: Spacing.sm, gap: Spacing.xs },
  planMirror: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  planMirrorInfo: { flex: 1, gap: 1 },
  planMirrorLabel: { ...Typography.caption, color: Colors.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  planMirrorName: { ...Typography.subhead, color: Colors.textPrimary, fontWeight: '600' },
  planMirrorRight: { alignItems: 'flex-end', gap: 2 },
  planDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, marginVertical: Spacing.xs },
  planSectionLabel: { ...Typography.caption, color: Colors.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.xs },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingVertical: Spacing.sm },
  planRowLast: { paddingBottom: 0 },
  planRowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  planPosBadge: { width: 26, height: 26, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  planPos: { ...Typography.caption, color: Colors.textSecondary, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  planRowName: { flex: 1 },
  planName: { ...Typography.subhead, color: Colors.textPrimary, fontWeight: '600' },
  planTagRow: { flexDirection: 'row', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  planTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  planTagText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  planRowRight: { alignItems: 'flex-end', gap: 2 },
  planDelta: { ...Typography.caption, fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  planStars: { ...Typography.subhead, fontWeight: '800', fontVariant: ['tabular-nums'] },
  planNote: { ...Typography.caption, color: Colors.textMuted, fontSize: 9, lineHeight: 13, marginTop: Spacing.xs },
  memberAttackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 3,
  },
  memberAttackInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  memberAttackOrder: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: Colors.bgCardHover,
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 18,
    overflow: 'hidden',
  },
  memberAttackTarget: { ...Typography.caption, color: Colors.textPrimary, flex: 1 },
  memberAttackStarsRow: {
    flexDirection: 'row',
    gap: 2,
    minWidth: 44,
    justifyContent: 'flex-end',
  },
  memberAttackDestruction: { ...Typography.caption, color: Colors.textSecondary, minWidth: 44, textAlign: 'right' },
  memberAttackDuration: { ...Typography.caption, color: Colors.textTertiary, minWidth: 32, textAlign: 'right' },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    marginBottom: 1,
  },
  logRowExpanded: {
    marginBottom: 0,
  },
  itemIconTile: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemIconImage: {
    width: 30,
    height: 30,
  },
  logInfo: { flex: 1, justifyContent: 'space-between', alignSelf: 'stretch', paddingVertical: 1 },
  logClanName: { ...Typography.subhead, color: Colors.textPrimary, fontWeight: '600' },
  logDetail: { ...Typography.footnote, color: Colors.textTertiary },
  logStars: { ...Typography.body, fontWeight: '700' },
  logResultBadge: { width: 28, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  logResultText: { fontSize: 12, fontWeight: '800' },

  cwlSeasonText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: -4,
    marginBottom: Spacing.xs,
  },
  cwlRoundCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
  },
  cwlRoundRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cwlRoundBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cwlRoundBadgeText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '800',
  },
  cwlRoundDetail: {
    backgroundColor: Colors.bgCardHover,
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
    padding: Spacing.md,
    overflow: 'hidden',
  },
});
