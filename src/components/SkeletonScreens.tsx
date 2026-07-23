import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Skeleton } from './Skeleton';
import { Colors, Spacing, Radius, useTheme } from '../theme';

// Bottom nav skeleton — 6 icons matching the tab count
function NavBarSkeleton({ colors }: { colors: typeof Colors }) {
  return (
    <View style={[styles.navBar, { backgroundColor: colors.bgElevated, borderTopColor: colors.border }]}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} width={28} height={28} borderRadius={14} />
      ))}
    </View>
  );

}

// ─── Bases tab skeleton ───────────────────────────────────────────────────────
export function BasesScreenSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, paddingBottom: 64 }}>
      {/* Count bar */}
      <View style={[styles.countBarSkeleton]}>
        <Skeleton width={100} height={14} borderRadius={4} />
      </View>
      {/* Cards */}
      <View style={styles.baseGrid}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.baseCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {/* Thumbnail block with aspect ratio */}
            <View style={{ width: '100%', aspectRatio: 1.6, backgroundColor: colors.bgSubtle, position: 'relative', overflow: 'hidden' }}>
              <Skeleton width="100%" height="100%" borderRadius={0} />
              
              {/* Overlay badge placeholders */}
              <View style={{ position: 'absolute', top: Spacing.sm, left: Spacing.sm }}>
                <Skeleton width={38} height={18} borderRadius={9} />
              </View>
              <View style={{ position: 'absolute', top: Spacing.sm, right: Spacing.sm }}>
                <Skeleton width={42} height={18} borderRadius={9} />
              </View>
              <View style={{ position: 'absolute', bottom: Spacing.sm, left: Spacing.sm, flexDirection: 'row', gap: 4 }}>
                <Skeleton width={48} height={18} borderRadius={9} />
                <Skeleton width={40} height={18} borderRadius={9} />
              </View>
            </View>
            
            {/* Content area */}
            <View style={{ padding: Spacing.base, gap: Spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton width="60%" height={16} borderRadius={4} />
                <Skeleton width={20} height={20} borderRadius={10} />
              </View>
              <Skeleton width="100%" height={38} borderRadius={Radius.lg} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Events tab skeleton ──────────────────────────────────────────────────────
export function EventsScreenSkeleton() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={{ flex: 1, paddingBottom: 64 }}>
        <View style={styles.header}>
          <View style={{ gap: 6 }}>
            <Skeleton width={80} height={20} borderRadius={6} />
            <Skeleton width={190} height={12} borderRadius={4} />
          </View>
        </View>
        <View style={{ paddingHorizontal: Spacing.base, marginBottom: Spacing.sm }}>
          <Skeleton width={100} height={13} borderRadius={4} />
        </View>
        {[0, 1].map((i) => (
          <View key={`active-${i}`} style={[styles.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.eventCardTop}>
              <Skeleton width={36} height={36} borderRadius={18} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="55%" height={14} borderRadius={4} />
                <Skeleton width="40%" height={11} borderRadius={3} />
              </View>
              <Skeleton width={60} height={22} borderRadius={11} />
            </View>
            <Skeleton width="70%" height={10} borderRadius={3} style={{ marginTop: Spacing.sm }} />
            <Skeleton width="100%" height={3} borderRadius={2} style={{ marginTop: Spacing.sm }} />
            <View style={styles.eventCardFooter}>
              <Skeleton width={14} height={14} borderRadius={7} />
              <Skeleton width={110} height={10} borderRadius={3} />
            </View>
          </View>
        ))}
        <View style={{ paddingHorizontal: Spacing.base, marginTop: Spacing.md, marginBottom: Spacing.sm }}>
          <Skeleton width={110} height={13} borderRadius={4} />
        </View>
        {[0, 1, 2].map((i) => (
          <View key={`upcoming-${i}`} style={[styles.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.eventCardTop}>
              <Skeleton width={36} height={36} borderRadius={18} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="50%" height={14} borderRadius={4} />
                <Skeleton width="35%" height={11} borderRadius={3} />
              </View>
              <Skeleton width={70} height={22} borderRadius={11} />
            </View>
            <Skeleton width="65%" height={10} borderRadius={3} style={{ marginTop: Spacing.sm }} />
            <Skeleton width="100%" height={3} borderRadius={2} style={{ marginTop: Spacing.sm }} />
            <View style={styles.eventCardFooter}>
              <Skeleton width={14} height={14} borderRadius={7} />
              <Skeleton width={100} height={10} borderRadius={3} />
            </View>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ─── Home tab skeleton ────────────────────────────────────────────────────────
export function HomeScreenSkeleton() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={{ flex: 1, paddingBottom: 64 }}>
        {/* Header: title + timestamp */}
        <View style={styles.header}>
          <Skeleton width={130} height={20} borderRadius={6} />
          <Skeleton width={100} height={12} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        {/* Player card */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.playerRow}>
            <Skeleton width={52} height={52} borderRadius={Radius.lg} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="55%" height={16} borderRadius={5} />
              <Skeleton width="35%" height={12} borderRadius={4} />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Skeleton width={80} height={14} borderRadius={7} />
              </View>
            </View>
            <Skeleton width={48} height={48} borderRadius={Radius.md} />
          </View>
          {/* Stats row */}
          <View style={[styles.statsRowOuter, { borderTopColor: colors.border }]}>
            {[70, 60, 50, 80].map((w, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Skeleton width={14} height={14} borderRadius={7} />
                <Skeleton width={w} height={12} borderRadius={4} />
              </View>
            ))}
          </View>
        </View>
        {/* Section: Progress Overview */}
        <View style={[styles.sectionLabel, { marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
          <Skeleton width={140} height={14} borderRadius={4} />
        </View>
        <View style={styles.progressGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.progressCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton width="60%" height={13} borderRadius={4} />
                <Skeleton width={14} height={14} borderRadius={7} />
              </View>
              <Skeleton width="35%" height={22} borderRadius={5} style={{ marginTop: 4, marginBottom: 8 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Skeleton style={{ flex: 1 }} height={4} borderRadius={2} />
                <Skeleton width={30} height={10} borderRadius={3} />
              </View>
            </View>
          ))}
        </View>
        {/* Section: Quick Actions */}
        <View style={[styles.sectionLabel, { marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
          <Skeleton width={110} height={14} borderRadius={4} />
        </View>
        <View style={styles.homeActionsRow}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={[styles.homeActionBtn, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Skeleton width={16} height={16} borderRadius={4} />
              <Skeleton width={36} height={11} borderRadius={3} />
            </View>
          ))}
        </View>
        {/* Section: Quick Stats */}
        <View style={[styles.sectionLabel, { marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
          <Skeleton width={90} height={14} borderRadius={4} />
        </View>
        <View style={[styles.statsTable, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.statRow, { backgroundColor: colors.bgSubtle, borderBottomColor: colors.border }]}>
            <Skeleton width={50} height={12} borderRadius={4} />
            <Skeleton width={60} height={12} borderRadius={4} />
          </View>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={[styles.statRow, { borderBottomColor: colors.borderSubtle }]}>
              <Skeleton width="40%" height={12} borderRadius={4} />
              <Skeleton width="20%" height={12} borderRadius={4} />
            </View>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </View>
    </SafeAreaView>
  );
}

// ─── Profile tab skeleton ─────────────────────────────────────────────────────
export function ProfileScreenSkeleton() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={{ flex: 1, paddingBottom: 64 }}>
        <View style={styles.header}>
          <Skeleton width={90} height={20} borderRadius={6} />
        </View>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.playerRow}>
            <Skeleton width={56} height={56} borderRadius={28} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="50%" height={16} borderRadius={5} />
              <Skeleton width="30%" height={12} borderRadius={4} />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Skeleton width={38} height={18} borderRadius={9} />
                <Skeleton width={60} height={18} borderRadius={9} />
              </View>
            </View>
            <Skeleton width={64} height={64} borderRadius={32} />
          </View>
        </View>
        <View style={styles.tabPills}>
          {[90, 60, 70, 65, 50, 70].map((w, i) => (
            <Skeleton key={i} width={w} height={30} borderRadius={15} />
          ))}
        </View>
        <View style={styles.itemList}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.itemCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Skeleton width={42} height={42} borderRadius={Radius.md} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="55%" height={13} borderRadius={4} />
                <Skeleton width="80%" height={4} borderRadius={2} />
              </View>
              <Skeleton width={48} height={22} borderRadius={6} />
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Armies tab skeleton ──────────────────────────────────────────────────────
export function ArmiesScreenSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, paddingBottom: 64 }}>
      {/* Count bar */}
      <View style={[styles.countBarSkeleton]}>
        <Skeleton width={100} height={14} borderRadius={4} />
      </View>
      {/* Tag filter pills */}
      <View style={[styles.chipsRowSkeleton, { paddingBottom: Spacing.sm }]}>
        {[50, 60, 55, 50, 55, 60].map((w, i) => (
          <Skeleton key={i} width={w} height={28} borderRadius={14} />
        ))}
      </View>
      {/* Cards */}
      <View>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.armyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {/* Top row: TH image + name/author + score */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Skeleton width={36} height={36} borderRadius={4} />
              <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={16} borderRadius={4} />
                <Skeleton width="35%" height={10} borderRadius={3} style={{ marginTop: 4 }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Skeleton width={14} height={14} borderRadius={7} />
                <Skeleton width={30} height={12} borderRadius={4} />
              </View>
            </View>
            {/* Troops */}
            <View style={{ marginTop: Spacing.md }}>
              <Skeleton width={50} height={12} borderRadius={3} style={{ marginBottom: Spacing.sm }} />
              <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ flex: 1 }}>
                  {[0, 1, 2].map((r) => (
                    <View key={r} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                      <Skeleton width="55%" height={10} borderRadius={3} />
                      <View style={{ flex: 1 }} />
                      <Skeleton width={24} height={10} borderRadius={3} />
                    </View>
                  ))}
                </View>
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <View style={{ flex: 1 }}>
                  {[0, 1, 2].map((r) => (
                    <View key={r} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                      <Skeleton width="55%" height={10} borderRadius={3} />
                      <View style={{ flex: 1 }} />
                      <Skeleton width={24} height={10} borderRadius={3} />
                    </View>
                  ))}
                </View>
              </View>
            </View>
            {/* Heroes */}
            <View style={{ marginTop: Spacing.md }}>
              <Skeleton width={50} height={12} borderRadius={3} style={{ marginBottom: Spacing.sm }} />
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 6, overflow: 'hidden' }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bgSubtle }}>
                  <View style={{ flex: 1.3, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' }}>
                    <Skeleton width={28} height={9} borderRadius={3} />
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.border }} />
                  <View style={{ flex: 2, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' }}>
                    <Skeleton width={54} height={9} borderRadius={3} />
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.border }} />
                  <View style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' }}>
                    <Skeleton width={20} height={9} borderRadius={3} />
                  </View>
                </View>
                {/* Rows */}
                {[0, 1].map((r) => (
                  <View key={r} style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                    <View style={{ flex: 1.3, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' }}>
                      <Skeleton width="60%" height={10} borderRadius={3} />
                    </View>
                    <View style={{ width: 1, backgroundColor: colors.border }} />
                    <View style={{ flex: 2, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' }}>
                      <Skeleton width="70%" height={10} borderRadius={3} />
                    </View>
                    <View style={{ width: 1, backgroundColor: colors.border }} />
                    <View style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center' }}>
                      <Skeleton width="50%" height={10} borderRadius={3} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
            {/* Clan Castle */}
            <View style={{ marginTop: Spacing.md }}>
              <Skeleton width={80} height={12} borderRadius={3} style={{ marginBottom: Spacing.sm }} />
              <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 6, overflow: 'hidden' }}>
                <View style={{ flex: 1 }}>
                  {[0, 1].map((r) => (
                    <View key={r} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                      <Skeleton width="55%" height={10} borderRadius={3} />
                      <View style={{ flex: 1 }} />
                      <Skeleton width={24} height={10} borderRadius={3} />
                    </View>
                  ))}
                </View>
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <View style={{ flex: 1 }}>
                  {[0, 1].map((r) => (
                    <View key={r} style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
                      <Skeleton width="55%" height={10} borderRadius={3} />
                      <View style={{ flex: 1 }} />
                      <Skeleton width={24} height={10} borderRadius={3} />
                    </View>
                  ))}
                </View>
              </View>
            </View>
            {/* Actions row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.sm }}>
              <Skeleton width={18} height={18} borderRadius={4} style={{ padding: Spacing.xs }} />
              <Skeleton width={18} height={18} borderRadius={4} style={{ padding: Spacing.xs }} />
              <View style={{ flex: 1 }} />
              <Skeleton width={88} height={30} borderRadius={6} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: 8,
  },
  card: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  progressCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  tabPills: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  itemList: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  statsRowOuter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.base,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  statsTable: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    paddingVertical: Spacing.base,
    borderRadius: Radius.lg,
  },
  homeActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.base,
  },
  homeActionBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
  },
  armyCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  navBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: Colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.base,
  },
  countBarSkeleton: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  chipsRowSkeleton: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    flexWrap: 'wrap',
  },
  baseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  baseCard: {
    width: '100%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  eventCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  eventCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  eventCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
