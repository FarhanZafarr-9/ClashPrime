import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../src/theme';
import { Card } from '../../src/components/Card';
import { fetchEvents, ClashEvent, formatCountdown } from '../../src/api/eventsScraper';
import { fetchNews, NewsItem } from '../../src/api/newsScraper';
import { EventsScreenSkeleton } from '../../src/components/SkeletonScreens';

type ViewMode = 'events' | 'news';

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
  const [view, setView] = useState<ViewMode>('events');
  const [events, setEvents] = useState<ClashEvent[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [eventsData, newsData] = await Promise.all([fetchEvents(), fetchNews()]);
      setEvents(eventsData.events);
      setNews(newsData);
      if (view === 'events' && eventsData.events.length === 0) setError('No events found. Try refreshing.');
    } catch {
      setError('Failed to load data. Check your connection.');
    }
  }, [view]);

  useEffect(() => {
    (async () => {
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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

        <View style={styles.pillRow}>
          <Pressable
            style={[styles.pill, view === 'events' && styles.pillActive]}
            onPress={() => setView('events')}
          >
            <Ionicons
              name="calendar-outline"
              size={14}
              color={view === 'events' ? Colors.bg : Colors.textSecondary}
            />
            <Text style={[styles.pillText, view === 'events' && styles.pillTextActive]}>Events</Text>
          </Pressable>
          <Pressable
            style={[styles.pill, view === 'news' && styles.pillActive]}
            onPress={() => setView('news')}
          >
            <Ionicons
              name="newspaper-outline"
              size={14}
              color={view === 'news' ? Colors.bg : Colors.textSecondary}
            />
            <Text style={[styles.pillText, view === 'news' && styles.pillTextActive]}>News</Text>
          </Pressable>
        </View>

        {error && view === 'events' && (
          <Card style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <Pressable style={styles.retryBtn} onPress={loadData}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </Card>
        )}

        {view === 'events' ? (
          <>
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
          </>
        ) : (
          <>
            {news.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="newspaper-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No news yet</Text>
              </View>
            ) : (
              <>
                <View style={styles.sectionRow}>
                  <View style={[styles.sectionDot, styles.dotActive]} />
                  <Text style={styles.sectionTitle}>Latest News</Text>
                </View>
                {news.slice(0, 15).map((item) => (
                  <NewsCard key={item.link} item={item} />
                ))}
              </>
            )}
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
        <Text style={[styles.eventDesc, ended && styles.eventDescEnded]} numberOfLines={1}>{event.description}</Text>
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

function NewsCard({ item }: { item: NewsItem }) {
  const daysAgo = Math.floor((Date.now() - item.pubDate) / 86400000);
  const dateLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;

  return (
    <Pressable onPress={() => item.link ? Linking.openURL(item.link) : null}>
      <View style={styles.eventCard}>
        <View style={styles.eventTop}>
          <View style={styles.newsIconWrap}>
            <Ionicons name="newspaper-outline" size={20} color={Colors.textSecondary} />
          </View>
          <View style={styles.eventInfo}>
            <Text style={styles.eventName} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.eventStatus}>
              {item.category} · {item.author}
            </Text>
          </View>
          <View style={styles.newsBadge}>
            <Text style={styles.countdownText}>{dateLabel}</Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.eventDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={styles.eventFooter}>
          <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
          <Text style={styles.eventDate}>
            {new Date(item.pubDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <View style={styles.newsLink}>
            <Text style={styles.newsLinkText}>Open</Text>
            <Ionicons name="open-outline" size={10} color={Colors.textSecondary} />
          </View>
        </View>
      </View>
    </Pressable>
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
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
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
  emptyState: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 60,
  },
  emptyText: {
    ...Typography.subhead,
    color: Colors.textMuted,
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
  newsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
  newsBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  newsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  newsLinkText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
