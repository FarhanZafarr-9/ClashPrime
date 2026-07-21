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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={{ flex: 1, paddingBottom: 64 }}>
        <View style={styles.header}>
          <View style={{ gap: 6 }}>
            <Skeleton width={130} height={20} borderRadius={6} />
            <Skeleton width={180} height={12} borderRadius={4} />
          </View>
          <Skeleton width={36} height={36} borderRadius={18} />
        </View>
        <View style={styles.chipsRow}>
          {[50, 40, 70, 60, 45, 55].map((w, i) => (
            <Skeleton key={i} width={w} height={28} borderRadius={14} />
          ))}
        </View>
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
    </SafeAreaView>
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
        <View style={styles.header}>
          <Skeleton width={120} height={20} borderRadius={6} />
          <Skeleton width={80} height={12} borderRadius={4} />
        </View>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.playerRow}>
            <Skeleton width={52} height={52} borderRadius={26} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="55%" height={16} borderRadius={5} />
              <Skeleton width="35%" height={12} borderRadius={4} />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Skeleton width={40} height={18} borderRadius={9} />
                <Skeleton width={50} height={18} borderRadius={9} />
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.md }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                <Skeleton width={40} height={40} borderRadius={20} />
                <Skeleton width={36} height={10} borderRadius={3} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.progressGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.progressCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <Skeleton width="60%" height={12} borderRadius={4} />
              <Skeleton width="40%" height={20} borderRadius={5} style={{ marginTop: 8 }} />
              <Skeleton width="100%" height={4} borderRadius={2} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.statRow, { borderBottomColor: colors.borderSubtle }]}>
              <Skeleton width="40%" height={12} borderRadius={4} />
              <Skeleton width="25%" height={12} borderRadius={4} />
            </View>
          ))}
        </View>
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
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
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
