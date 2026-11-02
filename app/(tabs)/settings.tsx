import { toJsonName } from '../../src/utils/buildingCopies';
import { importUpgradeSnapshot } from '../../src/utils/importedUpgrades';
import PageScreen from '../../src/components/PageScreen';
import CollapsibleContent from '../../src/components/CollapsibleContent';
import ChangelogBody, { CHANGELOG } from '../../src/components/ChangelogSheet';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Platform,
  Image,
  ActivityIndicator,
  type ImageSourcePropType,
} from 'react-native';
import PressableRipple from '../../src/components/PressableRipple';
import { SettingRow, useSettingRowSurface } from '../../src/components/SettingRow';
import BottomSheet from '../../src/components/BottomSheet';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { openURL } from 'expo-linking';
import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { Colors, Typography, Spacing, Radius, useTheme, useClashFontPref, useGlobalLevels } from '../../src/theme';
import { useBaseSourcePref } from '../../src/api/baseScraper';
import OptionSelector from '../../src/components/OptionSelector';
import { getTownHallImageSource, getBuildingEffectiveMax } from '../../src/utils/buildingImages';
import { getMaxTownHall, isBuilderName } from '../../src/utils/buildingData';
import { parseCocExport, cocExportToBuildingLevels, normalizeTag, detectBuilderHutCount, CocImportResult } from '../../src/utils/cocExport';
import type { ClashPlayer } from '../../src/types/clash';
import { seedBuildingLevelsForTH } from '../../src/utils/seedBuildingLevels';
import { ClashAPI } from '../../src/api/clash';
import { checkForUpdate } from '../../src/utils/versionCheck';
import {
  getPlayerTag,
  setPlayerTag,
  getApiToken,
  setApiToken,
  clearAppCache,
  saveAccount,
  removeAccount,
  signOutAccount,
  getAccounts,
  cachePlayer,
} from '../../src/hooks/usePlayer';
import { usePlayer, usePlayerActions } from '../../src/hooks/usePlayerContext';
import { useGameData } from '../../src/hooks/useGameData';
import { useDialog } from '../../src/components/AlertDialog';
import { useDiscounts } from '../../src/hooks/useDiscounts';
import type { ScopeDiscount } from '../../src/hooks/useDiscounts';
import { useBuilderCount } from '../../src/hooks/useBuilderCount';
import { useBuilderBaseCount } from '../../src/hooks/useBuilderBaseCount';
import DiscountModal from '../../src/components/DiscountModal';
import OnboardingModal from '../../src/components/OnboardingModal';
import Constants from 'expo-constants';
import { DATA_SOURCE_GROUPS, SUPERCELL_NOTICE } from '../../src/data/attribution';
import Switch from '../../src/components/Switch';
const heartImg = require('../../images/heart.png') as any;

/** Settings groups, collapsed the same way the Time to Max pipelines are. */
type SettingsSectionKey = 'account' | 'appearance' | 'discounts' | 'data' | 'app' | 'developer';

const SECTION_META: Record<SettingsSectionKey, { title: string; icon: string; desc: string }> = {
  account: { title: 'Account', icon: 'people-outline', desc: 'Player tag, API token & villages' },
  appearance: { title: 'Appearance', icon: 'color-palette-outline', desc: 'Theme & Clash font' },
  discounts: { title: 'Discounts', icon: 'pricetag-outline', desc: 'Building & army discounts' },
  data: { title: 'Data & Preferences', icon: 'construct-outline', desc: 'Cache, imports & builder counts' },
  app: { title: 'App Management', icon: 'settings-outline', desc: 'Updates, policies & credits' },
  developer: { title: 'Developer', icon: 'person-circle-outline', desc: 'Developer info & build diagnostics' },
};

/**
 * A settings group behind a collapsing header. Same contract as the Time to Max
 * pipeline rows: the header owns the group's top corners while open and its
 * bottom corners while closed, and the body's last row closes them again when
 * open, so one group always reads as a single rounded card.
 */
/**
 * The trailing count chip. Its own component because it has to read the row's
 * surface state, and it is rendered as SettingRow's children - reading it from
 * SettingSection would pick up the parent's context, not the row's.
 */
function SectionBadge({ label, isFirst, isOpen, isLast }: { label: string; isFirst?: boolean; isOpen: boolean; isLast?: boolean }) {
  const { colors } = useTheme();
  const inverted = useSettingRowSurface();
  return (
    <View style={[
      styles.sectionBadge,
      inverted && { backgroundColor: colors.invertedChip },
      // Mirrors the row's own corner logic, so the chip follows the card's
      // rounded outer edge instead of floating as its own pill.
      (isFirst || isOpen) && styles.sectionBadgeFirst,
      isLast && !isOpen && styles.sectionBadgeLast,
    ]}>
      <Text style={[styles.sectionBadgeText, inverted && { color: colors.bgCard }]}>{label}</Text>
    </View>
  );
}

function SettingSection({
  meta,
  isOpen,
  onToggle,
  isFirst,
  isLast,
  badge,
  children,
}: {
  meta: { title: string; icon: string; desc: string };
  isOpen: boolean;
  onToggle: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SettingRow
        icon={meta.icon}
        title={meta.title}
        desc={meta.desc}
        compact
        isFirst={isFirst || isOpen}
        isLast={isLast && !isOpen}
        expanded={isOpen}
        onPress={onToggle}
      >
        {badge != null && (
          <SectionBadge label={badge} isFirst={isFirst} isOpen={isOpen} isLast={isLast} />
        )}
      </SettingRow>
      <CollapsibleContent expanded={!!(isOpen)}>
        {() => (<View style={styles.settingBody}>
          {children}
          {!isLast && <View style={styles.sectionSeparator} />}
        </View>)}
      </CollapsibleContent>
    </>
  );
}

interface ContentAction {
  label: string;
  onPress?: () => void;
  primary?: boolean;
  destructive?: boolean;
}

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
    body: 'Player data is retrieved from the official Clash of Clans API using your token. Reference content such as base layouts, building/troop/hero/spell/pet/equipment data, events and community armies is fetched from public sources including ClashLy, Clash Bases, ClashArmies, clash.ninja and the clash-of-clans-data npm package (canonical Supercell data).',
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

const DEVELOPER_PROJECTS: { name: string; blurb: string }[] = [
  { name: 'FlexPrime', blurb: 'Academic companion for FASTians — marks analytics, attendance risk, GPA tools and past papers, shipped to Google Play.' },
  { name: 'NotePrime', blurb: 'Material You fork of Note Safe — end-to-end encrypted, local-first notes with a privacy shield and biometric lock.' },
  { name: 'ClashPrime', blurb: 'This app — a premium Clash of Clans companion built in React Native + Expo.' },
  { name: 'Timers', blurb: 'Android multi-timer app with reliable notifications and zero bloat.' },
];

// Bundled rather than fetched from GitHub at runtime. The sheet header left a
// blank slot whenever that request failed, and an avatar should not depend on
// the network to render.
const devAvatarImg = require('../../images/developer-avatar.png') as any;
const GITHUB_PROFILE_URL = 'https://github.com/FarhanZafarr-9';
const CLASHPRIME_REPO_URL = 'https://github.com/FarhanZafarr-9/ClashPrime';

export default function SettingsScreen() {
  const router = useRouter();
  const appVersion = `v${(Constants.expoConfig as any)?.version ?? '6.0.0'}`;
  const { bumpTagVersion } = usePlayerActions();
  const { switchAccount, refreshAccounts, accounts, activeAccount, prefetchAccount, syncingTag, player } = usePlayer();
  const activeThImage = activeAccount && activeAccount.townHallLevel > 0
    ? getTownHallImageSource(activeAccount.townHallLevel)
    : null;
  const { show: showDialog, Dialog } = useDialog();
  const [playerTag, setPlayerTagState] = useState('');
  const [apiToken, setApiTokenState] = useState('');
  const { isDark, setThemeMode } = useTheme();
  const { pref: fontPref, setClashFontPref } = useClashFontPref();
  const { enabled: globalLevels, setShowGlobalLevels: setGlobalLevelsPref } = useGlobalLevels();
  const { pref: basePref, setPref: setBasePref } = useBaseSourcePref();
  const baseSourceDesc =
    basePref === 'both'
      ? 'Interleave both catalogues'
      : basePref === 'clashly'
        ? 'ClashLy only'
        : 'Clash Bases only';
  const clashFontDesc = fontPref === 'off'
    ? 'Use the system font'
    : fontPref === 'titles'
      ? 'Clash font for headings'
      : 'Clash font everywhere';
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'tag' | 'token'>('tag');
  const [modalTitle, setModalTitle] = useState('');
  const [modalSubtitle, setModalSubtitle] = useState('');
  const [modalValue, setModalValue] = useState('');
  const [modalPlaceholder, setModalPlaceholder] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalOnSave, setModalOnSave] = useState<(text: string) => void>(() => { });
  const modalInputRef = useRef<TextInput>(null);

  const [contentVisible, setContentVisible] = useState(false);
  const [contentTitle, setContentTitle] = useState('');
  const [contentSubtitle, setContentSubtitle] = useState('');
  const [contentIcon, setContentIcon] = useState<keyof typeof Ionicons.glyphMap | undefined>(undefined);
  const [contentIconSource, setContentIconSource] = useState<ImageSourcePropType | undefined>(undefined);
  const [contentBody, setContentBody] = useState<React.ReactNode>(null);
  const [contentIsChangelog, setContentIsChangelog] = useState(false);
  const [changelogExpanded, setChangelogExpanded] = useState<Record<string, boolean>>({});
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [contentActions, setContentActions] = useState<ContentAction[]>([]);

  const [showOnboarding, setShowOnboarding] = useState(false);
  // Every group starts collapsed, so the tab opens as a single screen of section
  // headers. The open group is tinted by SettingRow's `expanded` flag, which is
  // what tells you which one you opened.
  const [expanded, setExpanded] = useState<Record<SettingsSectionKey, boolean>>({
    account: false,
    appearance: false,
    discounts: false,
    data: false,
    app: false,
    developer: false,
  });
  const toggleSection = (key: SettingsSectionKey) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const [onboardingStep, setOnboardingStep] = useState<'tag' | 'import' | 'importToken' | 'profile' | 'builderCount' | 'thPicker'>('tag');
  const [onboardingTag, setOnboardingTag] = useState('');
  const [onboardingBuilderCount, setOnboardingBuilderCount] = useState(2);
  // Set when the pasted export yielded a readable Builder Hut count. A detected
  // count is authoritative and locks the step; only an undetected one is
  // editable, so the default of 2 can never be saved by accident.
  const [onboardingHutsDetected, setOnboardingHutsDetected] = useState(false);
  const [onboardingThLevel, setOnboardingThLevel] = useState('');
  const [onboardingPlayer, setOnboardingPlayer] = useState<ClashPlayer | null>(null);

  // Import flow state
  const [onboardingImportJson, setOnboardingImportJson] = useState('');
  const [onboardingImportResult, setOnboardingImportResult] = useState<CocImportResult | null>(null);
  const [onboardingImportTag, setOnboardingImportTag] = useState<string | null>(null);
  const [onboardingImportError, setOnboardingImportError] = useState<string | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [discountModalScope, setDiscountModalScope] = useState<'buildings' | 'army' | null>(null);
  const { refresh: refreshGameData } = useGameData();
  const {
    count: builderCount,
    setBuilderCount,
    verified: builderVerifiedCount,
    loaded: builderLoaded,
    isVerified: builderIsVerified,
    canDecrease: canDecreaseBuilders,
    canIncrease: canIncreaseBuilders,
    verifyBuilderCount,
    clearVerified: clearBuilderVerified,
  } = useBuilderCount();
  const { count: builderBaseCount, setBuilderBaseCount, loaded: bbBuilderLoaded } = useBuilderBaseCount(player?.builderHallLevel);
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

  useEffect(() => {
    let mounted = true;
    checkForUpdate().then(({ hasUpdate, latestVersion: v }) => {
      if (mounted) {
        setUpdateAvailable(hasUpdate);
        setLatestVersion(v);
      }
    });
    return () => { mounted = false; };
  }, []);

  /** Header subline for the tag/token input sheet. */
  const MODAL_SUBTITLE: Record<'tag' | 'token', string> = {
    tag: 'Starts with # and identifies your account',
    token: 'Grants read-only access to your profile',
  };

  const openModal = (type: 'tag' | 'token', title: string, placeholder: string, current: string, onSave: (text: string) => void) => {
    setModalType(type);
    setModalTitle(title);
    setModalSubtitle(MODAL_SUBTITLE[type]);
    setModalValue(current);
    setModalPlaceholder(placeholder);
    setModalError('');
    setModalOnSave(() => onSave);
    setModalVisible(true);
    setTimeout(() => modalInputRef.current?.focus(), 300);
  };

  const showContent = (
    title: string,
    body: React.ReactNode,
    actions: ContentAction[],
    subtitle?: string,
    icon?: keyof typeof Ionicons.glyphMap,
    iconSource?: ImageSourcePropType,
  ) => {
    setContentTitle(title);
    setContentSubtitle(subtitle ?? '');
    setContentIcon(icon);
    setContentIconSource(iconSource);
    setContentBody(body);
    setContentIsChangelog(false);
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
    if (checkingUpdates) return;
    setCheckingUpdates(true);
    try {
      const online = await probeConnectivity();
      if (!online) {
        showDialog({
          title: 'No Internet Connection',
          subtitle: 'GitHub was unreachable',
    icon: 'cloud-offline-outline',
          message: 'Could not reach GitHub to check for updates. Check your Wi-Fi or mobile data, then try again.',
          actions: [{ label: 'OK', primary: true, onPress: () => { } }],
        });
        return;
      }

      const { hasUpdate, latestVersion: v, currentVersion } = await checkForUpdate();
      if (hasUpdate) {
        showDialog({
          title: 'Update Available',
          subtitle: `v${v} is out — you're on v${currentVersion}`,
          icon: 'cloud-download-outline',
          message: `A new version of ClashPrime (v${v}) has been published — you are running v${currentVersion}. New builds are released as APKs on GitHub, so grab the latest one there to update.`,
          actions: [
            { label: 'Later', onPress: () => { } },
            { label: 'View on GitHub', primary: true, onPress: () => openURL('https://github.com/FarhanZafarr-9/ClashPrime/releases') },
          ],
        });
      } else if (v !== currentVersion) {
        showDialog({
          title: "You're Ahead of the Releases",
          subtitle: 'Development build detected',
    icon: 'flask-outline',
          message: `Your build (v${currentVersion}) is newer than the latest published release (v${v}). This usually means you are running an unreleased development build — nothing to update.`,
          actions: [{ label: 'OK', primary: true, onPress: () => { } }],
        });
      } else {
        showDialog({
          title: "You're Up to Date",
          subtitle: 'Nothing to install',
    icon: 'checkmark-circle-outline',
          message: `ClashPrime v${currentVersion} matches the latest published release. Check back later for new versions.`,
          actions: [{ label: 'OK', primary: true, onPress: () => { } }],
        });
      }
    } catch {
      showDialog({
        title: 'Update Check Failed',
        subtitle: 'GitHub unreachable or rate-limited',
    icon: 'warning-outline',
        message: 'Could not check for updates right now. This can happen if GitHub is rate-limiting or temporarily unavailable — please try again in a moment.',
        actions: [{ label: 'OK', primary: true, onPress: () => { } }],
      });
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleClearCache = async () => {
    await clearAppCache();
    bumpTagVersion();
    showDialog({ title: 'Cache Cleared', subtitle: 'Cached libraries removed', icon: 'trash-bin-outline', message: 'Local cache has been cleared successfully.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
  };

  const handleOnboardingImportPaste = async () => {
    try {
      const raw = await getStringAsync();
      if (raw) {
        setOnboardingImportJson(raw);
        const parsed = parseCocExport(raw);
        if (!parsed.ok || !parsed.data) {
          setOnboardingImportError(parsed.error ?? 'Failed to parse export.');
          setOnboardingImportResult(null);
          setOnboardingImportTag(null);
          return;
        }
        setOnboardingImportError(null);
        setOnboardingImportResult(cocExportToBuildingLevels(parsed.data));
        setOnboardingImportTag(normalizeTag(parsed.data.tag) || null);
      } else {
        setOnboardingImportError('Clipboard is empty. Copy the export JSON first, then try again.');
      }
    } catch {
      setOnboardingImportError('Could not read the clipboard. Paste the JSON manually instead.');
    }
  };

  const handleOnboardingImportParse = (raw: string) => {
    const parsed = parseCocExport(raw);
    if (!parsed.ok || !parsed.data) {
      setOnboardingImportError(parsed.error ?? 'Failed to parse export.');
      setOnboardingImportResult(null);
      setOnboardingImportTag(null);
      setOnboardingHutsDetected(false);
      return;
    }
    setOnboardingImportError(null);
    setOnboardingImportResult(cocExportToBuildingLevels(parsed.data));
    setOnboardingImportTag(normalizeTag(parsed.data.tag) || null);
    // Acknowledge the huts the same way onboarding does. Without this the
    // builder step kept its default of 2 and saved that for the account.
    const huts = detectBuilderHutCount(cocExportToBuildingLevels(parsed.data));
    setOnboardingHutsDetected(huts !== null);
    if (huts) setOnboardingBuilderCount(huts);
  };

  const handleOnboardingImportContinue = () => {
    if (onboardingImportResult && onboardingImportTag) {
      setOnboardingStep('importToken');
    }
  };

  const handleOnboardingImportTokenSubmit = async (token:string) => {
    if (token.length < 20) {
      setModalError('Enter a valid API token from clashofclans.com');
      return;
    }
    if (!onboardingImportResult || !onboardingImportTag) return;

    setModalVisible(false);
    setShowOnboarding(true); // keep onboarding open for loading

    try {
      const api = new ClashAPI(token);
      const data = await api.getPlayer(onboardingImportTag!);

      const mergedPlayer: ClashPlayer = {
        ...data,
        buildingLevels: onboardingImportResult.levels,
        buildings: onboardingImportResult.resolved.flatMap(item => item.levels.map(level => ({ name: toJsonName(item.storeName), level, maxLevel: getBuildingEffectiveMax(item.storeName, isBuilderName(item.storeName) ? data.builderHallLevel ?? 1 : data.townHallLevel) }))),
        lastMaxedTH: data.townHallLevel || getMaxTownHall(),
      };

      await saveAccount({
        tag: onboardingImportTag!,
        name: data.name,
        townHallLevel: data.townHallLevel,
        addedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      });
      await setPlayerTag(onboardingImportTag!);
      await setApiToken(token);
      await cachePlayer(mergedPlayer, onboardingImportTag!);
      await importUpgradeSnapshot(onboardingImportTag!, onboardingImportResult);

      // Import provides all building levels; skip profile/TH/builder steps.
      // The count still has to land: this branch used to skip the step without
      // ever saving one, leaving the account on the default of 2. A count read
      // from the export is verified, matching onboarding; otherwise the value
      // chosen in the step is stored unverified so the user can correct it.
      if (onboardingHutsDetected) {
        await verifyBuilderCount(onboardingBuilderCount, onboardingImportTag!);
      } else {
        await setBuilderCount(onboardingBuilderCount, onboardingImportTag!);
      }

      setShowOnboarding(false);
      setOnboardingStep('tag');
      setOnboardingImportJson('');
      setOnboardingImportResult(null);
      setOnboardingImportTag(null);
      setOnboardingImportError(null);
      setOnboardingPlayer(null);
      setOnboardingTag('');
      setOnboardingThLevel('');
      setOnboardingBuilderCount(2);
      setOnboardingHutsDetected(false);

      // Refresh accounts and switch to the new one
      await refreshAccounts();
      await handleSwitchAccount(onboardingImportTag!);
    } catch (e: any) {
      showDialog({
        title: 'Sign-in Failed',
    subtitle: 'Could not connect to the Clash API',
    icon: 'key-outline',
        message: e.message || 'Failed to connect. Check your token.',
        actions: [{ label: 'OK', primary: true, onPress: () => { } }],
      });
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
    subtitle: 'This player tag is already saved',
    icon: 'person-circle-outline',
          message: `${tag} is already in your account list. Switch to it instead.`,
          actions: [
            { label: 'Cancel', onPress: () => { } },
            {
              label: 'Switch', primary: true, onPress: async () => {
                await handleSwitchAccount(existing.tag);
                setShowOnboarding(false);
                setOnboardingStep('tag');
              }
            },
          ],
        });
        return;
      }
      const token = await getApiToken();
      if (!token) {
        showDialog({ title: 'No API Token', subtitle: 'Add a token before connecting accounts', icon: 'key-outline', message: 'You need to set up an API token first before adding accounts.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
        return;
      }
      try {
        const api = new ClashAPI(token);
        const data = await api.getPlayer(tag);
        setOnboardingPlayer(data);
        setOnboardingStep('profile');
      } catch (e: any) {
        showDialog({ title: 'Failed to Fetch Profile', subtitle: 'Check your token and player tag', icon: 'alert-circle-outline', message: e.message || 'Check your API token and player tag.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
      }
      return;
    }

    if (onboardingStep === 'profile') {
      // User confirmed profile, go to builder count
      setOnboardingStep('builderCount');
      return;
    }

    if (onboardingStep === 'builderCount') {
      // User set builder count, go to TH picker
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
      const currentTh = player.townHallLevel || getMaxTownHall();
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

      // Save builder count for this account. Awaited and in this order so the
      // chosen count lands before the import baseline is dropped; both read this
      // account's own stored values rather than the active account's.
      await setBuilderCount(onboardingBuilderCount, tag);
      await clearBuilderVerified(tag);

      setShowOnboarding(false);
      setOnboardingTag('');
      setOnboardingThLevel('');
      setOnboardingPlayer(null);
      setOnboardingStep('tag');

      await prefetchAccount(tag, { token, th: Number.isFinite(thLevel) && thLevel > 0 ? thLevel : currentTh, switch: true });
    }
  };

  const openAbout = () => {
    showContent(
      'About ClashPrime',
      (
        <View>
          {updateAvailable && (
            <View style={styles.aboutUpdateRow}>
              <Ionicons name="cloud-download-outline" size={14} color={Colors.warning} />
              <Text style={styles.updateBadgeText}>v{latestVersion} available</Text>
            </View>
          )}
          <View style={styles.aboutStatsRow}>
            {[
              { label: 'Version', value: appVersion },
              { label: 'Accounts', value: String(accounts.length) },
              { label: 'Sources', value: String(DATA_SOURCE_GROUPS.reduce((s, g) => s + g.sources.length, 0)) },
            ].map((s) => (
              <View style={styles.aboutStat} key={s.label}>
                <Text style={styles.aboutStatValue} numberOfLines={1}>{s.value}</Text>
                <Text style={styles.aboutStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.creditBlurb}>
            ClashPrime is an unofficial, community-built companion for Clash of Clans. It brings your village progress, war performance and favorite game references together in one clean, fast app — no ads, no clutter, just the data that matters.
          </Text>
          <Text style={styles.creditSectionTitle}>What it does</Text>
          {[
            { icon: 'trending-up-outline', title: 'Progress Tracking', body: 'Tracks every troop, spell, hero, pet and building against your town hall, with a weighted max-out score so you always know what is next.' },
            { icon: 'analytics-outline', title: 'Time to Max', body: 'Work out how long every remaining upgrade takes for each builder, with a full cost and time breakdown before you commit.' },
            { icon: 'hammer-outline', title: 'Pinned Timers', body: 'Set countdowns for upgrades and boosts, with reminders delivered as system notifications.' },
            { icon: 'flag-outline', title: 'War Center', body: 'Follow the current war, per-member attacks and defenses, plus a searchable war history split into regular wars and CWL.' },
            { icon: 'git-network-outline', title: 'Base & Army Hub', body: 'Browse community base layouts, armies, super troops and pets, plus in-game events — all kept up to date.' },
            { icon: 'trophy-outline', title: 'Achievements & Journey', body: 'Follow village achievements and a milestone-by-milestone hero journey built from your own upgrade history.' },
            { icon: 'document-text-outline', title: 'JSON Import & Export', body: 'Bring a Clash of Clans export straight in. Buildings, huts and crafted defenses are read from the file and applied per copy.' },
            { icon: 'save-outline', title: 'Saved Bases', body: 'Keep the layouts you rate highly and reach them again in one tap, organised by town hall and hall level.' },
            { icon: 'swap-horizontal-outline', title: 'Multi-Account', body: 'Switch between several villages with one tap. Each account keeps its own progress, cache and timers.' },
            { icon: 'options-outline', title: 'Tuned Discounts', body: 'Adjust resource and time multipliers so every estimate matches how you actually play.' },
          ].map((f) => (
            <View style={styles.aboutFeatureRow} key={f.title}>
              <Ionicons name={f.icon as any} size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
              <View style={styles.creditSourceText}>
                <Text style={styles.creditSourceName}>{f.title}</Text>
                <Text style={styles.creditSourceUse}>{f.body}</Text>
              </View>
            </View>
          ))}
          {DATA_SOURCE_GROUPS.map((g) => (
            <View key={g.key}>
              <Text style={styles.creditSectionTitle}>{g.label}</Text>
              {g.sources.map((s) => (
                <View style={styles.creditSourceRow} key={s.name}>
                  <Ionicons name="link-outline" size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
                  <View style={styles.creditSourceText}>
                    <Text style={styles.creditSourceName}>{s.name}</Text>
                    <Text style={styles.creditSourceUse}>{s.use}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.policyTitle}>Disclaimer</Text>
          <Text style={styles.policyBody}>
            {"ClashPrime is an independent project and is not affiliated with or endorsed by Supercell. Supercell's trademarks and the Clash of Clans brand are used with permission where applicable."}
          </Text>
        </View>
      ),
      [
        { label: 'Credits', onPress: openCredits },
        { label: 'View on GitHub', primary: true, onPress: () => openURL('https://github.com/FarhanZafarr-9/ClashPrime') },
        { label: 'Close' },
      ],
      `v${appVersion} · Premium Clash of Clans companion`,
      'shield',
    );
  };

  const openCredits = () => {
    showContent(
      'Credits',
      (
        <View>
          <Text style={styles.creditBlurb}>
            ClashPrime is an unofficial Clash of Clans companion, built to give players a clean, fast way to track progress and discover bases.
          </Text>
          {DATA_SOURCE_GROUPS.map((g) => (
            <View key={g.key}>
              <Text style={styles.creditSectionTitle}>{g.label}</Text>
              {g.sources.map((s) => (
                <PressableRipple key={s.name} onPress={() => openURL(s.url)} style={styles.creditSourceRow} hitSlop={4}>
                  <Ionicons name="link-outline" size={16} color={Colors.textTertiary} style={styles.creditSourceIcon} />
                  <View style={styles.creditSourceText}>
                    <Text style={styles.creditSourceName}>{s.name}</Text>
                    <Text style={styles.creditSourceUse}>{s.use}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={styles.creditSourceIcon} />
                </PressableRipple>
              ))}
            </View>
          ))}
          <Text style={styles.creditNotice}>{SUPERCELL_NOTICE}</Text>
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
      'Farhan Zafar · @FarhanZafarr-9',
      'logo-github',
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
      'What ClashPrime collects and why',
      'shield-checkmark-outline',
    );
  };

  const openFeedback = () => {
    showContent(
      'Send Feedback',
      (
        <View>
          <Text style={styles.feedbackText}>
            {"We'd love to hear from you — bug reports, feature ideas, or just a hello."}
          </Text>
          <View style={styles.feedbackEmailRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />
            <Text style={styles.feedbackEmail}>{FEEDBACK_EMAIL}</Text>
          </View>
          <Text style={styles.feedbackNote}>
            {'Tap "Email Us" to open your mail app, or copy the address above.'}
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
      'Bugs, feature ideas, or just a hello',
      'chatbubble-ellipses-outline',
    );
  };

  const openChangelog = () => {
    setChangelogExpanded({ [CHANGELOG[0].version]: true });
    showContent('What\u2019s New', null, [{ label: 'Close', primary: true }], 'Latest changes in ClashPrime', 'sparkles-outline');
    setContentIsChangelog(true);
  };

  const openDeveloper = () => {
    showContent(
      'Developer Info',
      (
        <View>
          <Text style={styles.devTagline}>
            every pixel intentional · every commit counts · every detail ships
          </Text>
          <Text style={styles.devBlurb}>
            Mobile and full-stack developer, currently on a BS in Data Science at FAST-NUCES Lahore. I ship real apps — React Native, Flutter and full-stack web — and obsess over the details users actually feel.
          </Text>
          <Text style={styles.devSectionTitle}>What I do</Text>
          <View style={styles.devSkillRow}>
            {[
              { icon: 'phone-portrait-outline', title: 'Mobile', body: 'React Native · Expo · Flutter' },
              { icon: 'globe-outline', title: 'Web', body: 'React · Node.js · Express · SQL' },
              { icon: 'analytics-outline', title: 'Data', body: 'Python · PyTorch · scikit-learn' },
            ].map((s) => (
              <View style={styles.devSkillTile} key={s.title}>
                <View style={styles.devSkillIcon}>
                  <Ionicons name={s.icon as any} size={16} color={Colors.textPrimary} />
                </View>
                <Text style={styles.devSkillName}>{s.title}</Text>
                <Text style={styles.devSkillBody}>{s.body}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.devSectionTitle}>Featured projects</Text>
          <View style={styles.devProjectList}>
            {DEVELOPER_PROJECTS.map((p) => (
              <View style={styles.devProjectItem} key={p.name}>
                <View style={styles.devProjectIcon}>
                  <Ionicons name="code-slash-outline" size={14} color={Colors.textSecondary} />
                </View>
                <View style={styles.devProjectText}>
                  <Text style={styles.devProjectName}>{p.name}</Text>
                  <Text style={styles.devProjectBlurb}>{p.blurb}</Text>
                </View>
              </View>
            ))}
          </View>
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
      'Farhan Zafar · @FarhanZafarr-9',
      undefined,
      devAvatarImg,
    );
  };

  const openBuildDiagnostics = () => {
    const expo = (Constants.expoConfig as any) ?? {};
    const extra = expo.extra ?? {};
    const easBuild = extra.eas?.build ?? {};
    // Everything here is read straight off injected config, so a nested object
    // can reach here and React cannot render one as a child. Flatten anything
    // non-primitive instead of letting it through.
    const str = (v: unknown): string => {
      if (v == null || v === '') return '—';
      if (typeof v === 'object') {
        const keys = Object.keys(v as object);
        return keys.length ? JSON.stringify(v) : '—';
      }
      return String(v);
    };
    const rows: { label: string; value: string }[] = [
      { label: 'App Version', value: str(expo.version ? `v${expo.version}` : null) },
      { label: 'Build Number', value: str(easBuild.runNumber ?? Constants.nativeBuildVersion ?? null) },
      { label: 'Expo SDK', value: str(expo.sdkVersion ?? null) },
      { label: 'Environment', value: str(extra.variant ?? (__DEV__ ? 'development' : 'production')) },
      { label: 'Git Commit', value: str(extra.commitHash ?? null) },
      { label: 'Platform', value: str(`${Platform.OS}${Platform.constants && (Platform.constants as any).Version ? ` ${(Platform.constants as any).Version}` : ''}`) },
    ];
    showContent(
      'Build Diagnostics',
      (
        <View>
          <Text style={styles.feedbackText}>
            {'Technical build details for bug reports. Tap "Copy Info" to paste them into feedback.'}
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
      'Technical build details for bug reports',
      'code-slash-outline',
    );
  };

  return (
    <PageScreen
      style={styles.container}
      title={<>Settings</>}
      actions={[]}
      contentContainerStyle={styles.scroll}
      overlays={<><BottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onShow={() => modalInputRef.current?.focus()}
        icon={modalType === 'tag' ? 'person-outline' : 'key-outline'}
        title={modalTitle}
        subtitle={modalSubtitle}
      >
        <View style={styles.modalContent}>
            <View style={styles.modalHint}>
              {modalType === 'tag' ? (
                <Text style={styles.modalHintText}>
                  Your unique player identifier starting with #. Find it in-game under Settings › More › Show Tag.
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
                        Go to <Text style={styles.modalLink}>My Account › Create New Key</Text>, name it {"\u201C"}ClashPrime{"\u201D"}
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
                secureTextEntry={modalType === 'token'}
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
      </BottomSheet>
<BottomSheet
        visible={contentVisible}
        onClose={() => setContentVisible(false)}
        maxHeight="92%"
        title={contentTitle}
        subtitle={contentSubtitle || undefined}
        icon={contentIcon}
        iconSource={contentIconSource}
        contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
      >
            <ScrollView
              style={[styles.contentBody, contentIsChangelog && styles.contentBodyTall]}
              contentContainerStyle={styles.contentBodyInner}
              showsVerticalScrollIndicator={false}
            >
              {contentIsChangelog ? (
                <ChangelogBody
                  expanded={changelogExpanded}
                  onToggle={(v) => setChangelogExpanded((prev) => ({ ...prev, [v]: !prev[v] }))}
                />
              ) : (
                contentBody
              )}
            </ScrollView>
            <View style={styles.contentActions}>
              {contentActions.map((a, i) => (
                <PressableRipple
                  key={`${a.label}-${i}`}
                  style={[styles.contentBtn, a.primary && styles.contentBtnPrimary, a.destructive && styles.contentBtnDestructive]}
                  onPress={() => {
                    a.onPress?.();
                    setContentVisible(false);
                  }}
                >
                  <Text style={[styles.contentBtnText, a.primary && styles.contentBtnTextPrimary, a.destructive && styles.contentBtnTextDestructive]}>
                    {a.label}
                  </Text>
                </PressableRipple>
              ))}
            </View>
      </BottomSheet>
<OnboardingModal
        visible={showOnboarding}
        onClose={() => { setShowOnboarding(false); setOnboardingStep('tag'); setOnboardingPlayer(null); }}
        step={onboardingStep}
        setStep={setOnboardingStep}
        onboardingTag={onboardingTag}
        setOnboardingTag={setOnboardingTag}
        onboardingPlayer={onboardingPlayer}
        setOnboardingPlayer={setOnboardingPlayer}
onboardingBuilderCount={onboardingBuilderCount}
                setOnboardingBuilderCount={setOnboardingBuilderCount}
                onboardingHutsDetected={onboardingHutsDetected}
        onboardingThLevel={onboardingThLevel}
        setOnboardingThLevel={setOnboardingThLevel}
        onboardingImportJson={onboardingImportJson}
        setOnboardingImportJson={setOnboardingImportJson}
        onboardingImportResult={onboardingImportResult}
        setOnboardingImportResult={setOnboardingImportResult}
        onboardingImportTag={onboardingImportTag}
        setOnboardingImportTag={setOnboardingImportTag}
        onboardingImportError={onboardingImportError}
        setOnboardingImportError={setOnboardingImportError}
        handleOnboardingSave={handleOnboardingSave}
        handleOnboardingImportPaste={handleOnboardingImportPaste}
        handleOnboardingImportParse={handleOnboardingImportParse}
        handleOnboardingImportContinue={handleOnboardingImportContinue}
        handleOnboardingImportTokenSubmit={handleOnboardingImportTokenSubmit}
      />
<BottomSheet visible={switchModalVisible} onClose={() => setSwitchModalVisible(false)} maxHeight="90%" title="Accounts" subtitle="Tap to switch · hold to remove" icon="swap-horizontal-outline" contentContainerStyle={{ paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, paddingBottom: Spacing.xxxl }}>
        <View style={styles.switchCard}>
          {accounts.length === 0 && <Text style={styles.switchEmpty}>No accounts added</Text>}

          <ScrollView style={styles.switchList} showsVerticalScrollIndicator={false}>
            {accounts.map((acct) => {
              const isActive = acct.tag === activeAccount?.tag;
              const isSyncing = acct.tag === syncingTag;
              const acctThImage = acct.townHallLevel > 0 ? getTownHallImageSource(acct.townHallLevel) : null;
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
                    const isLast = accounts.length <= 1;
                    showDialog({
                      title: isLast ? 'Sign Out' : 'Remove Account',
                      subtitle: isLast ? 'Wipes everything for this account' : 'This only affects ClashPrime',
                      icon: isLast ? 'log-out-outline' : 'trash-outline',
                      message: isLast
                        ? `Sign out of ${acct.tag}? This is your only account, so ClashPrime will erase its cached player data, API token, saved bases, favourites and progress from this device. Your Clash of Clans account is untouched.`
                        : `Remove ${acct.tag}? This will not delete your Clash of Clans account, only remove it from ClashPrime.`,
                      actions: [
                        { label: 'Cancel', onPress: () => { } },
                        {
                          label: isLast ? 'Sign Out' : 'Remove', primary: true, destructive: true, onPress: async () => {
                            if (isLast) {
                              await signOutAccount(acct.tag);
                              await refreshAccounts();
                              setSwitchModalVisible(false);
                              // replace, not push: the tabs must not stay behind
                              // onboarding, or back would land on a settings screen
                              // for an account that no longer exists. The root
                              // layout only redirects to onboarding on mount, so
                              // this has to happen here.
                              router.replace('/onboarding');
                            } else {
                              await removeAccount(acct.tag);
                              await refreshAccounts();
                              if (isActive) {
                                const remaining = await getAccounts();
                                if (remaining.length > 0) {
                                  await handleSwitchAccount(remaining[0].tag);
                                }
                              }
                            }
                          }
                        },
                      ],
                    });
                  }}
                >
                  <View style={styles.switchAvatar}>
                    {acctThImage ? (
                      <Image source={acctThImage} style={styles.switchAvatarImg} resizeMode="contain" />
                    ) : (
                      <Ionicons name="person" size={18} color={Colors.textSecondary} />
                    )}
                  </View>
                  <View style={styles.switchItemText}>
                    <View style={styles.switchItemNameRow}>
                      <Text style={styles.switchItemName} numberOfLines={1}>{acct.name || acct.tag}</Text>
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
          </ScrollView>

          <PressableRipple
            style={styles.switchAdd}
              onPress={() => {
                setSwitchModalVisible(false);
                setOnboardingTag('');
                setOnboardingThLevel('');
                setShowOnboarding(true);
              }}
            >
              <Ionicons name="link-outline" size={18} color={Colors.textSecondary} />
              <Text style={styles.switchAddText}>Add Account</Text>
            </PressableRipple>

            <PressableRipple style={styles.switchClose} onPress={() => setSwitchModalVisible(false)}>
              <Text style={styles.switchCloseText}>Close</Text>
            </PressableRipple>
          </View>
      </BottomSheet>
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
<Dialog /></>}
    >
      <>


        <View style={styles.settingSections}>
          <SettingSection
            meta={SECTION_META.account}
            isOpen={expanded.account}
            onToggle={() => toggleSection('account')}
            isFirst
            badge="5"
          >
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
                >
                  <Text style={styles.settingValue} numberOfLines={1}>{apiToken}</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
                </SettingRow>
              </>
            ) : (
              <SettingRow
                icon={switchingAccount ? 'ellipsis-horizontal' : 'people-outline'}
                title={activeAccount?.name || 'Accounts'}
                desc={`${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'} · ${activeAccount?.tag || ''}`}
                compact
                onPress={() => setSwitchModalVisible(true)}
              >
                {switchingAccount ? (
                  <ActivityIndicator size="small" color={Colors.textSecondary} />
                ) : activeThImage ? (
                  <Image source={activeThImage} style={styles.settingThImage} resizeMode="contain" />
                ) : null}
                <Ionicons name="swap-horizontal" size={16} color={Colors.textMuted} style={{ marginLeft: 6 }} />
              </SettingRow>
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
              >
                <Text style={styles.settingValue} numberOfLines={1}>{apiToken}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
              </SettingRow>
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
    subtitle: 'Pull fresh player data now',
    icon: 'sync-outline',
                  message: 'Triggers an immediate sync of your player data from the Clash of Clans API. Use this if your stats seem outdated or after switching accounts.',
                  actions: [
                    { label: 'Cancel', onPress: () => { } },
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
          </SettingSection>

          <SettingSection
            meta={SECTION_META.appearance}
            isOpen={expanded.appearance}
            onToggle={() => toggleSection('appearance')}
            badge="3"
          >
            <SettingRow
              icon="moon-outline"
              title="Dark Mode"
              desc="Switch between dark and light theme"
              compact
            >
              <Switch
                value={isDark}
                onValueChange={(v) => setThemeMode(v)}
              />
            </SettingRow>
            <SettingRow
              icon="text-outline"
              title="Clash Font"
              desc={clashFontDesc}
              compact
            >
              <OptionSelector
                label="Clash Font"
                value={fontPref}
                options={[{ value: 'off', label: 'Off' }, { value: 'titles', label: 'Titles' }, { value: 'all', label: 'All' }]}
                onChange={setClashFontPref}
              />
            </SettingRow>
            <SettingRow
              icon="globe-outline"
              title="Show Global Levels"
              desc="Show levels beyond your Town Hall"
              compact
            >
              <Switch
                value={globalLevels}
                onValueChange={(v) => setGlobalLevelsPref(v)}
              />
            </SettingRow>
            <SettingRow
              icon="albums-outline"
              title="Base Sources"
              desc={baseSourceDesc}
              compact
              isLast
            >
              <OptionSelector
                label="Base Sources"
                value={basePref}
                options={[{ value: 'clashly', label: 'ClashLy' }, { value: 'both', label: 'Both' }, { value: 'clash-bases', label: 'Clash Bases' }]}
                onChange={setBasePref}
              />
            </SettingRow>
          </SettingSection>

          <SettingSection
            meta={SECTION_META.discounts}
            isOpen={expanded.discounts}
            onToggle={() => toggleSection('discounts')}
            badge="2"
          >
            <SettingRow
              icon="business-outline"
              title="Building Discounts"
              desc={discountDesc(discounts.buildings)}
              compact
              onPress={() => setDiscountModalScope('buildings')}
            >
              <View style={styles.discountRowRight}>
                <View style={[styles.discountDot, discounts.buildings.costPercent > 0 || discounts.buildings.timePercent > 0 ? styles.discountDotActive : null]} />
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            </SettingRow>
            <SettingRow
              icon="shield-half-outline"
              title="Army Discounts"
              desc={discountDesc(discounts.army)}
              compact
              onPress={() => setDiscountModalScope('army')}
              isLast
            >
              <View style={styles.discountRowRight}>
                <View style={[styles.discountDot, discounts.army.costPercent > 0 || discounts.army.timePercent > 0 ? styles.discountDotActive : null]} />
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            </SettingRow>
          </SettingSection>

          <SettingSection
            meta={SECTION_META.data}
            isOpen={expanded.data}
            onToggle={() => toggleSection('data')}
            badge="5"
          >
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
            />

            <SettingRow
              icon="cloud-upload-outline"
              title="Import Building Levels"
              desc="Paste a Clash of Clans JSON Export to bulk-set levels"
              compact
              onPress={() => router.push('/import-export')}
            />
            <SettingRow
              icon="hammer-outline"
              title="Builder Count"
              desc={!builderLoaded
                ? 'Loading your saved builder count…'
                : builderVerifiedCount !== null
                  ? `Number of builders · ${builderVerifiedCount} confirmed by import`
                  : 'Number of builders (2-6)'}
              compact
              onPress={() => { }}
            >
              <View style={styles.builderCountRow}>
                {builderIsVerified ? (
                  <View style={[styles.builderCountBtn, styles.builderCountBadgeBtn]}>
                    <Ionicons name="checkmark" size={16} color={Colors.success} />
                  </View>
                ) : null}
                <PressableRipple
                  style={[styles.builderCountBtn, !canDecreaseBuilders && styles.builderCountBtnDisabled]}
                  disabled={!canDecreaseBuilders}
                  onPress={() => setBuilderCount(builderCount - 1)}
                >
                  <Ionicons name="remove" size={18} color={canDecreaseBuilders ? Colors.textPrimary : Colors.textMuted} />
                </PressableRipple>
                <Text style={styles.builderCountValue}>{builderCount}</Text>
                <PressableRipple
                  style={[styles.builderCountBtn, !canIncreaseBuilders && styles.builderCountBtnDisabled]}
                  disabled={!canIncreaseBuilders}
                  onPress={() => setBuilderCount(builderCount + 1)}
                >
                  <Ionicons name="add" size={18} color={canIncreaseBuilders ? Colors.textPrimary : Colors.textMuted} />
                </PressableRipple>
              </View>
            </SettingRow>
            <SettingRow
              icon="construct-outline"
              title="Builder Base Builders"
              desc={!bbBuilderLoaded
                ? 'Loading your saved Builder Base count…'
                : `Builder Base builders (1-3)${(player?.builderHallLevel ?? 1) >= 6 ? ' · 2 granted at BH6' : ' · unlocks a 2nd at BH6'}`}
              compact
              onPress={() => { }}
            >
              <View style={styles.builderCountRow}>
                <PressableRipple
                  style={[styles.builderCountBtn, !bbBuilderLoaded && styles.builderCountBtnDisabled]}
                  disabled={!bbBuilderLoaded}
                  onPress={() => setBuilderBaseCount(Math.max(1, builderBaseCount - 1))}
                >
                  <Ionicons name="remove" size={18} color={bbBuilderLoaded ? Colors.textPrimary : Colors.textMuted} />
                </PressableRipple>
                <Text style={styles.builderCountValue}>{builderBaseCount}</Text>
                <PressableRipple
                  style={[styles.builderCountBtn, !bbBuilderLoaded && styles.builderCountBtnDisabled]}
                  disabled={!bbBuilderLoaded}
                  onPress={() => setBuilderBaseCount(Math.min(3, builderBaseCount + 1))}
                >
                  <Ionicons name="add" size={18} color={bbBuilderLoaded ? Colors.textPrimary : Colors.textMuted} />
                </PressableRipple>
              </View>
            </SettingRow>
            <SettingRow
              icon="refresh-outline"
              title="Refresh Game Data"
              desc="Reload the bundled game database"
              compact
              isLast
              onPress={() => {
                showDialog({
                  title: 'Refresh Game Data',
    subtitle: 'Bundled buildings, troops and costs',
    icon: 'refresh-outline',
                  message: 'Reloads all game reference data (buildings, troops, heroes, spells, pets, siege machines, equipment, max levels, costs) from the clash-of-clans-data package bundled with the app. No web sources are used, so this is instant.',
                  actions: [
                    { label: 'Cancel', onPress: () => { } },
                    { label: 'Reload', primary: true, onPress: async () => { await refreshGameData(); } },
                  ],
                });
              }}
            />
          </SettingSection>

          <SettingSection
            meta={SECTION_META.app}
            isOpen={expanded.app}
            onToggle={() => toggleSection('app')}
            badge="6"
          >
            <SettingRow
              icon="cloud-outline"
              title="Check for Updates"
              desc={checkingUpdates ? 'Checking GitHub for the latest release…' : 'Compare your build against the latest GitHub release'}
              compact
              onPress={checkingUpdates ? undefined : handleCheckUpdates}
            >
              {checkingUpdates ? <ActivityIndicator size="small" color={Colors.textSecondary} /> : null}
            </SettingRow>
            <SettingRow
              icon="information-circle-outline"
              title="About ClashPrime"
              desc="What this app does, its features and sources"
              compact
              onPress={openAbout}
            >
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </SettingRow>
            <SettingRow
              icon="sparkles-outline"
              title="What's New"
              desc="Recent updates and improvements"
              compact
              onPress={openChangelog}
            >
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </SettingRow>
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
          </SettingSection>

          <SettingSection
            meta={SECTION_META.developer}
            isOpen={expanded.developer}
            onToggle={() => toggleSection('developer')}
            isLast
            badge="2"
          >
            <SettingRow
              icon="person-circle-outline"
              title="Developer Info"
              desc="About the developer behind ClashPrime"
              compact
              onPress={openDeveloper}
            >
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </SettingRow>
            <SettingRow
              icon="code-slash-outline"
              title="Build Diagnostics"
              desc="Technical build details for bug reports"
              compact
              onPress={openBuildDiagnostics}
              isLast
            >
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
            </SettingRow>
          </SettingSection>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ClashPrime {appVersion}</Text>
          <View style={styles.footerMadeRow}>
            <Text style={styles.footerSubtext}>Made with </Text>
            <Image source={heartImg} style={styles.footerHeart} />
            <Text style={styles.footerSubtext}> by Parzival</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </>












    </PageScreen>
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
settingSections: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.xl,
    gap: Spacing.xs,
  },
  settingBody: {
    gap: Spacing.xs,
  },
  sectionSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  sectionBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionBadgeFirst: {
    borderTopRightRadius: Radius.lg,
  },
  sectionBadgeLast: {
    borderBottomRightRadius: Radius.lg,
  },
  sectionBadgeText: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  builderCountMessage: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
    letterSpacing: 0.1,
    marginBottom: 12,
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
  switchCard: {
    gap: Spacing.xs,
  },
  switchList: {
    flexGrow: 0,
    maxHeight: 380,
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
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
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
    gap: Spacing.md,
    paddingVertical: Spacing.md,
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
      paddingVertical: Spacing.md,
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
  modalContent: {
    gap: Spacing.sm,
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
    // No fontFamily: a hardcoded face opts the style out of the Clash font
    // applied by StyleSheet.create, so this ran in the system monospace while
    // the sentence around it used Clash.
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
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
    borderRadius: 4.5,
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
      borderRadius: Radius.md,
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
    flexDirection: 'column',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalCancelBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  modalCancelText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  modalSaveBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.textPrimary,
  },
  modalSaveText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  contentBody: {
    maxHeight: 360,
  },
  contentBodyTall: {
    maxHeight: 520,
  },
  contentBodyInner: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.base,
  },
  contentActions: {
    flexDirection: 'column',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contentBtn: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  contentBtnPrimary: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  contentBtnDestructive: {
    backgroundColor: Colors.destructive,
    borderColor: Colors.destructive,
  },
  contentBtnTextDestructive: {
    color: Colors.bg,
  },
  contentBtnText: {
    ...Typography.subhead,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  contentBtnTextPrimary: {
    color: Colors.bg,
  },
  aboutStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  aboutStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
  },
  aboutStatValue: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  aboutStatLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  aboutUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginBottom: Spacing.base,
  },
  updateBadgeText: {
    ...Typography.caption,
    color: Colors.warning,
    fontWeight: '700',
  },
  creditBlurb: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 20,
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
    paddingVertical: 4,
  },
  creditNotice: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginTop: Spacing.sm,
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
    alignSelf: 'stretch',
    marginHorizontal: 20,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  onboardingIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  onboardingTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
  },
  onboardingDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginBottom: Spacing.xs,
  },
  onboardingInput: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.md,
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
    flexDirection: 'column',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  onboardingBtn: {
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    width: '100%',
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
  onboardingConfirmText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  onboardingProfileCard: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  profileCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCardIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
  },
  profileCardIconImage: {
    width: 34,
    height: 34,
  },
  profileCardIconText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  profileCardMiddle: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  profileCardName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginBottom: Spacing.xs / 1.25,
  },
  profileCardSubtitle: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  profileCardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: Spacing.sm,
  },
  profileCardProgressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.progressTrack,
    borderRadius: 2,
    overflow: 'hidden',
  },
  profileCardProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  profileCardTimeLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
  },
  onboardingThGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    justifyContent: 'space-between'
  },
  onboardingThCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    minWidth: '48%',
    flex: 1
  },
  onboardingThImg: {
    width: 32,
    height: 32,
    marginRight: Spacing.lg,
  },
  onboardingThText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  onboardingThHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  builderCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  builderCountBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
builderCountBtnDisabled: {
    opacity: 0.45,
  },
  builderCountBadgeBtn: {
    backgroundColor: Colors.bgCardHover,
  },
  builderCountValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  builderCountBadge: {
    marginTop: 1,
  },
  builderCountValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  // circles rather than rounded squares - a bare glyph read as flat, and the
  // tight row gaps made the three tiles look like one smudged block.
  devSkillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  devSkillTile: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCardHover,
    gap: 4,
  },
devSkillIcon: {
      width: 32,
      height: 32,
      borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  devSkillName: {
    ...Typography.footnote,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  devSkillBody: {
    ...Typography.caption,
    fontSize: 10,
    lineHeight: 14,
    color: Colors.textMuted,
  },
  devProjectList: {
    gap: Spacing.xs,
  },
  devProjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
devProjectIcon: {
      width: 30,
      height: 30,
      borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  devProjectText: {
    flex: 1,
  },
  devProjectName: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  devProjectBlurb: {
    ...Typography.footnote,
    color: Colors.textTertiary,
    lineHeight: 17,
    marginTop: 1,
  },
  devTagline: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 18,
    marginTop: Spacing.md,
  },
  // Spacing, not the shared creditSectionTitle: Credits and About sit tight on
  // purpose and should not inherit this.
  devSectionTitle: {
    ...Typography.callout,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  devBlurb: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginTop: Spacing.md,
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
  onboardingImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardHover,
    marginTop: Spacing.md,
  },
  onboardingImportBtnText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  onboardingBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  onboardingGhostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  onboardingGhostBtnText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  onboardingParseBtn: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
  },
  onboardingParseBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  onboardingSummaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  onboardingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },
  onboardingSummaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  onboardingSummaryValue: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  onboardingErrorText: {
    ...Typography.caption,
    color: Colors.destructive,
    marginTop: Spacing.sm,
  },
});
