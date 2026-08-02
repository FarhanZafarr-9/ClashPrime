import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  Modal,
  Linking,
  Share,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
} from 'react-native';
import PressableRipple from '../../src/components/PressableRipple';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { openURL } from 'expo-linking';
import { getStringAsync } from 'expo-clipboard';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
import { getTownHallImageUrl } from '../../src/utils/thImages';
const heartImg = require('../../images/heart.png') as any;
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
} from '../../src/hooks/usePlayer';
import { usePlayer, usePlayerActions } from '../../src/hooks/usePlayerContext';
import { useGameData } from '../../src/hooks/useGameData';
import { useDialog } from '../../src/components/AlertDialog';
import { useDiscounts } from '../../src/hooks/useDiscounts';
import type { ScopeDiscount } from '../../src/hooks/useDiscounts';
import DiscountModal from '../../src/components/DiscountModal';
import Constants from 'expo-constants';
import { checkForUpdateAsync, fetchUpdateAsync, reloadAsync } from 'expo-updates';

const DANGER = '#F44336';

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

type PillPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

function getPillPos(pos: PillPosition, topOffset: number, rightOffset: number): React.CSSProperties | any {
  const style: any = { position: 'absolute', zIndex: 10 };
  const [vert, hor] = pos.split('-');
  if (vert === 'top') style.top = -8 + topOffset;
  if (vert === 'center') { style.top = '50%'; style.marginTop = -8; }
  if (vert === 'bottom') style.bottom = -8;
  if (hor === 'left') style.left = 12;
  if (hor === 'right') style.right = 12 + rightOffset;
  if (pos === 'center') { style.left = '50%'; style.transform = [{ translateX: -50 }]; }
  return style;
}

interface SettingRowProps {
  icon: string;
  title: string;
  desc?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  pillText?: string;
  pillPosition?: PillPosition;
  pillTopOffset?: number;
  pillRightOffset?: number;
  destructive?: boolean;
  isExtra?: boolean;
}

function SettingRow({
  icon,
  title,
  desc,
  onPress,
  onLongPress,
  children,
  disabled,
  pillText,
  pillPosition = 'top-right',
  pillTopOffset = 0,
  pillRightOffset = 0,
  destructive,
  isExtra,
}: SettingRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.settingRowContainer}>
      {pillText && (
        <View style={getPillPos(pillPosition, pillTopOffset, pillRightOffset)}>
          <View style={[styles.pill, destructive ? styles.pillDanger : { backgroundColor: colors.textPrimary, borderColor: colors.border }]}>
            <Text style={[styles.pillText, destructive ? styles.pillTextDanger : { color: colors.bg }]}>{pillText}</Text>
          </View>
        </View>
      )}
      <PressableRipple
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        style={[
          styles.settingBlock,
          { backgroundColor: isExtra ? colors.accentGhost : colors.bgCard, borderColor: colors.border },
          destructive && { backgroundColor: `${DANGER}1a`, borderColor: `${DANGER}40` },
          disabled && styles.settingBlockDisabled,
        ]}
      >
        {icon && (
          <View style={[styles.settingRowIcon, destructive && { backgroundColor: `${DANGER}2e` }]}>
            <Ionicons
              name={icon as any}
              size={15}
              color={destructive ? DANGER : colors.textPrimary}

            />
            </View>
        )}
        <View style={styles.settingTextBlock}>
          <Text style={[styles.settingTitle, destructive && { color: DANGER }]}>{title}</Text>
          {desc ? <Text style={[styles.settingDesc, destructive && { color: DANGER }]}>{desc}</Text> : null}
        </View>
        {children}
      </PressableRipple>
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
  { name: 'clash.ninja', use: 'TH max levels & in-game events' },
  { name: 'Fandom Wiki', use: 'Building images, troop, hero & pet details' },
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
    body: 'Player data is retrieved from the official Clash of Clans API using your token. Reference content such as base layouts, building images, troop details, events and community armies is fetched from public sources including ClashLy, ClashArmies, clash.ninja and the Fandom Wiki.',
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

export default function SettingsScreen() {
  const { bumpTagVersion } = usePlayerActions();
  const { switchAccount, refreshAccounts, accounts, activeAccount } = usePlayer();
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
  const [onboardingTag, setOnboardingTag] = useState('');
  const [onboardingThLevel, setOnboardingThLevel] = useState('');
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
    await setPlayerTag(tag);
    await setApiToken(token);
    const thLevel = parseInt(onboardingThLevel, 10);
    await saveAccount({
      tag,
      name: tag,
      townHallLevel: Number.isFinite(thLevel) && thLevel > 0 ? thLevel : 0,
      addedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    });
    await refreshAccounts();
    await handleSwitchAccount(tag);
    setShowOnboarding(false);
    setOnboardingTag('');
    setOnboardingThLevel('');
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
              <Text style={styles.creditName}>ClashPrime v4.0.0</Text>
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
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
                onPress={handleEditTag}
              />
              <SettingRow
                icon="key-outline"
                title="API Token"
                desc="Required for API access"
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
        </SettingCard>

        <SectionHeader>Appearance</SectionHeader>
        <SettingCard>
          <SettingRow
            icon="moon-outline"
            title="Dark Mode"
            desc="Switch between dark and light theme"
            children={
              <Switch
                value={isDark}
                onValueChange={(v) => setThemeMode(v)}
                trackColor={{ false: Colors.border, true: Colors.textMuted }}
                thumbColor={isDark ? Colors.textPrimary : Colors.bgCard}
              />
            }
          />
        </SettingCard>

        <SectionHeader>Discounts</SectionHeader>
        <SettingCard>
          <SettingRow
            icon="business-outline"
            title="Building Discounts"
            desc={discountDesc(discounts.buildings)}
            onPress={() => setDiscountModalScope('buildings')}
            children={
              <View style={styles.discountRowRight}>
                <View style={[styles.discountDot, discounts.buildings.costPercent > 0 || discounts.buildings.timePercent > 0 ? styles.discountDotActive : null]} />
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            }
          />
          <SettingRow
            icon="shield-half-outline"
            title="Army Discounts"
            desc={discountDesc(discounts.army)}
            onPress={() => setDiscountModalScope('army')}
            children={
              <View style={styles.discountRowRight}>
                <View style={[styles.discountDot, discounts.army.costPercent > 0 || discounts.army.timePercent > 0 ? styles.discountDotActive : null]} />
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            }
          />
        </SettingCard>

        <SectionHeader>Data &amp; Preferences</SectionHeader>
        <SettingCard>
          <SettingRow
            icon="trash-outline"
            title="Clear Cache"
            desc="Remove all locally cached data"
            destructive
            pillText="Destructive"
            pillTopOffset={18}
            pillRightOffset={-4}
            onPress={handleClearCache}
          />
          <SettingRow
            icon="download-outline"
            title="Export Data"
            desc="Share your data as a JSON backup"
            onPress={handleExportData}
          />
          <SettingRow
            icon="refresh-outline"
            title="Refresh Game Data"
            desc="Re-fetch reference data from the wiki"
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
          />
        </SettingCard>

        <SectionHeader>App Management</SectionHeader>
        <SettingCard>
          <SettingRow
            icon="cloud-outline"
            title="Check for Updates"
            desc="Look for the latest version"
            onPress={handleCheckUpdates}
            children={checkingUpdates ? <ActivityIndicator size="small" color={Colors.textSecondary} /> : null}
          />
          <SettingRow
            icon="information-circle-outline"
            title="About ClashPrime"
            desc="What this app does, its features and sources"
            onPress={openAbout}
            children={
              <>
                <Text style={styles.settingValue}>v4.0.0</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 6 }} />
              </>
            }
          />
          <SettingRow
            icon="document-text-outline"
            title="Privacy Policy"
            desc="How your data is handled"
            onPress={openPrivacy}
          />
          <SettingRow
            icon="heart-outline"
            title="Credits"
            desc="Made with love by Parzival"
            onPress={openCredits}
          />
          <SettingRow
            icon="chatbubble-outline"
            title="Send Feedback"
            desc="Report a bug or share an idea"
            onPress={openFeedback}
          />
        </SettingCard>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ClashPrime v4.0.0</Text>
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
            <Text style={styles.modalHint}>
              {modalType === 'tag'
                ? 'Your unique player identifier starting with #. Find it in-game under Settings → More → Show Tag.'
                : 'A long alphanumeric string that grants read-only access to your profile. Generate one at developer.clashofclans.com → My Account → API Keys. Important: whitelist IP 45.79.218.79 in your API key — the app uses a proxy to support dynamic IPs.'}
            </Text>
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
        onRequestClose={() => setShowOnboarding(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.onboardingOverlay}
        >
          <View style={styles.onboardingCard}>
            <View style={styles.onboardingIcon}>
              <Ionicons name="person-outline" size={24} color={Colors.textPrimary} />
            </View>
            <Text style={styles.onboardingTitle}>Enter Player Tag</Text>
            <Text style={styles.onboardingDesc}>
              Find your tag in-game under Profile → My Profile. The API token from your existing account will be reused.
            </Text>
            <TextInput
              style={styles.onboardingInput}
              value={onboardingTag}
              onChangeText={(t) => setOnboardingTag(t)}
              placeholder="#PG8U2LR00"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Text style={styles.onboardingFieldLabel}>Last Maxed Town Hall</Text>
            <TextInput
              style={styles.onboardingInput}
              value={onboardingThLevel}
              onChangeText={(t) => setOnboardingThLevel(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 12"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={2}
            />
            <View style={styles.onboardingActions}>
              <PressableRipple
                style={styles.onboardingBtn}
                onPress={handleOnboardingSave}
              >
                <Text style={styles.onboardingBtnText}>Connect</Text>
              </PressableRipple>
            </View>
            <PressableRipple
              style={styles.onboardingSkip}
              onPress={() => setShowOnboarding(false)}
            >
              <Text style={styles.onboardingSkipText}>Cancel</Text>
            </PressableRipple>
          </View>
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
              return (
                <PressableRipple
                  key={acct.tag}
                  style={[styles.switchItem, isActive && styles.switchItemActive]}
                  onPress={async () => {
                    if (isActive || switchingAccount) return;
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
  settingRowContainer: {
    position: 'relative',
  },
  settingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
  },
  settingBlockDisabled: {
    opacity: 0.5,
  },
  settingRowIcon: {
    marginRight: 4,
    backgroundColor: Colors.bgCardHover,
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextBlock: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 13,
    color: Colors.textTertiary,
    opacity: 0.85,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  pillDanger: {
    backgroundColor: `${DANGER}20`,
    borderColor: `${DANGER}c0`,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    lineHeight: 12,
  },
  pillTextDanger: {
    color: DANGER,
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
    borderRadius: Radius.full,
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
  onboardingFieldLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  onboardingActions: {
    width: '100%',
  },
  onboardingBtn: {
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  onboardingSkip: {
    marginTop: Spacing.sm,
  },
  onboardingSkipText: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
  onboardingBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
});
