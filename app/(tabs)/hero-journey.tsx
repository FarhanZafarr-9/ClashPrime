import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Image,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/hooks/usePlayerContext';
import { formatCost, getArmyItemImage } from '../../src/utils/armyData';
import { getTownHallImageSource } from '../../src/utils/buildingImages';
import { PACKAGE_RESOURCE_IMAGES, PACKAGE_MAGIC_ITEM_IMAGES } from '../../src/data/packageImages';
import {
  computeHeroJourney,
  type HeroJourneyData,
  type HeroJourneyMilestone,
  type HeroJourneyRewardKind,
  type HeroJourneyTHSection,
} from '../../src/utils/heroJourney';
import PressableRipple from '../../src/components/PressableRipple';
import { SettingRow } from '../../src/components/SettingRow';
import { ResourceCostChips } from '../../src/components/ResourceCostChips';
import { HeroJourneyScreenSkeleton } from '../../src/components/SkeletonScreens';

const lockedImage = require('../../assets/images/chiefs-journey/locked.png');
const chestImage = require('../../assets/images/chiefs-journey/chest.webp');
const heroJourneyImage = require('../../assets/images/chiefs-journey/hero.png');

type FilterKey = 'all' | 'ores' | 'quests' | 'equipment' | 'skins' | 'items';

type JourneyGroup = { section: HeroJourneyTHSection; rows: { ms: HeroJourneyMilestone; index: number }[] };
type TimelineItem =
  | JourneyGroup
  | { parentGroups: JourneyGroup[]; kind: 'done' }
  | { parentGroups: JourneyGroup[]; kind: 'tail' };

const DONE_KEY = 0;
const TAIL_KEY = -1;

const FILTER_GROUPS: Record<Exclude<FilterKey, 'all'>, HeroJourneyRewardKind[]> = {
  ores: ['shinyOre', 'glowyOre', 'starryOre'],
  quests: ['quest'],
  equipment: ['equipment'],
  skins: ['skin'],
  items: ['elixir', 'darkElixir', 'heroPotion', 'mightyMorsel', 'petPotion', 'bookHeroes', 'runeElixir', 'runeDarkElixir'],
};

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ores', label: 'Ores' },
  { key: 'quests', label: 'Quests' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'skins', label: 'Skins' },
  { key: 'items', label: 'Items' },
];

const MC_ICONS: Partial<Record<HeroJourneyRewardKind, keyof typeof MaterialCommunityIcons.glyphMap>> = {
  heroPotion: 'flask-outline',
  mightyMorsel: 'food-apple',
  petPotion: 'paw',
  bookHeroes: 'book-open-page-variant',
  equipment: 'sword',
  skin: 'crown',
  quest: 'sword-cross',
};

const RUNE_PACK: Partial<Record<HeroJourneyRewardKind, number>> = {
  runeElixir: require('../../assets/images/runes/Magic_Item_Rune_of_Elixir.png'),
  runeDarkElixir: require('../../assets/images/runes/Magic_Item_Rune_of_Dark_Elixir.png'),
};

const RESOURCE_PACK: Partial<Record<HeroJourneyRewardKind, string>> = {
  shinyOre: 'Shiny Ore',
  glowyOre: 'Glowing Ore',
  starryOre: 'Starry Ore',
  elixir: 'Elixir',
  darkElixir: 'Dark Elixir',
};

const MAGIC_ITEM_PACK: Partial<Record<HeroJourneyRewardKind, string>> = {
  heroPotion: 'Hero Potion',
  mightyMorsel: 'Mighty Morsel',
  petPotion: 'Pet Potion',
  bookHeroes: 'Book of Heroes',
};

function isSpecial(m: HeroJourneyMilestone): boolean {
  return m.kind === 'equipment' || m.kind === 'skin';
}

const HERO_IMAGES: Record<string, number> = {
  'Barbarian King': require('../../assets/package-images/images/home/heroes/barbarian-king/icon.webp'),
  'Archer Queen': require('../../assets/package-images/images/home/heroes/archer-queen/icon.webp'),
  'Minion Prince': require('../../assets/package-images/images/home/heroes/minion-prince/icon.webp'),
  'Grand Warden': require('../../assets/package-images/images/home/heroes/grand-warden/icon.webp'),
  'Royal Champion': require('../../assets/package-images/images/home/heroes/royal-champion/icon.webp'),
  'Dragon Duke': require('../../assets/package-images/images/home/heroes/dragon-duke/icon.webp'),
};

function isQuest(m: HeroJourneyMilestone): boolean {
  return m.kind === 'quest';
}

const SKIN_IMAGES: Record<string, number> = {
  'Barbarian King': require('../../assets/images/skins/Majestic_King.webp'),
  'Archer Queen': require('../../assets/images/skins/Majestic_Queen.webp'),
  'Minion Prince': require('../../assets/images/skins/Majestic_Prince.webp'),
  'Grand Warden': require('../../assets/images/skins/Majestic_Warden.webp'),
  'Royal Champion': require('../../assets/images/skins/Majestic_Champion.webp'),
  'Dragon Duke': require('../../assets/images/skins/Majestic_Duke.webp'),
};

function RewardIcon({ kind, size = 16, color, hero }: { kind: HeroJourneyRewardKind; size?: number; color?: string; hero?: string }) {
  const resourceKey = RESOURCE_PACK[kind];
  if (resourceKey) {
    const src = PACKAGE_RESOURCE_IMAGES[resourceKey];
    if (src) return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  const magicKey = MAGIC_ITEM_PACK[kind];
  if (magicKey) {
    const src = PACKAGE_MAGIC_ITEM_IMAGES[magicKey];
    if (src) return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  const rune = RUNE_PACK[kind];
  if (rune) return <Image source={rune} style={{ width: size, height: size }} resizeMode="contain" />;
  if (kind === 'skin' && hero) {
    const skinImg = SKIN_IMAGES[hero];
    if (skinImg) return <Image source={skinImg} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return <MaterialCommunityIcons name={MC_ICONS[kind] ?? 'star-outline'} size={size} color={color ?? Colors.textSecondary} />;
}

function milestoneLabel(m: HeroJourneyMilestone): string {
  switch (m.kind) {
    case 'shinyOre':
      return `${formatCost(m.amount ?? 0)} Shiny Ore`;
    case 'glowyOre':
      return `${formatCost(m.amount ?? 0)} Glowing Ore`;
    case 'starryOre':
      return `${formatCost(m.amount ?? 0)} Starry Ore`;
    case 'elixir':
      return `${formatCost(m.amount ?? 0)} Elixir`;
    case 'darkElixir':
      return `${formatCost(m.amount ?? 0)} Dark Elixir`;
    case 'heroPotion':
      return `${m.count ?? 1}x Hero Potion`;
    case 'mightyMorsel':
      return `${m.count ?? 1}x Mighty Morsel`;
    case 'petPotion':
      return `${m.count ?? 1}x Pet Potion`;
    case 'bookHeroes':
      return `${m.count ?? 1}x Book of Heroes`;
    case 'runeElixir':
      return `${m.count ?? 1}x Rune of Elixir`;
    case 'runeDarkElixir':
      return `${m.count ?? 1}x Rune of Dark Elixir`;
    case 'equipment':
      return m.rewardEquip ?? `${m.hero} Equipment`;
    case 'skin':
      return 'Majestic Skin';
    case 'quest':
      return m.equip ? `Quest — ${m.equip}` : `Quest — ${m.hero}`;
    default:
      return 'Reward';
  }
}

function milestoneDesc(m: HeroJourneyMilestone): string | undefined {
  switch (m.kind) {
    case 'equipment':
      return m.hero ? `For ${m.hero}` : undefined;
    case 'skin':
      return m.hero ?? undefined;
    case 'heroPotion':
      return 'Boosts Heroes & Pets to max level for 1h.';
    case 'petPotion':
      return 'Pets upgrade 24x faster for 1h.';
    case 'mightyMorsel':
      return 'Max boost for Heroes, Pets & Equipment.';
    case 'bookHeroes':
      return 'Instantly finishes any hero or pet upgrade.';
    case 'runeElixir':
      return 'Fills your Elixir Storage to full.';
    case 'runeDarkElixir':
      return 'Fills your Dark Elixir Storage to full.';
    case 'shinyOre':
    case 'glowyOre':
    case 'starryOre':
      return 'Upgrade equipment';
    case 'elixir':
    case 'darkElixir':
      return 'Upgrade resource';
    default:
      return undefined;
  }
}

export default function HeroJourneyScreen() {
  const { player, loading, refresh } = usePlayer();
  const { colors } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [journey, setJourney] = useState<HeroJourneyData | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const rowY = useRef<Map<number, number>>(new Map());

  // Defer the expensive computation (package-indexed TH caps + 115 milestones)
  // until the app is idle, so the tab transitions instantly and the skeleton
  // shows while the journey is being built.
  useEffect(() => {
    if (!player) return;
    const handle = requestIdleCallback(
      () => {
        setJourney(computeHeroJourney(player));
      },
      { timeout: 5000 },
    );
    return () => cancelIdleCallback(handle);
  }, [player]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const refreshed = await refresh();
      if (refreshed) setJourney(computeHeroJourney(refreshed));
      else if (player) setJourney(computeHeroJourney(player));
    } catch {
      if (player) setJourney(computeHeroJourney(player));
    } finally {
      setRefreshing(false);
    }
  }, [refresh, player]);

  const filtered = useMemo(() => {
    if (!journey) return [];
    if (filter === 'all') return journey.milestones;
    return journey.milestones.filter((m) => FILTER_GROUPS[filter].includes(m.kind));
  }, [journey, filter]);

  const sectionGroups = useMemo(() => {
    if (!journey || filtered.length === 0) return [] as JourneyGroup[];
    const groups: JourneyGroup[] = [];
    let last: (typeof groups)[number] | null = null;
    filtered.forEach((ms, index) => {
      const section = journey.sections.find((s) => ms.level <= s.maxLevel);
      if (!section) return;
      if (!last || last.section.th !== section.th) {
        last = { section, rows: [] };
        groups.push(last);
      }
      last.rows.push({ ms, index });
    });
    return groups;
  }, [journey, filtered]);

  // Fully-claimed TH sections collapse under a single parent header (only when
  // more than 3 are done), and the far-future tail collapses under a second
  // parent (only when more than 3 remain), so the frontier stays visible while a
  // long track doesn't render as a tall wall of identical "Town Hall N" cards.
  // The individual sections stay inside both parents, fully expandable as before.
  const completedGroups = useMemo(
    () => sectionGroups.filter((g) => g.rows.length > 0 && g.rows.every((r) => r.ms.claimState === 'claimed')),
    [sectionGroups],
  );

  const timelineItems = useMemo(() => {
    const done = new Set(completedGroups.map((g) => g.section.th));
    const remaining = sectionGroups.filter((g) => !done.has(g.section.th));
    const items: TimelineItem[] = [];
    if (completedGroups.length > 0) {
      items.push({ parentGroups: completedGroups, kind: 'done' });
    }
    const keepVisible = 3;
    const keep = remaining.slice(0, keepVisible);
    const tail = remaining.slice(keepVisible);
    items.push(...keep);
    if (tail.length > 1) {
      items.push({ parentGroups: tail, kind: 'tail' });
    } else {
      items.push(...tail);
    }
    return items;
  }, [sectionGroups, completedGroups]);

  const currentFilteredIndex = useMemo(() => {
    if (!journey?.currentMilestone) return -1;
    return filtered.findIndex((m) => m.level === journey.currentMilestone!.level);
  }, [journey, filtered]);

  // TH sections start collapsed; the section holding the current milestone
  // opens by default so the frontier is visible without the full track wall.
  // Derived during render (no effect) using React's render-phase state pattern.
  const [expandedSections, setExpandedSections] = useState<ReadonlySet<number>>(new Set());
  const [seenJourney, setSeenJourney] = useState<HeroJourneyData | null>(null);
  if (journey && journey !== seenJourney) {
    setSeenJourney(journey);
    const cur = journey.currentMilestone;
    const sec = cur ? journey.sections.find((s) => cur.level <= s.maxLevel) : null;
    if (sec) setExpandedSections(new Set([sec.th]));
  }

  const toggleSection = useCallback((th: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(th)) next.delete(th);
      else next.add(th);
      return next;
    });
  }, []);

  const [pendingScroll, setPendingScroll] = useState<number | null>(null);
  const scrollToCurrent = useCallback(() => {
    if (!journey?.currentMilestone || currentFilteredIndex < 0) return;
    const sec = journey.sections.find((s) => journey.currentMilestone!.level <= s.maxLevel);
    if (sec) setExpandedSections((prev) => new Set(prev).add(sec.th));
    setPendingScroll(currentFilteredIndex);
  }, [journey, currentFilteredIndex]);

  // Retries once the target section expands and its rows are laid out.
  useEffect(() => {
    if (pendingScroll == null) return;
    const y = rowY.current.get(pendingScroll);
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 140), animated: true });
    setPendingScroll(null);
  }, [pendingScroll, filtered, expandedSections]);

  const onRowLayout = (index: number) => (e: LayoutChangeEvent) => {
    rowY.current.set(index, e.nativeEvent.layout.y);
  };

  if (loading && !player) {
    return <HeroJourneyScreenSkeleton />;
  }
  if (!player) return null;
  if (!journey) return <HeroJourneyScreenSkeleton />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
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
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Hero Journey</Text>
            <Text style={styles.subtitle}>Rewards track · progress by upgrading heroes</Text>
          </View>
          <PressableRipple
            onPress={onRefresh}
            disabled={refreshing}
            hitSlop={12}
            style={styles.headerRefreshBtn}
            accessibilityLabel="Refresh hero journey"
            accessibilityRole="button"
          >
            <Ionicons
              name={refreshing ? 'sync-circle' : 'refresh-circle-outline'}
              size={28}
              color={refreshing ? Colors.textTertiary : colors.textSecondary}
            />
          </PressableRipple>
        </View>

        <JourneySummary journey={journey} />

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterInner}>
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.key;
              return (
                <PressableRipple
                  key={opt.key}
                  onPress={() => setFilter(opt.key)}
                  style={[styles.filterChip, active && { backgroundColor: colors.textPrimary }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.filterChipText, { color: active ? Colors.bg : colors.textSecondary }]}>
                    {opt.label}
                  </Text>
                </PressableRipple>
              );
            })}
          </ScrollView>
          {journey.currentMilestone && currentFilteredIndex >= 0 && (
            <PressableRipple
              onPress={scrollToCurrent}
              style={styles.currentBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Scroll to current milestone"
            >
              <MaterialCommunityIcons name="flag" size={15} color={Colors.warning} />
            </PressableRipple>
          )}
        </View>

        {sectionGroups.length === 0 ? (
          <Text style={styles.noResults}>No rewards of this type yet.</Text>
        ) : (
          <View style={styles.timeline}>
            {timelineItems.map((item, si) => {
              if ('parentGroups' in item) {
                const isDone = item.kind === 'done';
                return (
                  <ParentSections
                    key={isDone ? 'sec-done' : 'sec-tail'}
                    groups={item.parentGroups}
                    kind={item.kind}
                    first={si === 0}
                    last={si === timelineItems.length - 1}
                    expanded={expandedSections.has(isDone ? DONE_KEY : TAIL_KEY)}
                    expandedThs={expandedSections}
                    onToggle={() => toggleSection(isDone ? DONE_KEY : TAIL_KEY)}
                    onToggleSection={toggleSection}
                    onRowLayout={onRowLayout}
                    townHallLevel={journey!.townHallLevel}
                  />
                );
              }
              return (
                <JourneySection
                  key={`sec-${item.section.th}`}
                  group={item}
                  first={si === 0}
                  last={si === timelineItems.length - 1}
                  expanded={expandedSections.has(item.section.th)}
                  reachable={item.section.th <= journey!.townHallLevel}
                  onToggle={() => toggleSection(item.section.th)}
                  onRowLayout={onRowLayout}
                />
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function JourneySummary({ journey }: { journey: HeroJourneyData }) {
  const { colors } = useTheme();
  const complete = journey.thCap > 0 && journey.cumulativeLevels >= journey.thCap;
  const reachableTotal = journey.milestones.filter((m) => m.level <= journey.thCap).length;
  const thPercent = journey.thCap > 0 ? (journey.cumulativeLevels / journey.thCap) * 100 : 0;

  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <View style={styles.summaryLevelRow}>
        <View style={styles.summaryLevelGroup}>
          <Text style={[styles.summaryLevelBig, { color: colors.textPrimary }]}>{journey.cumulativeLevels}</Text>
          <View>
            <Text style={styles.summaryLevelLabel}>Cumulative</Text>
            <Text style={styles.summaryLevelSub}>
              Hero Levels · Max {journey.thCap} at TH {journey.townHallLevel}
            </Text>
          </View>
        </View>
        <View style={[styles.summaryPercentPill, { backgroundColor: colors.bgSubtle }]}>
          <Text style={styles.summaryPercentText}>{Math.round(thPercent)}%</Text>
        </View>
      </View>

      <View style={styles.summaryBarWrap}>
        <View style={[styles.summaryBarTrack, { backgroundColor: colors.progressTrack }]}>
          <View
            style={[
              styles.summaryBarFill,
              {
                width: `${Math.max(0, Math.min(thPercent, 100))}%`,
                backgroundColor: journey.currentMilestone && isSpecial(journey.currentMilestone) ? Colors.warning : colors.textSecondary,
              },
            ]}
          />
        </View>
        <Text style={styles.summaryBarLabel}>
          {complete
            ? 'All rewards up to this Town Hall earned!'
            : `Progress within TH ${journey.townHallLevel}: ${Math.round(thPercent)}%`}
        </Text>
      </View>

      {journey.nextMilestone && (
        <View style={[styles.nextCard, { backgroundColor: colors.bgSubtle }]}>
          <RewardIcon
            kind={journey.nextMilestone.kind}
            size={15}
            color={isSpecial(journey.nextMilestone) ? Colors.warning : colors.textSecondary}
            hero={journey.nextMilestone.hero}
          />
          <Text style={styles.nextText} numberOfLines={2}>
            <Text style={styles.nextLevel}>Lv {journey.nextMilestone.level}</Text> · {milestoneLabel(journey.nextMilestone)}
          </Text>
        </View>
      )}

      <View style={styles.summaryChips}>
        <View style={[styles.summaryChip, { backgroundColor: colors.bgSubtle }]}>
          <Text style={styles.summaryChipText}>
            {journey.unlockedCount}/{reachableTotal} rewards unlocked
          </Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: colors.bgSubtle }]}>
          <Text style={styles.summaryChipText}>TH {journey.townHallLevel} · cap {journey.thCap}</Text>
        </View>
        {journey.oreChest && (
          <View style={[styles.summaryChip, { backgroundColor: colors.bgSubtle }]}>
            <ResourceCostChips
              byResource={{
                'Shiny Ore': journey.oreChest.shiny,
                'Glowing Ore': journey.oreChest.glowy,
                'Starry Ore': journey.oreChest.starry,
              }}
              compact
            />
          </View>
        )}
      </View>
    </View>
  );
}

interface JourneySectionProps {
  group: JourneyGroup;
  first: boolean;
  last: boolean;
  expanded: boolean;
  reachable: boolean;
  onToggle: () => void;
  onRowLayout: (index: number) => (e: LayoutChangeEvent) => void;
}

function JourneySection({ group, first, last, expanded, reachable, onToggle, onRowLayout }: JourneySectionProps) {
  const { colors } = useTheme();
  const { section, rows } = group;
  const locked = !reachable;
  const claimed = rows.filter((r) => r.ms.claimState === 'claimed').length;
  const allClaimed = rows.length > 0 && claimed === rows.length;
  const thImage = getTownHallImageSource(section.th);
  const desc = `Levels ${section.minLevel}-${section.maxLevel}`;

  return (
    <>
      <SettingRow
        iconSource={thImage ?? undefined}
        title={`Town Hall ${section.th}`}
        desc={desc}
        isFirst={first || expanded}
        isLast={last && !expanded}
        onPress={onToggle}
        compact
      >
        <View style={styles.sectionBadges}>
          {section.newHeroes.map((name) => (
            <View key={name} style={styles.sectionNewHeroBadge}>
              <Image source={HERO_IMAGES[name]} style={styles.sectionNewHeroImg} resizeMode="contain" />
            </View>
          ))}
          <View style={[
            styles.sectionBadge,
            allClaimed && styles.sectionBadgeMaxed,
            (last && !expanded) && { borderBottomRightRadius: Radius.xl },
            (first || expanded) && { borderTopRightRadius: Radius.xl }

          ]}>
            {locked ? (
              <Image source={lockedImage} style={styles.sectionBadgeLockedImg} resizeMode="contain" />
            ) : allClaimed ? (
              <Ionicons name="checkmark-circle" size={18} color={Colors.bg} />
            ) : (
              <>
                <Text style={styles.sectionBadgeText}>{claimed}</Text>
                <Text style={styles.sectionBadgeLabel}>/ {rows.length}</Text>
              </>
            )}
          </View>
          {false && <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={reachable ? colors.textSecondary : Colors.warning}
          />}
        </View>
      </SettingRow>
      {expanded && (
        <View style={styles.sectionBody}>
          {rows.map((row, ri) => (
            <MilestoneRow
              key={`${row.ms.level}-${row.ms.kind}`}
              ms={row.ms}
              index={row.index}
              first={ri === 0}
              last={ri === rows.length - 1}
              onLayout={onRowLayout(row.index)}
            />
          ))}
          {!last && <View style={styles.sectionSeparator} />}
        </View>
      )}
    </>
  );
}

function ParentSections({
  groups,
  kind,
  first,
  last,
  expanded,
  expandedThs,
  onToggle,
  onToggleSection,
  onRowLayout,
  townHallLevel,
}: {
  groups: JourneyGroup[];
  kind: 'done' | 'tail';
  first: boolean;
  last: boolean;
  expanded: boolean;
  expandedThs: ReadonlySet<number>;
  onToggle: () => void;
  onToggleSection: (th: number) => void;
  onRowLayout: (index: number) => (e: LayoutChangeEvent) => void;
  townHallLevel: number;
}) {
  const done = kind === 'done';
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const minTh = groups[0].section.th;
  const maxTh = groups[groups.length - 1].section.th;
  const title = maxTh > minTh ? `Town Hall ${minTh}–${maxTh}` : `Town Hall ${minTh}`;
  const desc = done
    ? `${groups.length} section${groups.length > 1 ? 's' : ''} completed · ${total} rewards`
    : `${groups.length} sections ahead`;
  return (
    <>
      <SettingRow
        title={title}
        desc={desc}
        iconSource={done ? heroJourneyImage : lockedImage}
        isFirst={first || expanded}
        isLast={last && !expanded}
        onPress={onToggle}
        compact
      >
        <View style={styles.sectionBadges}>
          <View style={[
            styles.sectionBadge,
            done && styles.sectionBadgeMaxed,
            (last && !expanded) && { borderBottomRightRadius: Radius.xl },
            (first || expanded) && { borderTopRightRadius: Radius.xl },
          ]}>
            {done ? (
              <Ionicons name="checkmark-done" size={18} color={Colors.bg} />
            ) : (
              <Image source={lockedImage} style={styles.sectionBadgeLockedImg} resizeMode="contain" />
            )}
          </View>
        </View>
      </SettingRow>
      {expanded && (
        <View style={styles.parentBody}>
          {groups.map((group, gi) => (
            <JourneySection
              key={`sec-${group.section.th}`}
              group={group}
              first={gi === 0}
              last={gi === groups.length - 1}
              expanded={expandedThs.has(group.section.th)}
              reachable={group.section.th <= townHallLevel}
              onToggle={() => onToggleSection(group.section.th)}
              onRowLayout={onRowLayout}
            />
          ))}
        </View>
      )}
    </>
  );
}

function MilestoneRow({
  ms,
  index,
  first,
  last,
  onLayout,
}: {
  ms: HeroJourneyMilestone;
  index: number;
  first?: boolean;
  last?: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const { colors } = useTheme();
  const unlocked = ms.unlocked;
  const special = isSpecial(ms);
  const quest = isQuest(ms);

  const specialColored = special && unlocked;
  const titleColor = specialColored ? Colors.warning : unlocked ? colors.textPrimary : colors.textTertiary;
  const equipmentClaimed = ms.kind === 'equipment' && ms.claimState === 'claimed';
  const extraDesc = milestoneDesc(ms);

  const equipImage =
    ms.kind === 'equipment' && ms.rewardEquip ? getArmyItemImage(ms.rewardEquip) : null;
  const equipIcon =
    equipImage != null ? <Image source={equipImage} style={styles.milestoneImg} resizeMode="contain" />
      : null;

  return (
    <View
      style={[
        styles.milestoneRow,
        first && styles.milestoneRowFirst,
        last && styles.milestoneRowLast,
      ]}
      onLayout={onLayout}
    >
      {ms.isCurrent && <View pointerEvents="none" style={styles.milestoneRowTint} />}
      <View
        style={[
          styles.milestonePill,
          last && styles.milestonePillLast,
          { backgroundColor: ms.isCurrent ? Colors.warning : colors.bgCardHover },
        ]}
      >
        <Text
          style={[
            styles.milestonePillNum,
            { color: unlocked ? (ms.isCurrent ? Colors.bg : colors.textPrimary) : colors.textTertiary },
          ]}
        >
          {ms.level}
        </Text>
      </View>

      <View
        style={[
          styles.milestoneIcon,
          { backgroundColor: ms.isCurrent ? Colors.warning : colors.bgCardHover },
        ]}
      >
        {quest ? (
          <Image source={chestImage} style={styles.milestoneImg} resizeMode="contain" />
        ) : ms.kind === 'equipment' && !ms.rewardEquip ? (
          <RewardIcon kind="starryOre" size={18} color={Colors.warning} />
        ) : (
          equipIcon ?? <RewardIcon kind={ms.kind} size={17} color={special ? Colors.warning : colors.textSecondary} hero={ms.hero} />
        )}
      </View>

      <View style={styles.milestoneBody}>
        <View style={styles.milestoneTitleRow}>
          <Text style={[styles.milestoneTitle, { color: titleColor }]} numberOfLines={2}>
            {milestoneLabel(ms)}
          </Text>
        </View>

        {quest && (
          <Text style={[styles.milestoneQuestDesc, { color: colors.textTertiary }]}>
            15★ · 14d
          </Text>
        )}

        {extraDesc && (
          <Text style={[styles.milestoneQuestDesc, { color: colors.textTertiary }]}>
            {extraDesc}
          </Text>
        )}

        {equipmentClaimed && (
          <View style={styles.milestoneClaimedRow}>
            <Ionicons name="checkmark-circle" size={11} color={Colors.success} />
            <Text style={[styles.milestoneQuestDesc, { color: Colors.success }]}>Claimed</Text>
          </View>
        )}
      </View>

      {!unlocked &&
        <View style={[styles.sectionBadge, last && {
          borderBottomRightRadius: Radius.lg,
        }]}>
          <Image source={lockedImage} style={styles.sectionBadgeLockedImg} resizeMode="contain" />

        </View>
      }

      {ms.isCurrent &&
        <View style={
          [
            styles.sectionBadge,
            { backgroundColor: Colors.warning + '20' },
            last && {
              borderBottomRightRadius: Radius.lg,
            }
          ]
        }>
          <Ionicons name="flag" size={12} color={special && unlocked ? Colors.warning : colors.textSecondary} />
        </View>
      }

      {(!ms.isCurrent && unlocked) &&
        <View style={
          [
            styles.sectionBadge,
            { backgroundColor: Colors.successGhost },
            last && {
              borderBottomRightRadius: Radius.lg,
            }
          ]
        }>
          <Ionicons name="checkmark" size={14} color={special && unlocked ? Colors.warning : colors.textSecondary} />
        </View>
      }

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingBottom: Spacing.section,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  headerRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    padding: Spacing.base,
    borderRadius: Radius.xxl,
    borderWidth: 0.75,
    gap: Spacing.sm,
  },
  summaryLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLevelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryLevelBig: {
    ...Typography.title1,
    fontSize: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summaryLevelLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryLevelSub: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 11,
  },
  summaryPercentPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
  },
  summaryPercentText: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summaryBarWrap: {
    gap: 4,
  },
  summaryBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  summaryBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  summaryBarLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 11,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  nextText: {
    flex: 1,
    ...Typography.footnote,
    color: Colors.textSecondary,
  },
  nextLevel: {
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  summaryChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  summaryChipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  filterInner: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  filterChipText: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  currentBtn: {
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    borderWidth: 0.75,
    borderColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResults: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginVertical: Spacing.xl,
  },
  timeline: {
    paddingHorizontal: Spacing.base,
    gap: Spacing.xs,
  },
  sectionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionNewHeroBadge: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionNewHeroImg: {
    width: 32,
    height: 32,
  },
  sectionBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  sectionBadgeMaxed: {
    backgroundColor: Colors.warning,
  },
  sectionBadgeLockedImg: {
    width: 18,
    height: 18,
    opacity: 0.7,
  },
  sectionBadgeText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sectionBadgeLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
    opacity: 0.7,
    fontVariant: ['tabular-nums'],
  },
  sectionBody: {
    paddingTop: 0,
  },
  parentBody: {
    gap: Spacing.xs,
  },
  sectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    margin: Spacing.lg,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
  },
  milestoneRowFirst: {
    borderTopLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.sm,
  },
  milestoneRowLast: {
    borderBottomLeftRadius: Radius.xl * 1.25,
    borderBottomRightRadius: Radius.xl * 1.25,
  },
  milestoneRowTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.warning + '14',
  },
  milestonePill: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestonePillFirst: {
    borderTopLeftRadius: Radius.lg,
  },
  milestonePillLast: {
    borderBottomLeftRadius: Radius.lg,
  },
  milestonePillNum: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  milestoneIcon: {
    width: 34,
    height: 34,
    padding: 5,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneImg: {
    width: 22,
    height: 22,
  },
  milestoneBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  milestoneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  milestoneTitle: {
    flex: 1,
    ...Typography.footnote,
    fontWeight: '700',
  },
  milestoneQuestDesc: {
    marginTop: 2,
    ...Typography.caption,
    fontWeight: '600',
  },
  milestoneClaimedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
});