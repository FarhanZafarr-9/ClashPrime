import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import { fetchEvents, ClashEvent, formatCountdown } from '../../src/api/eventsScraper';
import { EventsScreenSkeleton } from '../../src/components/SkeletonScreens';

const EVENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Raid Weekend': 'skull-outline',
  'Trader Refresh': 'cart-outline',
  'Clan Games': 'people-outline',
  'Season End': 'trophy-outline',
  'CWL': 'flash-outline',
  'League Reset': 'refresh-outline',
};

function getEventIcon(name: string): keyof typeof Ionicons.glyphMap {
  for (const [key, icon] of Object.entries(EVENT_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return 'calendar-outline';
}

function CountdownBar({ remaining, total }: { remaining: number; total: number }) {
  const progress = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  return (
    <View style={styles.countdownBarTrack}>
      <View style={[styles.countdownBarFill, { width: `${progress * 100}%` }]} />
    </View>
  );
}

export default function EventsScreen() {
  const [events, setEvents] = useState<ClashEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      setError(null);
      const { events: data } = await fetchEvents();
      setEvents(data);
      if (data.length === 0) setError('No events found. Try refreshing.');
    } catch {
      setError('Failed to load events. Check your connection.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadEvents();
      setLoading(false);
    })();
  }, [loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const activeEvents = events.filter((e) => e.isActive && e.remainingSeconds > 0);
  const upcomingEvents = events.filter((e) => !e.isActive && e.remainingSeconds > 0);
  const endedEvents = events.filter((e) => e.remainingSeconds <= 0 && !e.isActive);

  if (loading) {
    return <EventsScreenSkeleton />;
  }

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
          <Text style={styles.title}>Events</Text>
          <Text style={styles.subtitle}>Upcoming in-game events</Text>
        </View>

        {error && (
          <Card style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <Pressable style={styles.retryBtn} onPress={loadEvents}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </Card>
        )}

        {activeEvents.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionDot, styles.dotActive]} />
              <Text style={styles.sectionTitle}>Active Now</Text>
            </View>
            {activeEvents.map((event) => (
              <EventCard key={event.name} event={event} featured />
            ))}
          </>
        )}

        {upcomingEvents.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionDot, styles.dotUpcoming]} />
              <Text style={styles.sectionTitle}>Upcoming</Text>
            </View>
            {upcomingEvents.map((event) => (
              <EventCard key={event.name} event={event} />
            ))}
          </>
        )}

        {endedEvents.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <View style={[styles.sectionDot, styles.dotEnded]} />
              <Text style={styles.sectionTitle}>Recently Ended</Text>
            </View>
            {endedEvents.map((event) => (
              <EventCard key={event.name} event={event} ended />
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function EventCard({ event, featured, ended }: { event: ClashEvent; featured?: boolean; ended?: boolean }) {
  const icon = getEventIcon(event.name);
  const countdown = event.remainingSeconds > 0 ? formatCountdown(event.remainingSeconds) : null;

  const totalDuration = 7 * 86400;

  return (
    <View style={[styles.eventCard, featured && styles.eventCardFeatured, ended && styles.eventCardEnded]}>
      <View style={styles.eventTop}>
        <View style={[styles.eventIconWrap, featured && styles.eventIconWrapActive, ended && styles.eventIconWrapEnded]}>
          <Ionicons name={icon} size={20} color={featured ? Colors.bg : ended ? Colors.textMuted : Colors.textSecondary} />
        </View>
        <View style={styles.eventInfo}>
          <Text style={[styles.eventName, featured && styles.eventNameFeatured, ended && styles.eventNameEnded]} numberOfLines={1}>{event.name}</Text>
          <Text style={[styles.eventStatus, featured && styles.eventStatusActive, ended && styles.eventStatusEnded]}>
            {ended ? 'Ended' : featured ? 'In progress' : countdown ? `In ${countdown}` : 'Upcoming'}
          </Text>
        </View>
        {countdown && !ended && (
          <View style={[styles.countdownBadge, featured && styles.countdownBadgeFeatured]}>
            <Text style={[styles.countdownText, featured && styles.countdownTextActive]}>{countdown}</Text>
          </View>
        )}
      </View>

      {event.description ? (
        <Text style={[styles.eventDesc, ended && styles.eventDescEnded]} numberOfLines={2}>{event.description}</Text>
      ) : null}

      {!ended && event.remainingSeconds > 0 && (
        <CountdownBar remaining={event.remainingSeconds} total={totalDuration} />
      )}

      <View style={styles.eventFooter}>
        <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
        <Text style={styles.eventDate}>
          {ended ? 'Ended' : 'Ends'} {new Date(event.endDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>
    </View>
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
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  errorCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  errorText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.sm,
    marginLeft: Spacing.sm,
  },
  retryText: {
    ...Typography.caption,
    color: Colors.bg,
    fontWeight: '600',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: Colors.textPrimary,
  },
  dotUpcoming: {
    backgroundColor: Colors.textTertiary,
  },
  dotEnded: {
    backgroundColor: Colors.textMuted,
  },
  sectionTitle: {
    ...Typography.footnote,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  eventCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  eventCardFeatured: {
    borderColor: Colors.accent,
    borderWidth: 1.5,
  },
  eventCardEnded: {
    opacity: 0.5,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  eventIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventIconWrapActive: {
    backgroundColor: Colors.accentSubtle,
    borderColor: Colors.accent,
  },
  eventIconWrapEnded: {
    backgroundColor: Colors.bgSubtle,
    borderColor: 'transparent',
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  eventNameFeatured: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  eventNameEnded: {
    color: Colors.textTertiary,
  },
  eventStatus: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  eventStatusActive: {
    color: Colors.accent,
    fontWeight: '600',
  },
  eventStatusEnded: {
    color: Colors.textMuted,
  },
  countdownBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countdownBadgeFeatured: {
    backgroundColor: Colors.accentSubtle,
    borderColor: Colors.accent,
  },
  countdownText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  countdownTextActive: {
    color: Colors.textPrimary,
  },
  eventDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  eventDescEnded: {
    color: Colors.textMuted,
  },
  countdownBarTrack: {
    height: 3,
    backgroundColor: Colors.borderSubtle,
    borderRadius: 2,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  countdownBarFill: {
    height: '100%',
    backgroundColor: Colors.textSecondary,
    borderRadius: 2,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  eventDate: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
});
