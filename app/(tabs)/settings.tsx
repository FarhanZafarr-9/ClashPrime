import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Linking,
  Share,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
} from 'react-native';
import PressableRipple from '../../src/components/PressableRipple';
import { SettingRow } from '../../src/components/SettingRow';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { openURL } from 'expo-linking';
import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { getTownHallImageUrl } from '../../src/utils/thImages';
import { seedBuildingLevelsForTH } from '../../src/utils/seedBuildingLevels';
const heartImg = require('../../images/heart.png') as any;
import type { ClashPlayer } from '../../src/types/clash';
import { ClashAPI } from '../../src/api/clash';
import {
  getPlayerTag,
  setPlayerTag,
  getApiToken,
  setApiToken,
  clearAppCache,
  exportAppData,
  saveAccount,
  removeAccount,
  getAccounts,
  cachePlayer,
} from '../../src/hooks/usePlayer';
import { usePlayer, usePlayerActions } from '../../src/hooks/usePlayerContext';
import { useGameData } from '../../src/hooks/useGameData';
import { useDialog } from '../../src/components/AlertDialog';
import { useDiscounts } from '../../src/hooks/useDiscounts';
import type { ScopeDiscount } from '../../src/hooks/useDiscounts';
import DiscountModal from '../../src/components/DiscountModal';
import Constants from 'expo-constants';
import { checkForUpdateAsync, fetchUpdateAsync, reloadAsync } from 'expo-updates';
import {Switch} from 'react-native-paper'

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function SettingCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.settingCard}>
      {children}
    </View>
  );
}

interface ContentAction {
  label: string;
  onPress?: () => void;
  primary?: boolean;
}

const DATA_SOURCES: { name: string; use: string }[] = [
  { name: 'Clash of Clans API', use: 'Player stats & progress' },
  { name: 'ClashLy', use: 'Base layout library & ratings' },
  { name: 'ClashArmies', use: 'Community army compositions & sharing' },
  { name: 'clash-of-clans-data (npm)', use: 'Troop, hero, spell, pet, equipment, siege machine & building data (levels, costs, stats, images)' },
  { name: 'clash.ninja', use: 'In-game events & TH max levels (fallback)' },
];

const PRIVACY_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Overview',
    body: 'ClashPrime is an unofficial Clash of Clans companion app. This privacy policy explains what data the app handles and how it is used.',
  },
  {
    title: 'Data We Access',
    body: 'To show your village progress, the app stores the Clash of Clans player tag and API token you provide, along with cached player data. This information stays on your device and is only sent directly to the official Clash of Clans API to fetch your profile.',
  },
  {
    title: 'Third-Party Services',
    body: 'Player data is retrieved from the official Clash of Clans API using your token. Reference content such as base layouts, building/troop/hero/spell/pet/equipment data, events and community armies is fetched from public sources including ClashLy, ClashArmies, clash.ninja and the clash-of-clans-data npm package (canonical Supercell data).',
  },
  {
    title: 'Local Storage',
    body: 'Your player tag, API token and downloaded content are stored locally on your device using AsyncStorage. We do not operate servers that collect, transmit or sell your personal information.',
  },
  {
    title: 'Your Control',
    body: 'You can update or remove your player tag and API token at any time in Settings, and clear the local cache from the Data section. Uninstalling the app removes all locally stored data.',
  },
  {
    title: 'Contact',
    body: 'Questions about this policy can be sent to farhanzafarr.9@gmail.com.',
  },
];

const FEEDBACK_EMAIL = 'farhanzafarr.9@gmail.com';

const CHANGELOG: { version: string; date: string; items: string[] }[] = [
  {
    version: '5.0.0',
    date: 'August 17, 2026',
    items: [
      'Complete data migration to clash-of-clans-data npm package — all building images, troop/hero/spell/pet/equipment/siege machine data, levels, costs, stats, and TH/BH max levels now come from canonical Supercell data.',
      'Removed ~1000 local .webp building images and 1200 lines of auto-generated asset mapping — app size reduced from 535 MB to ~40 MB archive.',
      'Building stats, copy counts, max levels, upgrade costs now use package data via buildingData.ts/armyData.ts — no more Fandom scraping or local JSON fallbacks.',
      'Troop/hero/spell/pet/equipment detail panels use package data (armyData.ts) — no more Fandom wiki scraping, instant load, per-resource cost breakdown.',
      'New Import Building Levels screen (Settings → Import) — paste a Clash of Clans JSON export to bulk-set all building levels and copies.',
      'Generator scripts: npm run gen:images (WebP images with correct extension), npm run gen:coc-ids (building ID mapping).',
      'League loot/bonus/ore info from package (leagueData.ts).',
      'Account management improvements: ensureAccountRegistered, cachePlayer, mergeBuildingCopies, applyLevelsToAccount.',
    ],
  },
  {
    version: '4.5.0',
    date: 'August 11, 2026',
    items: [
      'War tab: enemy member list with the same grouped rows and colors, a heuristic Attack Plan card — your mirror plus the top targets with expected stars, cleanup estimates and Best/Mirror/Cleanup/Risky tags — and a collapsible legend for the attack and defense colors.',
      'Home tab: Progress Overview, Buildings and Backlog now nest into collapsible sections with progress bars, so the whole village fits on one screen.',
      'Buildings tab: bulk Max out all buildings action with a confirmation summary of every category affected.',
      'Home polish: quick actions as compact setting rows, softer borderless profile card, and rounded corners that now match across section headers, badges and icons.',
    ],
  },
  {
    version: '4.3.0',
    date: 'August 9, 2026',
    items: [
      'Buildings tab tracks every copy of multi-copy buildings individually — Cannons, Archer Towers, Walls, Traps and more are grouped into collapsible sections with a per-building progress bar, aggregate remaining cost/time and level badges.',
      'Quick upgrade/downgrade controls on each building card: tap ▲ to upgrade, hold ▲ to max out, tap ▼ to downgrade — no need to expand the card.',
      'Building copy counts come straight from the Clash of Clans wiki (per-TH and per-BH), so new copies unlocked at higher Town Halls seed correctly at level 1.',
    ],
  },
  {
    version: '4.2.0',
    date: 'August 7, 2026',
    items: [
      'Player inspect screen — search any player by tag to view their stats, army, achievements and clan, copy their tag, add them to your accounts or open their profile in-game.',
      'Home screen rebuilt into collapsible sections: Progress Overview, a Backlog of locked and rushed upgrades, Quick Stats and Active Timers.',
      'Builder timers scoped per account, with an improved active-timers section and a redesigned new-timer modal.',
      'Achievements rows and summary restyled to match the settings rows, grouped by stars with corner rounding.',
      'Highlight your own member in war and CWL member lists, plus polished expanded war detail sections.',
      'Supercell Store deep-link banner on the Events tab.',
      'Home tab polish: header open-in-game button, rounded icon and badge corners, smarter empty-timers banner.',
      'Home skeleton loading reworked for the new collapsible layout, and shared SettingRow component powering Home, Player, Achievements and Settings.',
    ],
  },
  {
    version: '4.1.0',
    date: 'August 5, 2026',
    items: [
      'Live Clan War League rounds on the War tab — follow each round, its result and expandable per-member breakdowns.',
      'War tab list redesign: grouped member rows with attack dots and defense shields, rounded list corners and tighter spacing.',
      'Onboarding Town Hall picker rebuilt as an image gallery with a current-TH badge.',
      'Add Account (Full Setup) walks you through connecting a new village from Settings.',
      'Saved armies now render as full cards with share actions.',
      'Building and army discounts moved into Settings with clearer scopes.',
      'New What\u2019s New and Developer Info sections in Settings.',
    ],
  },
  {
    version: '4.0.0',
    date: 'August 1, 2026',
    items: [
      'Floating rounded bottom navigation with a More menu for the full tab set.',
      'Progress rebuilt as a weighted average with locked items shown at their next available level.',
      'Pinned countdown timers with system notifications.',
      'War tab enriched with per-member attack details and an expanded result table.',
      'Multi-account polish: smooth account-switch fade, building downgrade support and Town Hall input during onboarding.',
      'Settings redesigned into grouped cards with separated rows.',
    ],
  },
  {
    version: '3.0.0',
    date: 'July 27, 2026',
    items: [
      'Multi-account support: account registry, one-tap switching and per-account storage.',
      'Account switcher with list, add and remove directly on the Home tab.',
      'Settings refactored around the new account system with name backfill for existing players.',
    ],
  },
  {
    version: '2.0.0',
    date: 'July 23, 2026',
    items: [
      'Dynamic light/dark theme engine — switch instantly, every screen follows.',
      'Animated skeleton loading screens for Home, Profile, Bases and Events.',
      'Fandom Wiki as the primary troop, hero and pet detail source with inline detail panels.',
      'Building level data scraper and stat tables inside expanded building cards.',
      'Home quick-stats table with Town Hall avatar, plus Privacy Policy and Feedback dialogs.',
      'EAS build profiles for side-by-side dev and production installs.',
    ],
  },
  {
    version: '1.0.0',
    date: 'July 19, 2026',
    items: [
      'ClashPrime launch — the full Clash of Clans companion app.',
      'Home dashboard with progress cards, quick actions and quick stats.',
      'Army tab with troops, heroes, spells and pet details.',
      'Buildings tab covering 80+ structures with level progression.',
      'Base library powered by ClashLy and in-game events with countdowns.',
      'Credits and data sources documented in-app.',
    ],
  },
];

const DEVELOPER_PROJECTS: { name: string; blurb: string }[] = [
  { name: 'FlexPrime', blurb: 'Academic companion for FASTians — marks analytics, attendance risk, GPA tools and past papers, shipped to Google Play.' },
  { name: 'NotePrime', blurb: 'Material You fork of Note Safe — end-to-end encrypted, local-first notes with a privacy shield and biometric lock.' },
  { name: 'ClashPrime', blurb: 'This app — a premium Clash of Clans companion built in React Native + Expo.' },
  { name: 'Timers', blurb: 'Android multi-timer app with reliable notifications and zero bloat.' },
];

const DEV_AVATAR_URL = 'https://avatars.githubusercontent.com/u/94292576?v=4';
const GITHUB_PROFILE_URL = 'https://github.com/FarhanZafarr-9';
const CLASHPRIME_REPO_URL = 'https://github.com/FarhanZafarr-9/ClashPrime';

export default function SettingsScreen() {
  const router = useRouter();
  const appVersion = `v${(Constants.expoConfig as any)?.version ?? '4.5.0'}`;
  const { bumpTagVersion } = usePlayerActions();
  const { switchAccount, refreshAccounts, accounts, activeAccount, prefetchAccount, syncingTag } = usePlayer();
  const { show: showDialog, Dialog } = useDialog();
  const [playerTag, setPlayerTagState] = useState('');
  const [apiToken, setApiTokenState] = useState('');
  const { isDark, colors, setThemeMode } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'tag' | 'token'>('tag');
  const [modalTitle, setModalTitle] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [modalPlaceholder, setModalPlaceholder] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalOnSave, setModalOnSave] = useState<(text: string) => void>(() => { });
  const modalInputRef = useRef<TextInput>(null);

  const [contentVisible, setContentVisible] = useState(false);
  const [contentTitle, setContentTitle] = useState('');
  const [contentBody, setContentBody] = useState<React.ReactNode>(null);
  const [contentActions, setContentActions] = useState<ContentAction[]>([]);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<'tag' | 'profile' | 'thPicker'>('tag');
  const [onboardingTag, setOnboardingTag] = useState('');
  const [onboardingThLevel, setOnboardingThLevel] = useState('');
  const [onboardingPlayer, setOnboardingPlayer] = useState<ClashPlayer | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [discountModalScope, setDiscountModalScope] = useState<'buildings' | 'army' | null>(null);
  const { refresh: refreshGameData } = useGameData();
  const { discounts, setBuildingCost, setBuildingTime, setArmyCost, setArmyTime, resetDiscounts } = useDiscounts();

  const discountDesc = (s: ScopeDiscount) => {
    const parts: string[] = [];
    if (s.costPercent > 0) parts.push(`Cost -${s.costPercent}%`);
    if (s.timePercent > 0) parts.push(`Time -${s.timePercent}%`);
    return parts.length ? parts.join(' · ') : 'No discounts set';
  };

  const maskSecret = (value: string) => value ? '•'.repeat(Math.min(value.length, 24)) : '';

  const handleSwitchAccount = async (tag: string) => {
    if (tag === activeAccount?.tag) return;
    setSwitchingAccount(true);
    await switchAccount(tag);
    const t = await getPlayerTag(tag);
    setPlayerTagState(t);
    setSwitchingAccount(false);
  };

  useEffect(() => {
    getPlayerTag().then((tag) => {
      setPlayerTagState(tag);
      if (!tag) setShowOnboarding(true);
    });
    getApiToken().then((t) => {
      setApiTokenState(maskSecret(t));
    });
  }, []);

  const openModal = (type: 'tag' | 'token', title: string, placeholder: string, current: string, onSave: (text: string) => void) => {
    setModalType(type);
    setModalTitle(title);
    setModalValue(current);
    setModalPlaceholder(placeholder);
    setModalError('');
    setModalOnSave(() => onSave);
    setModalVisible(true);
    setTimeout(() => modalInputRef.current?.focus(), 300);
  };

  const showContent = (title: string, body: React.ReactNode, actions: ContentAction[]) => {
    setContentTitle(title);
    setContentBody(body);
    setContentActions(actions.length ? actions : [{ label: 'Close' }]);
    setContentVisible(true);
  };

  const handleEditTag = () => {
    openModal('tag', 'Player Tag', '#PG8U2LR00', playerTag, async (text) => {
      const trimmed = text.trim();
      if (!trimmed) { setModalError('Tag cannot be empty'); return; }
      const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
      await setPlayerTag(prefixed);
      setPlayerTagState(prefixed);
      bumpTagVersion();
      setModalVisible(false);
    });
  };

  const handleEditToken = () => {
    openModal('token', 'API Token', 'Paste your API token', '', async (text) => {
      const trimmed = text.trim();
      if (!trimmed) { setModalError('Token cannot be empty'); return; }
      await setApiToken(trimmed);
      setApiTokenState(maskSecret(trimmed));
      bumpTagVersion();
      setModalVisible(false);
    });
  };

  const probeConnectivity = async (): Promise<boolean> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch('https://u.expo.dev/', { method: 'HEAD', signal: controller.signal });
      return res.status > 0;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const handleCheckUpdates = async () => {
    const variant = (Constants.expoConfig as any)?.extra?.variant;
    if (variant === 'development' || __DEV__) {
      showDialog({
        title: 'Development Build',
        message: 'Over-the-air updates only apply to release builds. You are running a development build, so updates arrive by installing a new build (EAS or `expo run`) — not through the update channel.',
        actions: [{ label: 'Got It', primary: true, onPress: () => {} }],
      });
      return;
    }

    setCheckingUpdates(true);
    try {
      const online = await probeConnectivity();
      if (!online) {
        showDialog({
          title: 'No Internet Connection',
          message: 'Could not reach the update server. Check your Wi-Fi or mobile data, then try again.',
          actions: [{ label: 'OK', primary: true, onPress: () => {} }],
        });
        return;
      }

      try {
        const update = await checkForUpdateAsync();
        if (update.isAvailable) {
          showDialog({
            title: 'Update Available',
            message: 'A new update is ready for this channel. Tap Install to download and apply it now — you will return to the app once it is applied.',
            actions: [
              { label: 'Later', onPress: () => {} },
              { label: 'Install', primary: true, onPress: async () => { await fetchUpdateAsync(); await reloadAsync(); } },
            ],
          });
        } else {
          showDialog({ title: "You're Up to Date", message: 'ClashPrime is running the latest available update for this channel.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
        }
      } catch {
        showDialog({
          title: 'Update Check Failed',
          message: 'The update server was reachable but the check could not complete. This can happen if the update channel is misconfigured or the Expo servers are busy. Please try again in a moment.',
          actions: [{ label: 'OK', primary: true, onPress: () => {} }],
        });
      }
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleClearCache = async () => {
    await clearAppCache();
    bumpTagVersion();
    showDialog({ title: 'Cache Cleared', message: 'Local cache has been cleared successfully.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
  };

  const handleExportData = async () => {
    try {
      const data = await exportAppData();
      await Share.share({
        message: data,
        title: 'ClashPrime Export',
      });
    } catch {
      showDialog({ title: 'Export Failed', message: 'Could not export data. Please try again.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
    }
  };

  const handleOnboardingSave = async () => {
    if (onboardingStep === 'tag') {
      const tag = onboardingTag;
      if (!tag || !tag.startsWith('#')) return;
      const existing = accounts.find((a) => a.tag === tag);
      if (existing) {
        showDialog({
          title: 'Account Already Added',
          message: `${tag} is already in your account list. Switch to it instead.`,
          actions: [
            { label: 'Cancel', onPress: () => {} },
            { label: 'Switch', primary: true, onPress: async () => {
              await handleSwitchAccount(existing.tag);
              setShowOnboarding(false);
              setOnboardingStep('tag');
            }},
          ],
        });
        return;
      }
      const token = await getApiToken();
      if (!token) {
        showDialog({ title: 'No API Token', message: 'You need to set up an API token first before adding accounts.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
        return;
      }
      try {
        const api = new ClashAPI(token);
        const data = await api.getPlayer(tag);
        setOnboardingPlayer(data);
        setOnboardingStep('profile');
      } catch (e: any) {
        showDialog({ title: 'Failed to Fetch Profile', message: e.message || 'Check your API token and player tag.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
      }
      return;
    }

    if (onboardingStep === 'profile') {
      // User confirmed profile, go to TH picker
      setOnboardingStep('thPicker');
      return;
    }

    if (onboardingStep === 'thPicker') {
      const tag = onboardingTag;
      const player = onboardingPlayer;
      if (!tag || !player) return;

      const token = await getApiToken();
      if (!token) return;

      const thLevel = parseInt(onboardingThLevel, 10);
      const currentTh = player.townHallLevel || 16;
      const levels = seedBuildingLevelsForTH(player, Number.isFinite(thLevel) && thLevel > 0 ? thLevel : currentTh, { currentTh });

      await setPlayerTag(tag);
      await setApiToken(token, tag);
      await saveAccount({
        tag,
        name: player.name,
        townHallLevel: player.townHallLevel,
        addedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      });
      const updatedPlayer = { ...player, buildingLevels: levels, lastMaxedTH: Number.isFinite(thLevel) && thLevel > 0 ? thLevel : currentTh };
      await cachePlayer(updatedPlayer, tag);
      await refreshAccounts();

      setShowOnboarding(false);
      setOnboardingTag('');
      setOnboardingThLevel('');
      setOnboardingPlayer(null);
      setOnboardingStep('tag');

      // Don't yank the user to the new account unless it's the first one.
      const storedAccounts = await getAccounts();
      await prefetchAccount(tag, { token, th: Number.isFinite(thLevel) && thLevel > 0 ? thLevel : currentTh, switch: storedAccounts.length === 0 });
    }
  };

  const openAbout = () => {
    showContent(
      'About ClashPrime',
      (
        <View>
          <View style={styles.creditHero}>
            <View style={styles.creditAvatar}>
              <Ionicons name="shield" size={26} color={Colors.textPrimary} />
            </View>
            <View style={styles.creditHeroText}>
              <Text style={styles.creditName}>ClashPrime {appVersion}</Text>
              <Text style={styles.creditHandle}>Premium Clash of Clans companion</Text>
            </View>
          </View>
          <Text style={styles.creditBlurb}>
            ClashPrime is an unofficial, community-built companion for Clash of Clans. It brings your village progress, war performance and favorite game references together in one clean, fast app — no ads, no clutter, just the data that matters.
          </Text>
          <Text style={styles.creditSectionTitle}>What it does</Text>
          {[
            { icon: 'trending-up-outline', title: 'Progress Tracking', body: 'Tracks every troop, spell, hero and building against your town hall, with a weighted max-out score so you always know what is next.' },
            { icon: 'timer-outline', title: 'Pinned Timers', body: 'Set countdowns for upgrades and boosts, with reminders delivered as system notifications.' },
            { icon: 'flag-outline', title: 'War Center', body: 'Follow the current war, per-member attacks and defenses, plus a searchable war history split into regular wars and CWL.' },
            { icon: 'git-network-outline', title: 'Base & Army Hub', body: 'Browse community base layouts, armies, super troops, pets and in-game events — all kept up to date.' },
            { icon: 'swap-horizontal-outline', title: 'Multi-Account', body: 'Switch between several villages with one tap. Each account keeps its own progress, cache and timers.' },
          ].map((f) => (
            <View style={styles.aboutFeatureRow} key={f.title}>
              <Ionicons name={f.icon as any} size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
              <View style={styles.creditSourceText}>
                <Text style={styles.creditSourceName}>{f.title}</Text>
                <Text style={styles.creditSourceUse}>{f.body}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.creditSectionTitle}>Data sources</Text>
          {DATA_SOURCES.map((s) => (
            <View style={styles.creditSourceRow} key={s.name}>
              <Ionicons name="link-outline" size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
              <View style={styles.creditSourceText}>
                <Text style={styles.creditSourceName}>{s.name}</Text>
                <Text style={styles.creditSourceUse}>{s.use}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.policyTitle}>Disclaimer</Text>
          <Text style={styles.policyBody}>
            ClashPrime is an independent project and is not affiliated with or endorsed by Supercell. Supercell's trademarks and the Clash of Clans brand are used with permission where applicable.
          </Text>
        </View>
      ),
      [
        { label: 'Credits', onPress: openCredits },
        { label: 'View on GitHub', primary: true, onPress: () => openURL('https://github.com/FarhanZafarr-9/ClashPrime') },
        { label: 'Close' },
      ],
    );
  };

  const openCredits = () => {
    showContent(
      'Credits',
      (
        <View>
          <View style={styles.creditHero}>
            <View style={styles.creditAvatar}>
              <Ionicons name="logo-github" size={26} color={Colors.textPrimary} />
            </View>
            <View style={styles.creditHeroText}>
              <Text style={styles.creditName}>Farhan Zafar</Text>
              <Text style={styles.creditHandle}>@FarhanZafarr-9</Text>
            </View>
          </View>
          <Text style={styles.creditBlurb}>
            ClashPrime is an unofficial Clash of Clans companion, built to give players a clean, fast way to track progress and discover bases.
          </Text>
          <Text style={styles.creditSectionTitle}>Data Sources</Text>
          {DATA_SOURCES.map((s) => (
            <View style={styles.creditSourceRow} key={s.name}>
              <Ionicons name="link-outline" size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
              <View style={styles.creditSourceText}>
                <Text style={styles.creditSourceName}>{s.name}</Text>
                <Text style={styles.creditSourceUse}>{s.use}</Text>
              </View>
            </View>
          ))}
          <View style={styles.creditMadeRow}>
            <Text style={styles.creditMadeText}>Made with </Text>
            <Image source={heartImg} style={styles.creditHeart} />
            <Text style={styles.creditMadeText}> by Parzival</Text>
          </View>
        </View>
      ),
      [
        {
          label: 'View on GitHub',
          primary: true,
          onPress: () => openURL('https://github.com/FarhanZafarr-9'),
        },
        { label: 'Close' },
      ],
    );
  };

  const openPrivacy = () => {
    showContent(
      'Privacy Policy',
      (
        <View>
          {PRIVACY_SECTIONS.map((s) => (
            <View style={styles.policyBlock} key={s.title}>
              <Text style={styles.policyTitle}>{s.title}</Text>
              <Text style={styles.policyBody}>{s.body}</Text>
            </View>
          ))}
        </View>
      ),
      [{ label: 'Close', primary: true }],
    );
  };

  const openFeedback = () => {
    showContent(
      'Send Feedback',
      (
        <View>
          <Text style={styles.feedbackText}>
            We'd love to hear from you — bug reports, feature ideas, or just a hello.
          </Text>
          <View style={styles.feedbackEmailRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />
            <Text style={styles.feedbackEmail}>{FEEDBACK_EMAIL}</Text>
          </View>
          <Text style={styles.feedbackNote}>
            Tap "Email Us" to open your mail app, or copy the address above.
          </Text>
        </View>
      ),
      [
        {
          label: 'Email Us',
          primary: true,
          onPress: () => openURL(`mailto:${FEEDBACK_EMAIL}`),
        },
        { label: 'Close' },
      ],
    );
  };

  const openChangelog = () => {
    showContent(
      'What\u2019s New',
      (
        <View>
          {CHANGELOG.map((entry) => (
            <View style={styles.changelogEntry} key={entry.version}>
              <View style={styles.changelogVersionRow}>
                <Text style={styles.changelogVersion}>v{entry.version}</Text>
                <Text style={styles.changelogDate}>{entry.date}</Text>
              </View>
              {entry.items.map((item) => (
                <View style={styles.changelogItem} key={item}>
                  <View style={styles.changelogDot} />
                  <Text style={styles.changelogItemText}>{item}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ),
      [{ label: 'Close', primary: true }],
    );
  };

  const openDeveloper = () => {
    showContent(
      'Developer Info',
      (
        <View>
          <View style={styles.creditHero}>
            <View style={styles.devAvatar}>
              <Image source={{ uri: DEV_AVATAR_URL }} style={styles.devAvatarImg} />
            </View>
            <View style={styles.creditHeroText}>
              <Text style={styles.creditName}>Farhan Zafar</Text>
              <Text style={styles.creditHandle}>@FarhanZafarr-9</Text>
            </View>
          </View>
          <Text style={styles.devTagline}>
            every pixel intentional · every commit counts · every detail ships
          </Text>
          <Text style={styles.creditBlurb}>
            Mobile and full-stack developer, currently on a BS in Data Science at FAST-NUCES Lahore. I ship real apps — React Native, Flutter and full-stack web — and obsess over the details users actually feel.
          </Text>
          <Text style={styles.creditSectionTitle}>Featured projects</Text>
          {DEVELOPER_PROJECTS.map((p) => (
            <View style={styles.devProjectRow} key={p.name}>
              <Ionicons name="code-slash-outline" size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
              <View style={styles.creditSourceText}>
                <Text style={styles.creditSourceName}>{p.name}</Text>
                <Text style={styles.creditSourceUse}>{p.blurb}</Text>
              </View>
            </View>
          ))}
          <Text style={styles.creditSectionTitle}>What I do</Text>
          {[
            { icon: 'phone-portrait-outline', title: 'Mobile Dev', body: 'React Native · Expo · Flutter' },
            { icon: 'globe-outline', title: 'Full Stack Web', body: 'React · Node.js · Express · SQL' },
            { icon: 'analytics-outline', title: 'Data Science', body: 'Python · PyTorch · scikit-learn · NumPy' },
          ].map((s) => (
            <View style={styles.aboutFeatureRow} key={s.title}>
              <Ionicons name={s.icon as any} size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
              <View style={styles.creditSourceText}>
                <Text style={styles.creditSourceName}>{s.title}</Text>
                <Text style={styles.creditSourceUse}>{s.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ),
      [
        {
          label: 'GitHub',
          onPress: () => openURL(GITHUB_PROFILE_URL),
        },
        {
          label: 'ClashPrime Repo',
          onPress: () => openURL(CLASHPRIME_REPO_URL),
        },
        { label: 'Close', primary: true },
      ],
    );
  };

  const openBuildDiagnostics = () => {
    const expo = (Constants.expoConfig as any) ?? {};
    const extra = expo.extra ?? {};
    const easBuild = extra.eas?.build ?? {};
    const rows: { label: string; value: string }[] = [
      { label: 'App Version', value: expo.version ? `v${expo.version}` : '—' },
      { label: 'Build Number', value: String(easBuild.runNumber ?? Constants.nativeBuildVersion ?? '—') },
      { label: 'Expo SDK', value: expo.sdkVersion ?? '—' },
      { label: 'Environment', value: extra.variant ?? (__DEV__ ? 'development' : 'production') },
      { label: 'Git Commit', value: extra.commitHash ?? '—' },
      { label: 'Update URL', value: expo.updates?.url ?? '—' },
      { label: 'Platform', value: `${Platform.OS}${Platform.constants && (Platform.constants as any).Version ? ` ${(Platform.constants as any).Version}` : ''}` },
    ];
    showContent(
      'Build Diagnostics',
      (
        <View>
          <Text style={styles.feedbackText}>
            Technical build details for bug reports. Tap "Copy Info" to paste them into feedback.
          </Text>
          {rows.map((r) => (
            <View style={styles.devRow} key={r.label}>
              <Text style={styles.devRowLabel}>{r.label}</Text>
              <Text style={styles.devRowValue} numberOfLines={1}>{r.value}</Text>
            </View>
          ))}
        </View>
      ),
      [
        { label: 'Copy Info', primary: true, onPress: () => setStringAsync(rows.map((r) => `${r.label}: ${r.value}`).join('\n')) },
        { label: 'Close' },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <SectionHeader>Account</SectionHeader>
        <SettingCard>
          {accounts.length === 0 ? (
            <>
              <SettingRow
                icon="person-outline"
                title="Player Tag"
                desc={playerTag || 'Not set'}
                compact
                onPress={handleEditTag}
              />
              <SettingRow
                icon="key-outline"
                title="API Token"
                desc="Required for API access"
                compact
                pillText="Required"
                pillTopOffset={18}
                pillRightOffset={-4}
                onPress={handleEditToken}
                children={
                  <>
                    <Text style={styles.settingValue} numberOfLines={1}>{apiToken}</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
                  </>
                }
              />
            </>
          ) : (
            <SettingRow
              icon={switchingAccount ? 'ellipsis-horizontal' : 'people-outline'}
              title={activeAccount?.name || 'Accounts'}
              desc={`${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'} · ${activeAccount?.tag || ''}`}
              compact
              onPress={() => setSwitchModalVisible(true)}
              children={
                <>
                  {switchingAccount ? (
                    <ActivityIndicator size="small" color={Colors.textSecondary} />
                  ) : activeAccount && activeAccount.townHallLevel > 0 && getTownHallImageUrl(activeAccount.townHallLevel) ? (
                    <Image source={{ uri: getTownHallImageUrl(activeAccount.townHallLevel)! }} style={styles.settingThImage} resizeMode="contain" />
                  ) : null}
                  <Ionicons name="swap-horizontal" size={16} color={Colors.textMuted} style={{ marginLeft: 6 }} />
                </>
              }
            />
          )}
          {accounts.length > 0 && (
            <SettingRow
              icon="key-outline"
              title="API Token"
              desc="Required for API access"
              compact
              pillText="Required"
              pillTopOffset={8}
              pillRightOffset={-10}
              onPress={handleEditToken}
              children={
                <>
                  <Text style={styles.settingValue} numberOfLines={1}>{apiToken}</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
                </>
              }
            />
          )}
          <SettingRow
            icon="add-circle-outline"
            title={accounts.length === 0 ? 'Connect Account' : 'Add Account'}
            desc="Connect a new player tag"
            compact
            onPress={() => {
              setOnboardingTag('');
              setOnboardingThLevel('');
              setShowOnboarding(true);
            }}
          />
          <SettingRow
            icon="sync-outline"
            title="Sync Now"
            desc="Pull fresh data from the API"
            compact
            onPress={() => {
              showDialog({
                title: 'Sync Now',
                message: 'Triggers an immediate sync of your player data from the Clash of Clans API. Use this if your stats seem outdated or after switching accounts.',
                actions: [
                  { label: 'Cancel', onPress: () => {} },
                  { label: 'Sync', primary: true, onPress: () => { bumpTagVersion(); } },
                ],
              });
            }}
          />
          <SettingRow
            icon="rocket-outline"
            title="Add Account (Full Setup)"
            desc="Walk through the full setup for a new account"
            compact
            isLast
            onPress={() => router.push('/onboarding?mode=add')}
          />
        </SettingCard>

        <SectionHeader>Appearance</SectionHeader>
        <SettingCard>
          <SettingRow
            icon="moon-outline"
            title="Dark Mode"
            desc="Switch between dark and light theme"
            compact
            children={
              <Switch
                value={isDark}
                onValueChange={(v) => setThemeMode(v)}
                trackColor={{ false: Colors.border, true: Colors.textMuted }}
                thumbColor={isDark ? Colors.textPrimary : Colors.bgCard}
              />
            }
            isFirst
            isLast
          />
        </SettingCard>

        <SectionHeader>Discounts</SectionHeader>
        <SettingCard>
          <SettingRow
            icon="business-outline"
            title="Building Discounts"
            desc={discountDesc(discounts.buildings)}
            compact
            onPress={() => setDiscountModalScope('buildings')}
            children={
              <View style={styles.discountRowRight}>
                <View style={[styles.discountDot, discounts.buildings.costPercent > 0 || discounts.buildings.timePercent > 0 ? styles.discountDotActive : null]} />
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            }
            isFirst
          />
          <SettingRow
            icon="shield-half-outline"
            title="Army Discounts"
            desc={discountDesc(discounts.army)}
            compact
            onPress={() => setDiscountModalScope('army')}
            children={
              <View style={styles.discountRowRight}>
                <View style={[styles.discountDot, discounts.army.costPercent > 0 || discounts.army.timePercent > 0 ? styles.discountDotActive : null]} />
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            }
            isLast
          />
        </SettingCard>

        <SectionHeader>Data &amp; Preferences</SectionHeader>
        <SettingCard>
          <SettingRow
            icon="trash-outline"
            title="Clear Cache"
            desc="Remove all locally cached data"
            compact
            destructive
            pillText="Destructive"
            pillTopOffset={18}
            pillRightOffset={-4}
            onPress={handleClearCache}
            isFirst
          />

          <SettingRow
            icon="cloud-upload-outline"
            title="Import Building Levels"
            desc="Paste a Clash of Clans JSON Export to bulk-set levels"
            compact
            onPress={() => router.push('/import-export')}
          />
          <SettingRow
            icon="refresh-outline"
            title="Refresh Game Data"
            desc="Re-fetch reference data from the wiki"
            compact
            onPress={() => {
              showDialog({
                title: 'Refresh Game Data',
                message: 'Re-fetches all game reference data (siege machines, pets, super troops, max levels) from the wiki and clash.ninja. This ensures you have the latest unit names and balance changes. Data is cached for 7 days.',
                actions: [
                  { label: 'Cancel', onPress: () => {} },
                  { label: 'Refresh', primary: true, onPress: async () => { await refreshGameData(); } },
                ],
              });
            }}
            isLast
          />
        </SettingCard>

        <SectionHeader>App Management</SectionHeader>
        <SettingCard>
          <SettingRow
            icon="cloud-outline"
            title="Check for Updates"
            desc="Look for the latest version"
            compact
            onPress={handleCheckUpdates}
            children={checkingUpdates ? <ActivityIndicator size="small" color={Colors.textSecondary} /> : null}
            isFirst
          />
          <SettingRow
            icon="information-circle-outline"
            title="About ClashPrime"
            desc="What this app does, its features and sources"
            compact
            onPress={openAbout}
            children={
              <>
                <Text style={styles.settingValue}>{appVersion}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
              </>
            }
          />
          <SettingRow
            icon="sparkles-outline"
            title="What's New"
            desc="Recent updates and improvements"
            compact
            onPress={openChangelog}
            children={
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            }
          />
          <SettingRow
            icon="document-text-outline"
            title="Privacy Policy"
            desc="How your data is handled"
            compact
            onPress={openPrivacy}
          />
          <SettingRow
            icon="heart-outline"
            title="Credits"
            desc="Made with love by Parzival"
            compact
            onPress={openCredits}
          />
          <SettingRow
            icon="chatbubble-outline"
            title="Send Feedback"
            desc="Report a bug or share an idea"
            compact
            onPress={openFeedback}
            isLast
          />
        </SettingCard>

        <SectionHeader>Developer</SectionHeader>
        <SettingCard>
          <SettingRow
            icon="person-circle-outline"
            title="Developer Info"
            desc="About the developer behind ClashPrime"
            compact
            onPress={openDeveloper}
            children={
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            }
            isFirst
          />
          <SettingRow
            icon="code-slash-outline"
            title="Build Diagnostics"
            desc="Technical build details for bug reports"
            compact
            onPress={openBuildDiagnostics}
            children={
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            }
            isLast
          />
        </SettingCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ClashPrime {appVersion}</Text>
          <View style={styles.footerMadeRow}>
            <Text style={styles.footerSubtext}>Made with </Text>
            <Image source={heartImg} style={styles.footerHeart} />
            <Text style={styles.footerSubtext}> by Parzival</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
        onShow={() => modalInputRef.current?.focus()}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <PressableRipple style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              <Ionicons
                name={modalType === 'tag' ? 'person-outline' : 'key-outline'}
                size={22}
                color={Colors.textPrimary}
              />
            </View>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <View style={styles.modalHint}>
              {modalType === 'tag' ? (
                <Text style={styles.modalHintText}>
                  Your unique player identifier starting with #. Find it in-game under Settings → More → Show Tag.
                </Text>
              ) : (
                <>
                  <Text style={styles.modalHintText}>
                    A long alphanumeric string (starts with <Text style={styles.modalCode}>eyJ</Text>) that grants read-only access to your profile.
                  </Text>
                  <View style={styles.modalSteps}>
                    <View style={styles.modalStep}>
                      <Text style={styles.modalStepNum}>1</Text>
                      <Text style={styles.modalStepText}>
                        Open <Text style={styles.modalLink}>developer.clashofclans.com</Text> and sign in with your Supercell ID
                      </Text>
                    </View>
                    <View style={styles.modalStep}>
                      <Text style={styles.modalStepNum}>2</Text>
                      <Text style={styles.modalStepText}>
                        Go to <Text style={styles.modalLink}>My Account → Create New Key</Text>, name it "ClashPrime"
                      </Text>
                    </View>
                    <View style={styles.modalStep}>
                      <Text style={styles.modalStepNum}>3</Text>
                      <Text style={styles.modalStepText}>
                        Copy the token, then <Text style={styles.modalImportant}>add IP 45.79.218.79 to the whitelist</Text> (app uses a proxy)
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>
            <View style={styles.modalInputRow}>
              <TextInput
                ref={modalInputRef}
                style={styles.modalInput}
                value={modalValue}
                onChangeText={(t) => { setModalValue(t); setModalError(''); }}
                placeholder={modalPlaceholder}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardAppearance="dark"
              />
              {modalType === 'token' && (
                <PressableRipple style={styles.modalIconBtn} onPress={async () => { const t = await getStringAsync(); if (t) setModalValue(t); }} hitSlop={8}>
                  <Ionicons name="clipboard-outline" size={18} color={Colors.textMuted} />
                </PressableRipple>
              )}
              {modalValue.length > 0 && (
                <PressableRipple style={styles.modalClearBtn} onPress={() => setModalValue('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </PressableRipple>
              )}
            </View>
            {modalError ? (
              <Text style={styles.modalErrorText}>{modalError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <PressableRipple
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </PressableRipple>
              <PressableRipple
                style={styles.modalSaveBtn}
                onPress={() => modalOnSave(modalValue)}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </PressableRipple>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={contentVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setContentVisible(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.contentOverlay}
        >
          <PressableRipple style={styles.contentBackdrop} onPress={() => setContentVisible(false)} />
          <View style={styles.contentCard}>
            <View style={styles.contentHeader}>
              <Text style={styles.contentTitle}>{contentTitle}</Text>
              <PressableRipple onPress={() => setContentVisible(false)} style={styles.contentClose} hitSlop={8}>
                <Ionicons name="close" size={20} color={Colors.textTertiary} />
              </PressableRipple>
            </View>
            <ScrollView
              style={styles.contentBody}
              contentContainerStyle={styles.contentBodyInner}
              showsVerticalScrollIndicator={false}
            >
              {contentBody}
            </ScrollView>
            <View style={styles.contentActions}>
              {contentActions.map((a, i) => (
                <PressableRipple
                  key={`${a.label}-${i}`}
                  style={[styles.contentBtn, a.primary && styles.contentBtnPrimary]}
                  onPress={() => {
                    a.onPress?.();
                    setContentVisible(false);
                  }}
                >
                  <Text style={[styles.contentBtnText, a.primary && styles.contentBtnTextPrimary]}>
                    {a.label}
                  </Text>
                </PressableRipple>
              ))}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showOnboarding}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowOnboarding(false); setOnboardingStep('tag'); setOnboardingPlayer(null); }}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.onboardingOverlay}
        >
          {onboardingStep === 'tag' && (
            <View style={styles.onboardingCard}>
              <View style={styles.onboardingIcon}>
                <Ionicons name="person-add-outline" size={24} color={Colors.textPrimary} />
              </View>
              <Text style={styles.onboardingTitle}>Add Account</Text>
              <Text style={styles.onboardingDesc}>
                Enter your player tag. We'll fetch your profile and let you confirm before connecting.
              </Text>
              <View style={styles.onboardingInputGroup}>
                <Text style={styles.onboardingFieldLabel}>Player Tag</Text>
                <TextInput
                  style={styles.onboardingInput}
                  value={onboardingTag}
                  onChangeText={(t) => setOnboardingTag(t)}
                  placeholder="#PG8U2LR00"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.onboardingActions}>
                <PressableRipple
                  style={[styles.onboardingBtn, styles.onboardingBtnGhost]}
                  onPress={() => { setShowOnboarding(false); setOnboardingStep('tag'); }}
                >
                  <Text style={[styles.onboardingBtnText, styles.onboardingBtnTextGhost]}>Cancel</Text>
                </PressableRipple>
                <PressableRipple
                  style={styles.onboardingBtn}
                  onPress={handleOnboardingSave}
                >
                  <Text style={styles.onboardingBtnText}>Next</Text>
                </PressableRipple>
              </View>
            </View>
          )}

          {onboardingStep === 'profile' && onboardingPlayer && (
            <View style={styles.onboardingCard}>
              <View style={styles.onboardingIcon}>
                <Ionicons name="person-outline" size={24} color={Colors.textPrimary} />
              </View>
              <Text style={styles.onboardingTitle}>Confirm Profile</Text>
              <Text style={styles.onboardingDesc}>
                Does this look like your account?
              </Text>
              <View style={styles.onboardingProfileCard}>
                {onboardingPlayer.clan?.badgeUrls?.small ? (
                  <Image source={{ uri: onboardingPlayer.clan.badgeUrls.small! }} style={styles.onboardingProfileClanBadge} resizeMode="contain" />
                ) : null}
                <Text style={styles.onboardingProfileName}>{onboardingPlayer.name}</Text>
                <Text style={styles.onboardingProfileTag}>{onboardingPlayer.tag}</Text>
                {onboardingPlayer.clan && (
                  <Text style={styles.onboardingProfileClan}>{onboardingPlayer.clan.name}</Text>
                )}
                <View style={styles.onboardingProfileStats}>
                  <View style={styles.onboardingProfileStat}>
                    <Text style={styles.onboardingProfileStatValue}>TH{onboardingPlayer.townHallLevel}</Text>
                    <Text style={styles.onboardingProfileStatLabel}>Town Hall</Text>
                  </View>
                  {onboardingPlayer.builderHallLevel && (
                    <View style={styles.onboardingProfileStat}>
                      <Text style={styles.onboardingProfileStatValue}>BH{onboardingPlayer.builderHallLevel}</Text>
                      <Text style={styles.onboardingProfileStatLabel}>Builder Hall</Text>
                    </View>
                  )}
                  <View style={styles.onboardingProfileStat}>
                    <Text style={styles.onboardingProfileStatValue}>{onboardingPlayer.trophies?.toLocaleString()}</Text>
                    <Text style={styles.onboardingProfileStatLabel}>Trophies</Text>
                  </View>
                  <View style={styles.onboardingProfileStat}>
                    <Text style={styles.onboardingProfileStatValue}>{onboardingPlayer.warStars?.toLocaleString()}</Text>
                    <Text style={styles.onboardingProfileStatLabel}>War Stars</Text>
                  </View>
                </View>
                <Text style={styles.onboardingConfirmText}>Does this look right?</Text>
              </View>
              <View style={styles.onboardingActions}>
                <PressableRipple
                  style={[styles.onboardingBtn, styles.onboardingBtnGhost]}
                  onPress={() => setOnboardingStep('tag')}
                >
                  <Text style={[styles.onboardingBtnText, styles.onboardingBtnTextGhost]}>Back</Text>
                </PressableRipple>
                <PressableRipple
                  style={styles.onboardingBtn}
                  onPress={handleOnboardingSave}
                >
                  <Text style={styles.onboardingBtnText}>Confirm & Continue</Text>
                </PressableRipple>
              </View>
            </View>
          )}

          {onboardingStep === 'thPicker' && onboardingPlayer && (
            <View style={styles.onboardingCard}>
              <View style={styles.onboardingIcon}>
                <Ionicons name="hammer-outline" size={24} color={Colors.textPrimary} />
              </View>
              <Text style={styles.onboardingTitle}>Last Maxed Town Hall</Text>
              <Text style={styles.onboardingDesc}>
                Pick the last Town Hall you've fully maxed. This sets your starting building levels.
              </Text>
              <View style={styles.onboardingThGrid}>
                {Array.from({ length: (onboardingPlayer.townHallLevel || 16) - 1 }, (_, i) => i + 2).map((th) => (
                  <PressableRipple
                    key={th}
                    style={styles.onboardingThCell}
                    onPress={() => { setOnboardingThLevel(String(th)); handleOnboardingSave(); }}
                  >
                    <Image source={{ uri: getTownHallImageUrl(th)! }} style={styles.onboardingThImg} resizeMode="contain" />
                    <Text style={styles.onboardingThText}>TH{th}</Text>
                  </PressableRipple>
                ))}
              </View>
              <Text style={styles.onboardingThHint}>
                You're on TH{onboardingPlayer.townHallLevel}. Pick the last Town Hall you've fully maxed.
              </Text>
              <View style={styles.onboardingActions}>
                <PressableRipple
                  style={[styles.onboardingBtn, styles.onboardingBtnGhost]}
                  onPress={() => setOnboardingStep('profile')}
                >
                  <Text style={[styles.onboardingBtnText, styles.onboardingBtnTextGhost]}>Back</Text>
                </PressableRipple>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={switchModalVisible} transparent animationType="fade" onRequestClose={() => setSwitchModalVisible(false)} statusBarTranslucent>
        <PressableRipple style={styles.switchOverlay} onPress={() => setSwitchModalVisible(false)}>
          <View style={styles.switchCard}>
            <View style={styles.switchHeader}>
              <View style={styles.switchHeaderIcon}>
                <Ionicons name="people" size={18} color={Colors.textPrimary} />
              </View>
              <View style={styles.switchHeaderText}>
                <Text style={styles.switchTitle}>Accounts</Text>
                <Text style={styles.switchSubtitle}>Tap to switch · hold to remove</Text>
              </View>
            </View>

            {accounts.length === 0 && <Text style={styles.switchEmpty}>No accounts added</Text>}

            {accounts.map((acct) => {
              const isActive = acct.tag === activeAccount?.tag;
              const isSyncing = acct.tag === syncingTag;
              return (
                <PressableRipple
                  key={acct.tag}
                  style={[styles.switchItem, isActive && styles.switchItemActive]}
                  onPress={async () => {
                    if (isActive || switchingAccount || isSyncing) return;
                    setSwitchModalVisible(false);
                    await handleSwitchAccount(acct.tag);
                  }}
                  onLongPress={() => {
                    if (accounts.length <= 1) {
                      showDialog({ title: 'Cannot Remove', message: 'You need at least one account.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
                      return;
                    }
                    showDialog({
                      title: 'Remove Account',
                      message: `Remove ${acct.tag}? This will not delete your Clash of Clans account, only remove it from ClashPrime.`,
                      actions: [
                        { label: 'Cancel', onPress: () => {} },
                        { label: 'Remove', primary: true, destructive: true, onPress: async () => {
                          await removeAccount(acct.tag);
                          await refreshAccounts();
                          if (isActive) {
                            const remaining = await getAccounts();
                            if (remaining.length > 0) {
                              await handleSwitchAccount(remaining[0].tag);
                            }
                          }
                        }},
                      ],
                    });
                  }}
                >
                  <View style={styles.switchAvatar}>
                    {acct.townHallLevel > 0 && getTownHallImageUrl(acct.townHallLevel) ? (
                      <Image source={{ uri: getTownHallImageUrl(acct.townHallLevel)! }} style={styles.switchAvatarImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="person" size={18} color={Colors.textSecondary} />
                    )}
                  </View>
                  <View style={styles.switchItemText}>
                    <View style={styles.switchItemNameRow}>
                      <Text style={styles.switchItemName} numberOfLines={1}>{acct.name || acct.tag}</Text>
                      {isActive && (
                        <View style={styles.switchActiveChip}>
                          <Text style={styles.switchActiveChipText}>Active</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.switchItemTag}>{acct.tag}</Text>
                  </View>
                  {isSyncing && (
                    <View style={styles.switchSyncingBadge}>
                      <ActivityIndicator size="small" color={Colors.textSecondary} />
                    </View>
                  )}
                  {acct.townHallLevel > 0 && (
                    <View style={[styles.switchThBox, isActive && styles.switchThBoxActive]}>
                      <Text style={[styles.switchThBoxLevel, isActive && styles.switchThBoxLevelActive]}>{acct.townHallLevel}</Text>
                      <Text style={[styles.switchThBoxLabel, isActive && styles.switchThBoxLabelActive]}>TH</Text>
                    </View>
                  )}
                </PressableRipple>
              );
            })}

            <PressableRipple
              style={styles.switchAdd}
              onPress={() => {
                setSwitchModalVisible(false);
                setOnboardingTag('');
                setOnboardingThLevel('');
                setShowOnboarding(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.switchAddText}>Add Account</Text>
            </PressableRipple>

            <PressableRipple style={styles.switchClose} onPress={() => setSwitchModalVisible(false)}>
              <Text style={styles.switchCloseText}>Close</Text>
            </PressableRipple>
          </View>
        </PressableRipple>
      </Modal>

      <DiscountModal
        visible={discountModalScope !== null}
        onClose={() => setDiscountModalScope(null)}
        scope={discountModalScope ?? 'buildings'}
        buildings={discounts.buildings}
        army={discounts.army}
        onBuildingCostChange={setBuildingCost}
        onBuildingTimeChange={setBuildingTime}
        onArmyCostChange={setArmyCost}
        onArmyTimeChange={setArmyTime}
        onReset={resetDiscounts}
      />

      <Dialog />
    </SafeAreaView>
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
  sectionHeader: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  settingCard: {
    marginBottom: Spacing.xl,
    marginHorizontal: Spacing.base,
    gap: Spacing.xs,
    borderRadius: Radius.xl * 1.25,
    overflow:'hidden'
  },
  settingValue: {
    ...Typography.footnote,
    color: Colors.textMuted,
    flexShrink: 1,
    fontWeight: '500',
    maxWidth: 160,
  },
  settingThImage: {
    width: 24,
    height: 24,
    marginLeft: Spacing.sm,
  },
  discountRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  discountDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  discountDotActive: {
    backgroundColor: Colors.warning,
  },
  switchOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  switchCard: {
    width: '86%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  switchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  switchHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchHeaderText: {
    flex: 1,
  },
  switchTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  switchSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  switchEmpty: {
    ...Typography.subhead,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  switchItemActive: {
    backgroundColor: Colors.accentGhost,
  },
  switchAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  switchAvatarImg: {
    width: 34,
    height: 34,
  },
  switchItemText: {
    flex: 1,
  },
  switchItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  switchItemName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
  },
  switchItemTag: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 1,
  },
  switchActiveChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.textPrimary,
  },
  switchActiveChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.bg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  switchSyncingBadge: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchThBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchThBoxActive: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  switchThBoxLevel: {
    ...Typography.headline,
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 16,
    fontWeight: '700',
  },
  switchThBoxLevelActive: {
    color: Colors.bg,
  },
  switchThBoxLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontSize: 8,
    lineHeight: 9,
    fontWeight: '600',
  },
  switchThBoxLabelActive: {
    color: Colors.bg,
    opacity: 0.7,
  },
  switchAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  switchAddText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  switchClose: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  switchCloseText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
    opacity: 0.6,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  footerSubtext: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  footerMadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerHeart: {
    width: 12,
    height: 12,
    marginBottom: 1,
  },
  creditMadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  creditMadeText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  creditHeart: {
    width: 12,
    height: 12,
    marginBottom: 1,
  },
  onboardingMadeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  onboardingMadeText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  onboardingHeart: {
    width: 12,
    height: 12,
    marginBottom: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
  },
  modalHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginBottom: Spacing.xs,
  },
  modalHintText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 18,
  },
  modalCode: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: Colors.accent,
  },
  modalSteps: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  modalStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  modalStepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.accent,
    color: Colors.bg,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    marginTop: 1,
  },
  modalStepText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  modalLink: {
    color: Colors.accent,
    fontWeight: '600',
  },
  modalImportant: {
    color: Colors.warning,
    fontWeight: '600',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingRight: Spacing.sm,
  },
  modalInput: {
    flex: 1,
    ...Typography.body,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  modalClearBtn: {
    padding: 4,
  },
  modalIconBtn: {
    padding: 4,
    marginLeft: 2,
  },
  modalErrorText: {
    ...Typography.caption,
    color: Colors.destructive,
    marginTop: -4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
  },
  modalCancelBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  modalCancelText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  modalSaveBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
  },
  modalSaveText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  contentOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  contentCard: {
    width: '88%',
    maxHeight: '80%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contentTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
  },
  contentClose: {
    padding: Spacing.xs,
  },
  contentBody: {
    maxHeight: 360,
  },
  contentBodyInner: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  contentActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contentBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
  },
  contentBtnPrimary: {
    backgroundColor: Colors.textPrimary,
  },
  contentBtnText: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  contentBtnTextPrimary: {
    color: Colors.bg,
  },
  creditHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  creditAvatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditHeroText: {
    gap: 2,
  },
  creditName: {
    ...Typography.headline,
    color: Colors.textPrimary,
  },
  creditHandle: {
    ...Typography.subhead,
    marginTop: Spacing.md,
    color: Colors.textTertiary,
  },
  creditBlurb: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: Spacing.base,
    marginBottom: Spacing.lg,
  },
  creditSectionTitle: {
    ...Typography.callout,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginVertical: Spacing.sm,
  },
  creditSourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  aboutFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  creditSourceIcon: {
    marginTop: 2,
  },
  creditSourceText: {
    flex: 1,
    gap: 2,
  },
  creditSourceName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  creditSourceUse: {
    ...Typography.footnote,
    color: Colors.textTertiary,
  },
  policyBlock: {
    gap: Spacing.xs,
  },
  policyTitle: {
    ...Typography.callout,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  policyBody: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.base,
  },
  feedbackText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  feedbackEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    marginVertical: Spacing.lg,
  },
  feedbackEmail: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  feedbackNote: {
    ...Typography.footnote,
    color: Colors.textTertiary,
  },
  onboardingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  onboardingCard: {
    width: '85%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  onboardingIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  onboardingDesc: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  onboardingInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    width: '100%',
  },
  onboardingInputGroup: {
    width: '100%',
    gap: Spacing.xs,
  },
  onboardingFieldLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  onboardingActions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  onboardingBtn: {
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
    flex: 1,
    marginLeft: Spacing.sm,
  },
  onboardingBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  onboardingBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
    textAlign: 'center',
  },
  onboardingBtnTextGhost: {
    color: Colors.textSecondary,
  },
  onboardingProfileCard: {
    width: '100%',
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  onboardingProfileClanBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: Spacing.xs,
  },
  onboardingProfileName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  onboardingProfileTag: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  onboardingProfileClan: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  onboardingProfileStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  onboardingProfileStat: {
    alignItems: 'center',
    minWidth: 70,
  },
  onboardingProfileStatValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  onboardingProfileStatLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  onboardingConfirmText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  onboardingThGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  onboardingThCell: {
    width: 60,
    alignItems: 'center',
  },
  onboardingThImg: {
    width: 40,
    height: 40,
    marginBottom: 4,
  },
  onboardingThText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  onboardingThHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  changelogEntry: {
    marginBottom: Spacing.lg,
  },
  changelogVersionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  changelogVersion: {
    ...Typography.title3,
    color: Colors.textPrimary,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  changelogDate: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  changelogItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: 6,
  },
  changelogDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accent,
    marginTop: 9,
  },
  changelogItemText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  devAvatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  devAvatarImg: {
    width: 52,
    height: 52,
  },
  devTagline: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600',
    marginTop: Spacing.md,
  },
  devProjectRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  devRowLabel: {
    ...Typography.subhead,
    color: Colors.textSecondary,
  },
  devRowValue: {
    ...Typography.footnote,
    color: Colors.textPrimary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
});
