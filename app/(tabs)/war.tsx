import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { ClashAPI } from '../../src/api/clash';
import { getApiToken } from '../../src/hooks/usePlayer';
import type { ClanWar, WarLogEntry, WarClanDetail, WarMember } from '../../src/types/clash';
import { Card } from '../../src/components/Card';
import { getTownHallImageUrl } from '../../src/utils/thImages';

interface WarScreenData {
  currentWar: ClanWar | null;
  warLog: WarLogEntry[];
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

function WarResultBadge({ result }: { result: string }) {
  const config = {
    win: { label: 'W', color: '#4CAF50', bg: 'rgba(76,175,80,0.15)' },
    lose: { label: 'L', color: '#f44336', bg: 'rgba(244,67,54,0.15)' },
    draw: { label: 'D', color: Colors.textMuted, bg: Colors.bgSubtle },
  }[result] || { label: '—', color: Colors.textMuted, bg: Colors.bgSubtle };
  return (
    <View style={[styles.resultBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.resultBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

function WarScreenSkeleton() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.skelBlock} />
      </View>
      <View style={styles.scrollContent}>
        {[1, 2].map((i) => (
          <View key={i} style={styles.skelCard}>
            <View style={styles.skelRow}>
              <View style={styles.skelCircle} />
              <View style={styles.skelLine} />
            </View>
            <View style={styles.skelBar} />
            <View style={styles.skelBarShort} />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function WarScreen() {
  const { player } = usePlayer();
  const [data, setData] = useState<WarScreenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [warLogView, setWarLogView] = useState<'regular' | 'cwl'>('regular');

  const clanTag = player?.clan?.tag ?? null;

  const regularWars = (data?.warLog || []).filter(e => e.attacksPerMember === 2);
  const cwlWars = (data?.warLog || []).filter(e => e.attacksPerMember === 1);

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

  const loadWarData = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);
      setFetchErrors([]);
      const token = await getApiToken();
      if (!token) {
        setError('API token not configured. Go to Settings.');
        return;
      }
      if (!clanTag) {
        setError('No clan linked. Add a player tag in Settings who is in a clan.');
        return;
      }
      const api = new ClashAPI(token);
      const [currentWarRes, warLogRes] = await Promise.allSettled([
        api.getCurrentWar(clanTag),
        api.getWarLog(clanTag),
      ]);

      let currentWar: ClanWar | null = null;
      if (currentWarRes.status === 'fulfilled') {
        if (currentWarRes.value.state !== 'notInWar') currentWar = currentWarRes.value;
      }
      if (currentWarRes.status === 'rejected') {
        setFetchErrors(prev => [...prev, `Current war: ${currentWarRes.reason?.message || 'unknown error'}`]);
      }

      let warLog: WarLogEntry[] = [];
      if (warLogRes.status === 'fulfilled') {
        warLog = warLogRes.value.items || [];
      } else {
        setFetchErrors(prev => [...prev, `War history: ${warLogRes.reason?.message || 'unknown error'}`]);
      }

      const cwlGroup = await api.getCwlLeagueGroup(clanTag).catch(() => null);
      console.log('CWL league group:', JSON.stringify(cwlGroup, null, 2).slice(0, 5000));

      setData({ currentWar, warLog });
    } catch (e: any) {
      setError(e?.message || 'Failed to load war data');
    }
  }, [clanTag]);

  useEffect(() => {
    (async () => {
      await loadWarData();
      setLoading(false);
    })();
  }, [loadWarData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWarData(true);
    setRefreshing(false);
  }, [loadWarData]);

  if (loading) return <WarScreenSkeleton />;

  if (error && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>War</Text>
          </View>
          <Text style={styles.subtitle}>Current war & history</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
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
        {data?.currentWar ? (
          <CurrentWarSection war={data.currentWar} />
        ) : (
          <Card style={styles.noWarCard}>
            <Ionicons name="flag-outline" size={32} color={Colors.textTertiary} />
            <Text style={styles.noWarTitle}>No Active War</Text>
            <Text style={styles.noWarSub}>Your clan is currently not in a war</Text>
          </Card>
        )}

        {fetchErrors.length > 0 && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={14} color={Colors.warning} />
            <View style={{ flex: 1 }}>
              {fetchErrors.map((msg, i) => (
                <Text key={i} style={styles.warningText}>{msg}</Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.sectionTitle}>War History</Text>
        </View>

        <View style={styles.pillRow}>
          <Pressable
            style={[styles.pill, warLogView === 'regular' && styles.pillActive]}
            onPress={() => setWarLogView('regular')}
          >
            <Ionicons name="shield-outline" size={14} color={warLogView === 'regular' ? Colors.bg : Colors.textSecondary} />
            <Text style={[styles.pillText, warLogView === 'regular' && styles.pillTextActive]}>Regular</Text>
          </Pressable>
          <Pressable
            style={[styles.pill, warLogView === 'cwl' && styles.pillActive]}
            onPress={() => setWarLogView('cwl')}
          >
            <Ionicons name="flash-outline" size={14} color={warLogView === 'cwl' ? Colors.bg : Colors.textSecondary} />
            <Text style={[styles.pillText, warLogView === 'cwl' && styles.pillTextActive]}>CWL</Text>
          </Pressable>
        </View>

        {warLogView === 'regular' ? (
          regularWars.length > 0 ? (
            regularWars.map((entry, i) => (
              <WarLogRow key={i} entry={entry} />
            ))
          ) : (
            <Card style={styles.noWarCard}>
              <Ionicons name="document-text-outline" size={24} color={Colors.textTertiary} />
              <Text style={styles.noWarTitle}>No Regular Wars</Text>
              <Text style={styles.noWarSub}>No regular war history found</Text>
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
                  <WarLogRow key={i} entry={entry} />
                ))}
              </View>
            ))
          ) : (
            <Card style={styles.noWarCard}>
              <Ionicons name="document-text-outline" size={24} color={Colors.textTertiary} />
              <Text style={styles.noWarTitle}>No CWL Wars</Text>
              <Text style={styles.noWarSub}>No CWL war history found</Text>
            </Card>
          )
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function CurrentWarSection({ war }: { war: ClanWar }) {
  const isPreparation = war.state === 'preparation';
  const isWarEnded = war.state === 'warEnded';

  return (
    <View>
      <View style={styles.warHeader}>
        <WarClanCard clan={war.clan} align="left" />
        <View style={styles.vsContainer}>
          <Text style={styles.vsLabel}>VS</Text>
          {!isPreparation && (
            <Text style={styles.vsScore}>{war.clan.stars}</Text>
          )}
          <View style={styles.vsDash}>
            <Text style={styles.vsDashText}>—</Text>
          </View>
          {!isPreparation && (
            <Text style={styles.vsScoreOpp}>{war.opponent.stars}</Text>
          )}
          <Text style={styles.vsTeamSize}>{war.teamSize}v{war.teamSize}</Text>
        </View>
        <WarClanCard clan={war.opponent} align="right" />
      </View>

      {!isPreparation && (
        <View style={styles.warTable}>
          <View style={styles.warTableRow}>
            <Text style={[styles.warTableHead, { width: 76, flex: 0 }]} />
            <Text style={[styles.warTableCell, styles.warTableHead]}>{war.clan.name}</Text>
            <Text style={[styles.warTableCell, styles.warTableHead]}>{war.opponent.name}</Text>
          </View>
          <View style={[styles.warTableRow, styles.warTableRowAlt]}>
            <Text style={styles.warTableLabel}>Stars</Text>
            <Text style={[styles.warTableCell, (war.clan.stars || 0) > (war.opponent.stars || 0) && styles.warTableCellWin]}>{war.clan.stars}</Text>
            <Text style={[styles.warTableCell, (war.opponent.stars || 0) > (war.clan.stars || 0) && styles.warTableCellWin]}>{war.opponent.stars}</Text>
          </View>
          <View style={styles.warTableRow}>
            <Text style={styles.warTableLabel}>Destruction</Text>
            <Text style={styles.warTableCell}>{war.clan.destructionPercentage.toFixed(1)}%</Text>
            <Text style={styles.warTableCell}>{war.opponent.destructionPercentage.toFixed(1)}%</Text>
          </View>
          <View style={[styles.warTableRow, styles.warTableRowAlt, { borderBottomWidth: 0 }]}>
            <Text style={styles.warTableLabel}>Attacks</Text>
            <Text style={styles.warTableCell}>{war.clan.attacks}/{war.teamSize * 2}</Text>
            <Text style={styles.warTableCell}>{war.opponent.attacks}/{war.teamSize * 2}</Text>
          </View>
        </View>
      )}

      {isPreparation && (
        <Card>
          <View style={styles.center}>
            <Ionicons name="time-outline" size={24} color={Colors.textTertiary} />
            <Text style={styles.prepText}>Preparation Day</Text>
            <Text style={styles.prepSub}>War starts {formatTime(war.startTime)}</Text>
          </View>
        </Card>
      )}

      {!isPreparation && (
        <View style={styles.sectionHeader}>
          <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.sectionTitle}>Members</Text>
        </View>
      )}

      {!isPreparation && (
        <View style={styles.memberList}>
          {war.clan.members.map((m, i) => (
            <MemberRow key={m.tag} member={m} />
          ))}
        </View>
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

function MemberRow({ member }: { member: WarMember }) {
  const attacksUsed = member.attacks || 0;
  const maxAttacks = 2;
  const thImg = getTownHallImageUrl(member.townhallLevel);

  return (
    <View style={styles.memberRow}>
      <View style={styles.memberLeft}>
        {thImg ? (
          <Image source={{ uri: thImg }} style={styles.thBadge} resizeMode="contain" />
        ) : (
          <View style={styles.thBadge}>
            <Text style={styles.thBadgeText}>{member.townhallLevel}</Text>
          </View>
        )}
        <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
      </View>
      <View style={styles.memberRight}>
        {Array.from({ length: maxAttacks }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.attackDot,
              i < attacksUsed ? styles.attackDotUsed : styles.attackDotEmpty,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function WarLogRow({ entry }: { entry: WarLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View>
      <Pressable style={styles.logRow} onPress={() => setExpanded(e => !e)}>
        <WarResultBadge result={entry.result} />
        {entry.opponent.badgeUrls?.medium && (
          <Image source={{ uri: entry.opponent.badgeUrls.medium }} style={styles.logBadge} />
        )}
        <View style={styles.logInfo}>
          <Text style={styles.logClanName} numberOfLines={1}>{entry.opponent.name}</Text>
          <Text style={styles.logDetail}>{formatTime(entry.endTime)}</Text>
        </View>
        <Text style={styles.logStars}>
          <Text style={{ color: (entry.clan.stars || 0) > (entry.opponent.stars || 0) ? '#4CAF50' : Colors.textSecondary }}>
            {entry.clan.stars ?? '—'}
          </Text>
          <Text style={{ color: Colors.textMuted }}> - </Text>
          <Text style={{ color: (entry.opponent.stars || 0) > (entry.clan.stars || 0) ? '#f44336' : Colors.textSecondary }}>
            {entry.opponent.stars ?? '—'}
          </Text>
        </Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textTertiary} />
      </Pressable>
      {expanded && (
        <View style={styles.warTable}>
          <View style={styles.warTableRow}>
            <Text style={[styles.warTableHead, { width: 76, flex: 0 }]} />
            <Text style={[styles.warTableCell, styles.warTableHead]}>{entry.clan.name}</Text>
            <Text style={[styles.warTableCell, styles.warTableHead]}>{entry.opponent.name}</Text>
          </View>
          <View style={[styles.warTableRow, styles.warTableRowAlt]}>
            <Text style={styles.warTableLabel}>Stars</Text>
            <Text style={[styles.warTableCell, (entry.clan.stars || 0) > (entry.opponent.stars || 0) && styles.warTableCellWin]}>{entry.clan.stars ?? '—'}</Text>
            <Text style={[styles.warTableCell, (entry.opponent.stars || 0) > (entry.clan.stars || 0) && styles.warTableCellWin]}>{entry.opponent.stars ?? '—'}</Text>
          </View>
          <View style={styles.warTableRow}>
            <Text style={styles.warTableLabel}>Destruction</Text>
            <Text style={styles.warTableCell}>{entry.clan.destructionPercentage?.toFixed(1) ?? '—'}%</Text>
            <Text style={styles.warTableCell}>{entry.opponent.destructionPercentage?.toFixed(1) ?? '—'}%</Text>
          </View>
          <View style={[styles.warTableRow, styles.warTableRowAlt, { borderBottomWidth: 0 }]}>
            <Text style={styles.warTableLabel}>Attacks</Text>
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
  scrollContent: { padding: Spacing.lg, gap: Spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  errorText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center' },
  retryBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.full, backgroundColor: Colors.bgSubtle },
  retryText: { ...Typography.caption, color: Colors.textPrimary, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyText: { ...Typography.body, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg },

  noWarCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  noWarTitle: { ...Typography.title3, color: Colors.textPrimary },
  noWarSub: { ...Typography.caption, color: Colors.textMuted },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: 'rgba(255,204,0,0.08)',
    borderRadius: Radius.sm,
    borderWidth: 0.75,
    borderColor: 'rgba(255,204,0,0.2)',
  },
  warningText: { ...Typography.caption, color: Colors.warning, fontSize: 10 },

  warHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  warClanCard: { flex: 1, alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.bgCard, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 0.75, borderColor: Colors.border },
  warClanCardRight: {},
  warClanBadge: { width: 40, height: 40 },
  warClanName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600', textAlign: 'center', maxWidth: '100%' },
  warClanLevel: { ...Typography.caption, color: Colors.textMuted },
  vsContainer: { alignItems: 'center', gap: 1, width: 56 },
  vsLabel: { ...Typography.caption, color: Colors.textMuted, fontWeight: '700', fontSize: 9, letterSpacing: 1 },
  vsScore: { ...Typography.title1, color: Colors.textPrimary, lineHeight: 32 },
  vsScoreOpp: { ...Typography.title1, color: Colors.textMuted, lineHeight: 32 },
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
  warTableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgSubtle,
  },
  warTableRowAlt: {
    backgroundColor: Colors.bgCard,
  },
  warTableHead: {
    flex: 1,
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '600',
    paddingVertical: 6,
    paddingHorizontal: Spacing.xs,
    textAlign: 'center',
    backgroundColor: Colors.bgSubtle,
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
  warTableCellWin: { color: '#4CAF50', fontWeight: '700' },
  warTableLabel: {
    width: 82,
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 10,
    paddingVertical: 6,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    textAlign: 'left',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
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
    borderWidth: 0.75,
    borderColor: Colors.border
  },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  thBadge: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary },
  memberName: { ...Typography.subhead, color: Colors.textPrimary, flex: 1 },
  memberRight: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  attackDot: { width: 10, height: 10, borderRadius: 3 },
  attackDotUsed: { backgroundColor: '#4CAF50' },
  attackDotEmpty: { backgroundColor: Colors.border },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    borderWidth: 0.75,
    borderColor: Colors.border
  },
  logBadge: { width: 28, height: 28, borderRadius: 14 },
  logInfo: { flex: 1, gap: 1 },
  logClanName: { ...Typography.body, color: Colors.textPrimary, fontWeight: '600' },
  logDetail: { ...Typography.caption, color: Colors.textMuted, fontSize: 10 },
  logStars: { ...Typography.body, fontWeight: '700' },
  resultBadge: { width: 28, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  resultBadgeText: { fontSize: 12, fontWeight: '800' },

  skelBlock: { width: 120, height: 24, borderRadius: Radius.sm, backgroundColor: Colors.bgSubtle },
  skelCard: { padding: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.bgSubtle, gap: Spacing.md },
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  skelCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.border },
  skelLine: { flex: 1, height: 16, borderRadius: 8, backgroundColor: Colors.border },
  skelBar: { height: 14, borderRadius: 7, backgroundColor: Colors.border, width: '80%' },
  skelBarShort: { height: 14, borderRadius: 7, backgroundColor: Colors.border, width: '55%' },
});
