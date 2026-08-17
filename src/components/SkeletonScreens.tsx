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
              <Skeleton width="100%" height={38} borderRadius={Radius.md} />
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
        <View style={styles.eventsSectionRow}>
          <Skeleton width={6} height={6} borderRadius={3} />
          <Skeleton width={90} height={13} borderRadius={4} />
        </View>
        {[0, 1].map((i) => (
          <View key={`active-${i}`} style={[styles.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.eventCardTop}>
              <Skeleton width={36} height={36} borderRadius={8} />
              <View style={{ flex: 1, gap: 4 }}>
                <Skeleton width="55%" height={17} borderRadius={4} />
                <Skeleton width="40%" height={11} borderRadius={3} />
              </View>
              <Skeleton width={60} height={22} borderRadius={6} />
            </View>
            <View style={{ marginBottom: Spacing.sm }}>
              <Skeleton width="70%" height={10} borderRadius={3} />
            </View>
            <Skeleton width="100%" height={3} borderRadius={2} style={{ marginBottom: Spacing.sm }} />
            <View style={styles.eventCardFooter}>
              <Skeleton width={12} height={12} borderRadius={6} />
              <Skeleton width={110} height={10} borderRadius={3} />
            </View>
          </View>
        ))}
        <View style={styles.eventsSectionRow}>
          <Skeleton width={6} height={6} borderRadius={3} />
          <Skeleton width={70} height={13} borderRadius={4} />
        </View>
        {[0, 1].map((i) => (
          <View key={`upcoming-${i}`} style={[styles.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.eventCardTop}>
              <Skeleton width={36} height={36} borderRadius={8} />
              <View style={{ flex: 1, gap: 4 }}>
                <Skeleton width="50%" height={17} borderRadius={4} />
                <Skeleton width="35%" height={11} borderRadius={3} />
              </View>
              <Skeleton width={70} height={22} borderRadius={6} />
            </View>
            <View style={{ marginBottom: Spacing.sm }}>
              <Skeleton width="65%" height={10} borderRadius={3} />
            </View>
            <View style={styles.eventCardFooter}>
              <Skeleton width={12} height={12} borderRadius={6} />
              <Skeleton width={100} height={10} borderRadius={3} />
            </View>
          </View>
        ))}
        <View style={styles.eventsSectionRow}>
          <Skeleton width={6} height={6} borderRadius={3} />
          <Skeleton width={110} height={13} borderRadius={4} />
        </View>
        {[0, 1].map((i) => (
          <View key={`ended-${i}`} style={[styles.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.eventCardTop}>
              <Skeleton width={36} height={36} borderRadius={8} />
              <View style={{ flex: 1, gap: 4 }}>
                <Skeleton width="45%" height={17} borderRadius={4} />
                <Skeleton width="30%" height={11} borderRadius={3} />
              </View>
            </View>
            <View style={{ marginBottom: Spacing.sm }}>
              <Skeleton width="60%" height={10} borderRadius={3} />
            </View>
            <View style={styles.eventCardFooter}>
              <Skeleton width={12} height={12} borderRadius={6} />
              <Skeleton width={90} height={10} borderRadius={3} />
            </View>
          </View>
        ))}
        <View style={styles.eventsSectionRow}>
          <Skeleton width={6} height={6} borderRadius={3} />
          <Skeleton width={80} height={13} borderRadius={4} />
        </View>
        {[0, 1].map((i) => (
          <View key={`news-${i}`} style={[styles.eventCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.eventCardTop}>
              <Skeleton width={36} height={36} borderRadius={8} />
              <View style={{ flex: 1, gap: 4 }}>
                <Skeleton width="70%" height={17} borderRadius={4} />
                <Skeleton width="50%" height={11} borderRadius={3} />
              </View>
            </View>
            <View style={{ marginBottom: Spacing.sm }}>
              <Skeleton width="80%" height={10} borderRadius={3} />
            </View>
            <View style={styles.eventCardFooter}>
              <Skeleton width={12} height={12} borderRadius={6} />
              <Skeleton width={80} height={10} borderRadius={3} />
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
  const rowRadius = Radius.xl * 1.25;
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={{ flex: 1, paddingBottom: 64 }}>
        {/* Header: title + icon buttons + timestamp */}
        <View style={styles.header}>
          <View style={styles.headerTitleRowSkeleton}>
            <Skeleton width={130} height={20} borderRadius={6} />
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <Skeleton width={36} height={36} borderRadius={Radius.md} />
            </View>
          </View>
          <Skeleton width={100} height={12} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        {/* Player card */}
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.playerRow}>
            <Skeleton width={52} height={52} borderRadius={Radius.lg} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="55%" height={16} borderRadius={5} />
              <Skeleton width="35%" height={12} borderRadius={4} />
              <Skeleton width={80} height={12} borderRadius={4} />
            </View>
            <Skeleton width={48} height={48} borderRadius={Radius.sm} />
          </View>
          {/* Stats collapse row */}
          <View style={[styles.homeCollapseRowSkeleton, { borderTopColor: colors.border }]}>
            <Skeleton width={28} height={28} borderRadius={Radius.sm} />
            <View style={{ flex: 1, gap: 3 }}>
              <Skeleton width={50} height={11} borderRadius={3} />
              <Skeleton width={80} height={10} borderRadius={3} />
            </View>
            <Skeleton width={16} height={16} borderRadius={8} />
          </View>
        </View>
        {/* Section: Progress Overview / Buildings / Backlog (collapsed rows) */}
        <View style={styles.sectionLabel}>
          <Skeleton width={140} height={14} borderRadius={4} />
        </View>
        <View style={styles.homeSectionsSkeleton}>
          <View style={[
            styles.homeSectionRowSkeleton,
            { backgroundColor: colors.bgCard },
            { borderTopLeftRadius: rowRadius, borderTopRightRadius: rowRadius },
          ]}>
            <Skeleton width={32} height={32} borderRadius={Radius.md} />
            <View style={{ flex: 1, gap: 5 }}>
              <Skeleton width="50%" height={13} borderRadius={4} />
              <Skeleton width="70%" height={4} borderRadius={2} />
            </View>
            <View style={styles.homeSectionBadgesSkeleton}>
              <Skeleton width={36} height={32} borderRadius={Radius.sm} />
              <Skeleton width={40} height={32} borderRadius={Radius.sm} />
            </View>
          </View>
          <View style={[styles.homeSectionRowSkeleton, { backgroundColor: colors.bgCard }]}>
            <Skeleton width={32} height={32} borderRadius={Radius.md} />
            <View style={{ flex: 1, gap: 5 }}>
              <Skeleton width="40%" height={13} borderRadius={4} />
              <Skeleton width="70%" height={4} borderRadius={2} />
            </View>
            <View style={styles.homeSectionBadgesSkeleton}>
              <Skeleton width={36} height={32} borderRadius={Radius.sm} />
              <Skeleton width={40} height={32} borderRadius={Radius.sm} />
            </View>
          </View>
          <View style={[
            styles.homeSectionRowSkeleton,
            { backgroundColor: colors.bgCard },
            { borderBottomLeftRadius: rowRadius, borderBottomRightRadius: rowRadius },
          ]}>
            <Skeleton width={32} height={32} borderRadius={Radius.md} />
            <View style={{ flex: 1, gap: 5 }}>
              <Skeleton width="45%" height={13} borderRadius={4} />
              <Skeleton width="60%" height={10} borderRadius={3} />
            </View>
            <Skeleton width={36} height={32} borderRadius={Radius.sm} />
          </View>
        </View>
        {/* Section: Quick Actions */}
        <View style={styles.sectionLabel}>
          <Skeleton width={110} height={14} borderRadius={4} />
        </View>
        <View style={styles.homeSectionsSkeleton}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[
              styles.homeSectionRowSkeleton,
              { backgroundColor: colors.bgCard },
              i === 0 && { borderTopLeftRadius: rowRadius, borderTopRightRadius: rowRadius },
              i === 3 && { borderBottomLeftRadius: rowRadius, borderBottomRightRadius: rowRadius },
            ]}>
              <Skeleton width={32} height={32} borderRadius={Radius.md} />
              <View style={{ flex: 1, gap: 5 }}>
                <Skeleton width="38%" height={13} borderRadius={4} />
                <Skeleton width="62%" height={10} borderRadius={3} />
              </View>
              <Skeleton width={16} height={16} borderRadius={8} />
            </View>
          ))}
        </View>
        {/* Section: Quick Stats (collapsed rows) */}
        <View style={styles.sectionLabel}>
          <Skeleton width={90} height={14} borderRadius={4} />
        </View>
        <View style={styles.homeSectionsSkeleton}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[
              styles.homeSectionRowSkeleton,
              { backgroundColor: colors.bgCard },
              i === 0 && { borderTopLeftRadius: rowRadius, borderTopRightRadius: rowRadius },
              i === 2 && { borderBottomLeftRadius: rowRadius, borderBottomRightRadius: rowRadius },
            ]}>
              <Skeleton width={32} height={32} borderRadius={Radius.md} />
              <View style={{ flex: 1, gap: 5 }}>
                <Skeleton width="40%" height={13} borderRadius={4} />
                <Skeleton width="55%" height={10} borderRadius={3} />
              </View>
              <Skeleton width={36} height={32} borderRadius={Radius.sm} />
            </View>
          ))}
        </View>
        {/* Section: Active Timers */}
        <View style={styles.sectionLabel}>
          <View style={styles.homeTimersLabelSkeleton}>
            <Skeleton width={110} height={14} borderRadius={4} />
            <Skeleton width={54} height={26} borderRadius={13} />
          </View>
        </View>
        <View style={[styles.homeTimersEmptySkeleton, { backgroundColor: colors.bgCard }]}>
          <Skeleton width={36} height={36} borderRadius={Radius.lg} />
          <View style={{ flex: 1, gap: 4 }}>
            <Skeleton width="45%" height={13} borderRadius={4} />
            <Skeleton width="70%" height={10} borderRadius={3} />
          </View>
          <Skeleton width={24} height={24} borderRadius={Radius.md} />
        </View>
        <View style={{ height: 100 }} />
      </View>
    </SafeAreaView>
  );
}

// ─── Time to Max tab skeleton ────────────────────────────────────────────────
export function MaxTimeScreenSkeleton() {
  const { colors } = useTheme();
  const rowRadius = Radius.xl * 1.25;
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={{ flex: 1, paddingBottom: 150 }}>
        {/* Header */}
        <View style={styles.header}>
          <Skeleton width={150} height={26} borderRadius={6} />
          <Skeleton width={220} height={13} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
        {/* Hero card */}
        <View style={[styles.maxTimeHeroCard, { backgroundColor: colors.bgCard }]}>
          <Skeleton width={160} height={11} borderRadius={3} />
          <Skeleton width={180} height={48} borderRadius={8} style={{ marginTop: Spacing.sm }} />
          <Skeleton width="100%" height={12} borderRadius={4} style={{ marginTop: Spacing.sm }} />
          {/* Resource grid */}
          <View style={styles.maxTimeResourceGrid}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.maxTimeResourceCell, { backgroundColor: colors.bgCardHover }]}>
                <Skeleton width={32} height={32} borderRadius={Radius.md} />
                <Skeleton width={60} height={13} borderRadius={4} />
              </View>
            ))}
          </View>
        </View>
        {/* Builders card */}
        <View style={styles.sectionLabel}>
          <Skeleton width={70} height={13} borderRadius={4} />
        </View>
        <View style={[styles.maxTimeBuilderCard, { backgroundColor: colors.bgCard }]}>
          <View style={{ flex: 1, gap: 5 }}>
            <Skeleton width={70} height={16} borderRadius={5} />
            <Skeleton width={170} height={11} borderRadius={4} />
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width={32} height={30} borderRadius={15} />
            ))}
          </View>
        </View>
        {/* Pipelines */}
        <View style={styles.sectionLabel}>
          <Skeleton width={80} height={13} borderRadius={4} />
        </View>
        <View style={styles.maxTimePipelineSections}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.maxTimePipelineRow,
                { backgroundColor: colors.bgCard },
                i === 0 && { borderTopLeftRadius: rowRadius, borderTopRightRadius: rowRadius },
                i === 3 && { borderBottomLeftRadius: rowRadius, borderBottomRightRadius: rowRadius },
              ]}
            >
              <Skeleton
                width={32}
                height={32}
                borderRadius={Radius.md}
                style={{
                  ...(i === 0 ? styles.maxTimePipelineRowIconFirst : {}),
                  ...(i === 3 ? styles.maxTimePipelineRowIconLast : {}),
                }}
              />
              <View style={{ flex: 1, gap: 5 }}>
                <Skeleton width={90} height={13} borderRadius={4} />
                <Skeleton width="85%" height={10} borderRadius={3} />
              </View>
              <Skeleton width={56} height={26} borderRadius={Radius.sm} />
            </View>
          ))}
        </View>
        <View style={{ height: 40 }} />
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
              <View style={{ flexDirection: 'row', borderWidth: 0.75, borderColor: colors.border, borderRadius: 6, overflow: 'hidden' }}>
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
              <View style={{ borderWidth: 0.75, borderColor: colors.border, borderRadius: 6, overflow: 'hidden' }}>
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
              <View style={{ flexDirection: 'row', borderWidth: 0.75, borderColor: colors.border, borderRadius: 6, overflow: 'hidden' }}>
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
              <View style={{ flex: 1 }} />
              <Skeleton width={18} height={18} borderRadius={4} />
              <Skeleton width={18} height={18} borderRadius={4} />
              <Skeleton width={18} height={18} borderRadius={4} />
            </View>
            {/* Copy Army button */}
            <Skeleton width="100%" height={38} borderRadius={6} style={{ marginTop: Spacing.md }} />
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 8,
  },
  card: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTitleRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeCollapseRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.xs,
  },
  homeSectionsSkeleton: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  homeSectionRowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  homeSectionBadgesSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
    borderWidth: 0.75,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  homeTimersLabelSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeTimersEmptySkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.base,
    padding: Spacing.md,
    borderRadius: Radius.xl,
  },
  armyCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 0.75,
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
  maxTimeHeroCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: Radius.xxl,
  },
  maxTimeResourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    justifyContent: 'space-between',
  },
  maxTimeResourceCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    minWidth: '48%',
    flex: 1,
  },
  maxTimeBuilderCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  maxTimePipelineSections: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    gap: Spacing.xs + 2,
    borderRadius: Radius.xl * 1.25,
    overflow: 'hidden',
  },
  maxTimePipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
  },
  maxTimePipelineRowIconFirst: {
    borderTopLeftRadius: Radius.lg,
  },
  maxTimePipelineRowIconLast: {
    borderBottomLeftRadius: Radius.lg,
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
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  eventsSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  eventCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  eventCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
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
