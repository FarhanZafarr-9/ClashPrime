import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PageScreen from '../src/components/PageScreen';
import HeaderButton from '../src/components/HeaderButton';
import PressableRipple from '../src/components/PressableRipple';
import { Card } from '../src/components/Card';
import { SettingRow } from '../src/components/SettingRow';
import { ItemCard } from '../src/components/ItemCard';
import CollapsibleContent from '../src/components/CollapsibleContent';
import SegmentedSwitch from '../src/components/SegmentedSwitch';
import { usePlayer } from '../src/hooks/usePlayerContext';
import { useRankedLeagueStats } from '../src/hooks/useRankedLeagueStats';
import { nearbyStandings, rankedNumber as number, rankedRange as range, tournamentStandings, tournamentStatus } from '../src/utils/rankedTournamentView';
import { Radius, Spacing, useTheme } from '../src/theme';
import type { RankedBattleLog } from '../src/types/rankedLeague';
import { getLeagueLootInfo } from '../src/utils/leagueData';
import { rankedMatchupScenario } from '../src/utils/rankedMatchupScenario';
import { Skeleton } from '../src/components/Skeleton';

function useRankedPalette() {
  const { isDark, colors } = useTheme();
  return {
    green: isDark ? '#72C9A7' : '#257356',
    greenBg: isDark ? '#1B3430' : '#E7F3EC',
    amber: isDark ? colors.warning : colors.warningText,
    amberBg: isDark ? 'rgba(212,163,89,0.09)' : 'rgba(138,100,32,0.07)',
    red: colors.dangerText,
    self: colors.accent,
    selfBg: colors.accentSubtle,
  };
}

function Section({ title, description, icon, initiallyOpen = true, isFirst = false, isLast = false, children }: {
  title: string; description: string; icon: string; initiallyOpen?: boolean; isFirst?: boolean; isLast?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const { colors } = useTheme();
  return (
    <View>
      <SettingRow title={title} desc={description} icon={icon} compact isFirst={isFirst} isLast={isLast} expanded={open} onPress={() => setOpen(value => !value)}>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={open ? colors.bgCard : colors.textSecondary} />
      </SettingRow>
      <CollapsibleContent expanded={open}>
        <View style={styles.sectionBody}>{children}</View>
      </CollapsibleContent>
    </View>
  );
}

function DetailRows({ rows }: { rows: { label: string; value: string }[] }) {
  const { colors } = useTheme();
  return <View style={[styles.table, { backgroundColor: colors.bgCard }]}>{rows.map((row, index) => (
    <View key={row.label} style={[styles.detailRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{row.label}</Text>
      <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{row.value}</Text>
    </View>
  ))}</View>;
}

function Metric({ label, value, loading = false }: { label: string; value: string; loading?: boolean }) {
  const { colors } = useTheme();
  return <View style={[styles.metric, { backgroundColor: colors.bgCardHover }]}>
    {loading ? <Skeleton width={68} height={25} /> : <Text style={[styles.metricValue, { color: colors.textPrimary }]} adjustsFontSizeToFit minimumFontScale={0.75} numberOfLines={1}>{value}</Text>}
    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
  </View>;
}

function RankedLoading() {
  const { colors } = useTheme();
  return <View accessibilityLabel="Loading ranked battles and standings" accessibilityState={{ busy: true }} style={styles.loadingGroups}>
    {[2, 3].map((count, group) => <View key={group} style={styles.sectionCluster}>
      {Array.from({ length: count }, (_, index) => <View key={index} style={[
        styles.loadingRow, { backgroundColor: colors.bgCard, borderRadius: Radius.sm },
        index === 0 && { borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
        index === count - 1 && { borderBottomLeftRadius: Radius.xl, borderBottomRightRadius: Radius.xl },
      ]}>
        <Skeleton width={32} height={32} borderRadius={Radius.md} />
        <View style={styles.loadingLabels}><Skeleton width={group === 0 ? 100 : 125} height={13} /><Skeleton width="75%" height={10} /></View>
        <Skeleton width={14} height={14} />
      </View>)}
    </View>)}
  </View>;
}

function battleDate(raw?: string): string {
  if (!raw) return 'Time unavailable';
  const normalized = raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/, '$1-$2-$3T$4:$5:$6$7Z');
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Time unavailable';
}

function BattleLogs({ attacks, defenses }: { attacks: RankedBattleLog[] | null; defenses: RankedBattleLog[] | null }) {
  const [kind, setKind] = useState<'attacks' | 'defenses'>('attacks');
  const { colors } = useTheme();
  const palette = useRankedPalette();
  const attack = kind === 'attacks';
  const outcomeColor = (battle: RankedBattleLog) => {
    if (battle.trophies != null && battle.trophies < 0) return palette.red;
    if (attack) {
      if (battle.stars === 3 || battle.trophies === 40) return palette.green;
      if (battle.stars === 0 || battle.trophies === 0) return palette.red;
    } else {
      // Defense stars describe the attacker: a triple is a poor defense.
      if (battle.stars === 3 || battle.destructionPercentage === 100 || battle.trophies === 0) return palette.red;
      if (battle.stars === 0 || battle.trophies === 40) return palette.green;
    }
    return colors.textSecondary;
  };
  const logs = attack ? attacks : defenses;
  return <View style={styles.logBody}>
    <SegmentedSwitch options={[{ key: 'attacks', label: 'Attacks' + (attacks == null ? '' : ' · ' + attacks.length), icon: 'flash-outline' }, { key: 'defenses', label: 'Defenses' + (defenses == null ? '' : ' · ' + defenses.length), icon: 'shield-outline' }]} value={kind} onChange={setKind} style={styles.logSwitch} />
    {!logs?.length ? <View style={[styles.emptyState, { backgroundColor: colors.bgCard }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.bgCardHover }]}><Ionicons name={attack ? 'flash-outline' : 'shield-outline'} size={25} color={colors.textSecondary} /></View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{logs == null ? (attack ? 'Attack' : 'Defense') + ' logs unavailable' : 'No ' + kind + ' yet'}</Text>
      <Text style={[styles.emptyDescription, { color: colors.textTertiary }]}>{logs == null ? 'This sync did not include battle details.' : 'Completed ' + kind + ' will appear here after a sync.'}</Text>
    </View> : [...logs].reverse().map((battle, index, all) => (
      <ItemCard key={index} variant="plain" name={battle.opponentName || (kind === 'attacks' ? 'Attack' : 'Defense') + ' ' + (all.length - index)}
        iconName={attack ? 'flash-outline' : 'shield-outline'} iconColor={outcomeColor(battle)}
        subtitle={[battle.stars == null ? null : (attack ? '' : 'Attacker ') + battle.stars + '★', battle.destructionPercentage == null ? null : battle.destructionPercentage + '%', battleDate(battle.creationTime)].filter(Boolean).join(' · ')}
        rightValue={battle.trophies == null ? '—' : (battle.trophies > 0 ? '+' : '') + battle.trophies}
        rightValueColor={battle.trophies == null ? colors.textTertiary : outcomeColor(battle)}
        isLast={index === all.length - 1} />
    ))}
  </View>;
}

export default function RankedTournamentScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const palette = useRankedPalette();
  const { player, lastSync, refresh, loading: profileLoading } = usePlayer();
  const ranked = useRankedLeagueStats(player, lastSync);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const stats = ranked.stats;
  const projection = ranked.projection;
  const rules = ranked.rules;
  const loading = ranked.status === 'loading' || (profileLoading && !player);
  const league = player?.leagueTier ?? player?.league;
  const leagueInfo = useMemo(() => getLeagueLootInfo(league?.name, player?.townHallLevel ?? 0), [league?.name, player?.townHallLevel]);
  const floorTH = leagueInfo?.floorTownHall;
  const belowFloor = player != null && floorTH != null && player.townHallLevel < floorTH;
  const toughCount = belowFloor ? 2 : 1;
  const matchup = projection ? rankedMatchupScenario(projection, stats?.trophies ?? null, toughCount, 20) : null;
  const standings = useMemo(() => stats ? tournamentStandings(stats, player?.tag ?? '', rules?.mode === 'weekly' ? rules.battles : null, projection?.promotionSlots ?? null, projection?.demotionSlots ?? null) : [], [stats, player?.tag, rules, projection]);
  const shown = showAll ? standings : nearbyStandings(standings, projection?.promotionSlots ?? null);
  const reloadRanked = ranked.reload;
  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const updated = await refresh();
      if (!updated) reloadRanked();
    } finally { setRefreshing(false); }
  }, [refreshing, refresh, reloadRanked]);
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)');
  const supported = !!projection?.supported;
  const positive = projection?.outlook === 'secured' || projection?.currentZone === 'above-band';
  const status = ranked.status !== 'ready' ? ranked.message : tournamentStatus(projection);
  const winsLosses = (wins: number | null | undefined, losses: number | null | undefined) => number(wins) + 'W · ' + number(losses) + 'L';

  return <PageScreen title="Ranked" subtitle={[league?.name, player?.name].filter(Boolean).join(' · ') || 'Your ranked standings'} tabBar={false}
    contentContainerStyle={styles.content}
    actions={[
      <HeaderButton key="back" onPress={goBack} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={21} color={colors.textSecondary} /></HeaderButton>,
      <HeaderButton key="refresh" onPress={() => { void onRefresh(); }} loading={refreshing || ranked.status === 'loading'} accessibilityLabel="Refresh ranked"><Ionicons name="refresh-outline" size={20} color={colors.textSecondary} /></HeaderButton>,
    ]}
    scrollProps={{ refreshControl: <RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} colors={[colors.bgCard]} progressBackgroundColor={colors.textPrimary} tintColor={colors.textPrimary} /> }}>
    <Card compact style={styles.overview}>
      <View style={styles.overviewHeading}>
        <View style={[styles.badgeBox, { backgroundColor: colors.bgCardHover }]}>{league?.iconUrls?.small ? <Image source={{ uri: league.iconUrls.small }} style={styles.leagueBadge} resizeMode="contain" /> : <Ionicons name="ribbon-outline" size={25} color={colors.textSecondary} />}</View>
        <View style={styles.grow}>
          <Text style={[styles.leagueName, { color: colors.textPrimary }]}>{league?.name ?? 'Ranked league'}</Text>
          <Text style={[styles.caption, { color: colors.textTertiary }]}>{player?.currentLeagueSeasonId == null ? loading ? 'Loading ranked data…' : 'No active ranked group' : 'Season ' + player.currentLeagueSeasonId}</Text>
          {ranked.updatedAt && <Text style={[styles.caption, { color: colors.textTertiary }]}>Updated {new Date(ranked.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>}
        </View>
        {ranked.status === 'loading' && <ActivityIndicator size="small" color={colors.textSecondary} />}
      </View>
      <View style={styles.metrics}>
        <Metric label="Ranked trophies" value={number(stats?.trophies)} loading={loading} />
        <Metric label={stats?.positionIsOfficial ? 'Group rank' : 'Trophy place'} value={stats?.position == null ? '—' : stats.position + ' / ' + stats.groupSize} loading={loading} />
      </View>
      {(loading || stats) &&
      <View style={[styles.status, { backgroundColor: positive ? palette.greenBg : ranked.status === 'ready' ? palette.amberBg : colors.bgCardHover }]}>
        {loading ? <><Skeleton width="70%" height={14} /><Skeleton width="90%" height={10} /></> : <Text style={[styles.statusText, { color: positive ? palette.green : ranked.status === 'ready' ? palette.amber : colors.textSecondary }]}>{status}</Text>}
        {projection?.cutoff && <Text style={[styles.caption, { color: colors.textSecondary }]}>Current promotion line: {range(projection.cutoff)} trophies · top {range(projection.promotionSlots)}</Text>}
      </View>}
    </Card>

    {loading ? <RankedLoading /> : !stats ? <View style={[styles.emptyState, { backgroundColor: colors.bgCard }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.bgCardHover }]}><Ionicons name={ranked.status === 'error' ? 'cloud-offline-outline' : 'podium-outline'} size={25} color={colors.textSecondary} /></View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{ranked.status === 'error' ? 'Couldn’t load ranked data' : 'No ranked group available'}</Text>
      <Text style={[styles.emptyDescription, { color: colors.textTertiary }]}>{ranked.status === 'error' ? 'Check your connection and try again.' : player?.currentLeagueGroupTag && player.currentLeagueSeasonId != null ? 'Your player isn’t listed in the current group yet. Refresh to check again.' : 'Sync your profile after joining Ranked to see battles, standings and forecasts.'}</Text>
      <PressableRipple onPress={() => { void onRefresh(); }} style={[styles.button, styles.emptyAction, { borderColor: colors.border }]} accessibilityRole="button"><Text style={[styles.buttonText, { color: colors.textPrimary }]}>{ranked.status === 'error' ? 'Try again' : 'Refresh profile'}</Text></PressableRipple>
    </View> : <>
      <View style={styles.sectionCluster}>
      <Section title="Battle record" description={rules?.mode === 'weekly' ? number(rules.battles) + ' attacks and defenses per tournament' : 'Completed results from this group'} icon="shield-half-outline" isFirst>
        <View style={[styles.table, { backgroundColor: colors.bgCard }]}>
          <View style={[styles.battleRow, { backgroundColor: colors.bgCardHover }]}>{['Battle', 'Completed', 'Left', 'Avg trophies'].map(label => <Text key={label} style={[styles.battleCell, styles.columnHeading, { color: colors.textSecondary }]}>{label}</Text>)}</View>
          {[
            { name: 'Attacks', done: projection?.attacksDone, left: projection?.attacksLeft, average: projection?.attackAverage, wins: stats.attackWins, losses: stats.attackLosses },
            { name: 'Defenses', done: projection?.defensesDone, left: projection?.defensesLeft, average: projection?.defenseAverage, wins: stats.defenseWins, losses: stats.defenseLosses },
          ].map(row => <View key={row.name} style={[styles.battleRow, { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <Text style={[styles.battleCell, styles.cell, { color: colors.textSecondary }]}>{row.name}</Text>
            <View style={styles.battleCell}><Text style={[styles.center, styles.cell, { color: colors.textPrimary }]}>{number(row.done)}</Text><Text style={[styles.center, styles.small, { color: colors.textTertiary }]}>{winsLosses(row.wins, row.losses)}</Text></View>
            <Text style={[styles.battleCell, styles.cell, { color: colors.textPrimary }]}>{number(row.left)}</Text>
            <Text style={[styles.battleCell, styles.cell, { color: colors.textPrimary }]}>{number(row.average)}</Text>
          </View>)}
        </View>
      </Section>
      <Section title="Battle logs" description="Completed attacks and defenses" icon="list-outline" initiallyOpen={false} isLast>
        <BattleLogs attacks={stats.attackLogs} defenses={stats.defenseLogs} />
      </Section>
      </View>

      <View style={styles.sectionCluster}>
      <Section title="Group standings" description={standings.length + ' players · ' + (showAll ? 'Full group' : 'Your position and the promotion line')} icon="podium-outline" isFirst>
        <View style={[styles.table, { backgroundColor: colors.bgCard }]}>
          <View style={styles.tableLegend}>
            {projection?.promotionSlots && <Text style={[styles.caption, { color: palette.green }]}>Promotion: top {range(projection.promotionSlots)}</Text>}
            {projection?.demotionSlots && <Text style={[styles.caption, { color: palette.amber }]}>Demotion: bottom {range(projection.demotionSlots)}</Text>}
          </View>
          <View style={[styles.standingRow, { backgroundColor: colors.bgCardHover }]}>
            <Text style={[styles.placeCell, styles.columnHeading, { color: colors.textSecondary }]}>{standings[0]?.official ? 'Rank' : 'Place'}</Text>
            <Text style={[styles.nameCell, styles.columnHeading, { color: colors.textSecondary }]}>Player</Text>
            <Text style={[styles.scoreCell, styles.columnHeading, { color: colors.textSecondary }]}>Trophies</Text>
            <Text style={[styles.attacksCell, styles.columnHeading, { color: colors.textSecondary }]}>Atk left</Text>
          </View>
          {shown.map((row, index) => <React.Fragment key={row.member.playerTag + ':' + row.index}>
            {row.index > (index === 0 ? -1 : shown[index - 1].index) + 1 && <Text style={[styles.skipped, { color: colors.textTertiary }]}>{row.index - (index === 0 ? -1 : shown[index - 1].index) - 1} other players</Text>}
            <View accessibilityLabel={(row.self ? 'You. ' : '') + (row.member.playerName ?? row.member.playerTag) + '. ' + number(row.member.leagueTrophies) + ' trophies.'} style={[
              styles.standingRow,
              { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: row.self ? palette.selfBg : row.zone === 'promotion' ? palette.greenBg : row.zone === 'uncertain' || row.zone === 'demotion' ? palette.amberBg : colors.bgCard },
              row.self && { borderLeftWidth: 3, borderLeftColor: palette.self },
            ]}>
              <Text style={[styles.placeCell, styles.cell, { color: colors.textSecondary }]}>{number(row.position)}</Text>
              <View style={styles.nameCell}>
                <Text style={[styles.playerName, { color: row.self ? palette.self : colors.textPrimary }]} numberOfLines={1}>{row.member.playerName ?? row.member.playerTag}</Text>
                {row.self && <Text style={[styles.small, { color: palette.self }]}>You</Text>}
              </View>
              <Text style={[styles.scoreCell, styles.cell, { color: colors.textPrimary }]}>{number(row.member.leagueTrophies)}</Text>
              <Text style={[styles.attacksCell, styles.cell, { color: colors.textSecondary }]}>{number(row.attacksLeft)}</Text>
            </View>
          </React.Fragment>)}
          {!showAll && shown.length > 0 && shown[shown.length - 1].index < standings.length - 1 && <Text style={[styles.skipped, { color: colors.textTertiary }]}>{standings.length - shown[shown.length - 1].index - 1} other players</Text>}
          {standings.length > shown.length || showAll ? <PressableRipple onPress={() => setShowAll(value => !value)} style={[styles.tableButton, { borderTopColor: colors.border }]}><Text style={[styles.buttonText, { color: colors.textPrimary }]}>{showAll ? 'Show nearby players' : 'Show full group (' + standings.length + ')'}</Text></PressableRipple> : null}
        </View>
        {projection?.promotionSlots && projection.promotionSlots.min !== projection.promotionSlots.max && <Text style={[styles.note, { color: colors.textTertiary }]}>Amber marks the cutoff band and demotion places.</Text>}
      </Section>
      <Section title="Forecast" description={supported ? 'Scenarios against the current group scores' : 'Projection data unavailable'} icon="analytics-outline">
        {supported && projection ? <>
          <View style={styles.metrics}>
            <Metric label="Cautious scenario" value={number(matchup?.total)} />
            <Metric label="Current pace" value={number(projection.projectedTotal)} />
            <Metric label="All 3★" value={number(projection.threeStarTotal)} />
          </View>
          <DetailRows rows={[
            { label: 'Town Hall / league bracket', value: 'TH ' + (player?.townHallLevel ?? '—') + ' / ' + (floorTH == null ? '—' : 'TH ' + floorTH) },
            { label: 'Defense fill', value: projection.expectedDefenseGain == null ? '—' : '+' + number(projection.expectedDefenseGain) },
            { label: 'To clear current line', value: number(projection.trophiesToClear) + (projection.trophiesToClear == null ? '' : ' trophies') },
            { label: '3★ hits needed (best case)', value: projection.triplesToClear == null ? '—' : projection.triplesToClear + ' / ' + number(projection.attacksLeft) + ' left' },
          ]} />
          <Text style={[styles.note, { color: colors.textTertiary }]}>Scenarios, not guarantees. The promotion line can rise.</Text>
          {projection.projectedTotal == null && <Text style={[styles.note, { color: palette.amber }]}>{projection.expectedDefenseGain == null ? 'Forecast needs complete logs and a matching score.' : 'Play an attack to establish your pace.'}</Text>}
        </> : <Text style={[styles.note, { color: colors.textTertiary }]}>{projection?.notes[0] ?? 'Complete ranked battle data is needed before a forecast can be calculated.'}</Text>}
      </Section>
      <Section title="How it’s calculated" description="Scoring, data and forecast assumptions" icon="information-circle-outline" initiallyOpen={false} isLast>
        <DetailRows rows={[
          { label: 'Places', value: stats.positionIsOfficial ? 'Official rank' : 'Trophy order · ties share a place' },
          ...(projection?.promotionSlots ? [{ label: 'Promotion target', value: 'Top ' + range(projection.promotionSlots) + ' · beat tied scores' }] : []),
          ...(supported ? [
            { label: '3★ attack', value: '40 trophies' },
            { label: 'Cautious scenario', value: Math.min(toughCount, projection?.attacksLeft ?? toughCount) + ' tougher attacks · ≤20 each' },
            { label: 'TH adjustment', value: belowFloor ? 'Below bracket · allow 2 tough attacks' : 'Allow 1 tough attack' },
            { label: 'Other attacks', value: 'Your observed average' },
            { label: 'Defense fill', value: 'Observed average × defenses left' },
            { label: 'Theoretical ceiling', value: number(projection?.maximumTotal) + ' · 40 per remaining battle' },
            { label: 'Possible finish', value: projection?.bestPlace == null ? '—' : number(projection.bestPlace) + '–' + number(projection.worstPlace) },
          ] : []),
          { label: 'League floor', value: 'Demotion bracket, not opponent TH' },
          { label: 'Matchup odds', value: 'Unknown · cautious case is assumed' },
          { label: 'Missing data', value: 'Shown as —, never zero' },
        ]} />
        <View style={styles.sectionBody}>
          <PressableRipple style={[styles.button, styles.sourceButton, { borderColor: colors.border }]} onPress={() => Linking.openURL('https://support.supercell.com/clash-of-clans/en/articles/ranked-leagues-4.html')}><Text style={[styles.buttonText, { color: colors.textPrimary }]}>Supercell ranked league rules ↗</Text></PressableRipple>
        </View>
      </Section>
      </View>
    </>}
  </PageScreen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.base, paddingTop: Spacing.xs, gap: Spacing.base },
  overview: { marginBottom: 0, borderWidth: 0, borderRadius: Radius.lg, gap: Spacing.md },
  overviewHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badgeBox: { width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  leagueBadge: { width: 34, height: 34 },
  leagueName: { fontSize: 19, fontWeight: '700' },
  caption: { fontSize: 11, lineHeight: 16 },
  grow: { flex: 1, minWidth: 0 },
  metrics: { flexDirection: 'row', gap: Spacing.xs },
  metric: { flex: 1, minWidth: 0, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md, gap: 5, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 20, lineHeight: 25, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
  status: { borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  statusText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  sectionCluster: { gap: Spacing.xs },
  loadingGroups: { gap: Spacing.base },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base, padding: Spacing.md, minHeight: 64 },
  loadingLabels: { flex: 1, gap: Spacing.sm },
  sectionBody: { paddingTop: Spacing.xs, gap: Spacing.sm },
  table: { borderRadius: Radius.md, overflow: 'hidden' },
  tableLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.sm, paddingVertical: 10, minHeight: 37 },
  placeCell: { width: 33, textAlign: 'center' },
  nameCell: { flex: 1.3, minWidth: 0 },
  scoreCell: { flex: 1, minWidth: 57, textAlign: 'right' },
  attacksCell: { flex: 1, minWidth: 43, textAlign: 'right' },
  columnHeading: { fontSize: 10, fontWeight: '600' },
  cell: { fontSize: 12, fontVariant: ['tabular-nums'] },
  playerName: { fontSize: 12, fontWeight: '600' },
  small: { fontSize: 9, lineHeight: 14 },
  skipped: { fontSize: 10, textAlign: 'center', paddingVertical: Spacing.sm },
  tableButton: { paddingVertical: Spacing.md, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  battleRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md },
  battleCell: { flex: 1, textAlign: 'center' },
  center: { textAlign: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 10 },
  detailLabel: { flex: 1.2, fontSize: 11, lineHeight: 16 },
  detailValue: { flex: 1, fontSize: 12, fontWeight: '600', textAlign: 'right', fontVariant: ['tabular-nums'] },
  note: { fontSize: 11, lineHeight: 17, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  emptyState: { alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 28, borderRadius: Radius.md, gap: Spacing.sm },
  emptyIcon: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptyDescription: { fontSize: 11, lineHeight: 16, textAlign: 'center', maxWidth: 240 },
  emptyAction: { minHeight: 44, justifyContent: 'center', marginTop: Spacing.sm },
  button: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  buttonText: { fontSize: 12, fontWeight: '600' },
  logBody: { gap: Spacing.sm },
  logSwitch: { alignSelf: 'center' },
  sourceButton: { minHeight: 48, justifyContent: 'center', paddingVertical: Spacing.md },
});
