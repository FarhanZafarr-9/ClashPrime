import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Share,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { openURL } from 'expo-linking';
import { Colors, Typography, Spacing, Radius, useTheme } from '../../src/theme';
const heartImg = require('../../images/heart.png') as any;
import {
  getPlayerTag,
  setPlayerTag,
  getApiToken,
  setApiToken,
  clearAppCache,
  exportAppData,
} from '../../src/hooks/usePlayer';
import { usePlayerActions } from '../../src/hooks/usePlayerContext';
import { useDialog } from '../../src/components/AlertDialog';
import { checkForUpdateAsync, fetchUpdateAsync, reloadAsync } from 'expo-updates';

interface SettingItemProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
  loading?: boolean;
}

function SettingItem({ icon, label, value, onPress, showArrow = true, danger }: SettingItemProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.settingItem, { backgroundColor: pressed ? colors.bgCardHover : colors.bgCard, borderColor: colors.border }, pressed && { borderColor: colors.textMuted }]}
    >
      <View style={[styles.settingIcon, danger && styles.settingIconDanger]}>
        <Ionicons name={icon as any} size={16} color={danger ? Colors.bg : Colors.textSecondary} />
      </View>
      <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
      <View style={styles.settingSpacer} />
      {value && <Text style={styles.settingValue} numberOfLines={1}>{value}</Text>}
      {showArrow && <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />}
    </Pressable>
  );
}

interface SettingGroupProps {
  title?: string;
  children: React.ReactNode;
}

function SettingGroup({ title, children }: SettingGroupProps) {
  return (
    <View style={styles.group}>
      {title && <Text style={styles.groupTitle}>{title}</Text>}
      <View style={styles.groupItems}>{children}</View>
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
  const [showToken, setShowToken] = useState(false);
  const [modalOnSave, setModalOnSave] = useState<(text: string) => void>(() => { });
  const modalInputRef = useRef<TextInput>(null);

  const [contentVisible, setContentVisible] = useState(false);
  const [contentTitle, setContentTitle] = useState('');
  const [contentBody, setContentBody] = useState<React.ReactNode>(null);
  const [contentActions, setContentActions] = useState<ContentAction[]>([]);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingTag, setOnboardingTag] = useState('');
  const [onboardingToken, setOnboardingToken] = useState('');

  const maskSecret = (value: string) => value ? '•'.repeat(Math.min(value.length, 24)) : '';

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
    setShowToken(false);
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

  const handleCheckUpdates = async () => {
    try {
      const update = await checkForUpdateAsync();
      if (update.isAvailable) {
        showDialog({
          title: 'Update Available',
          message: 'A new update is available. Downloading now...',
          actions: [{ label: 'Install', primary: true, onPress: async () => { await fetchUpdateAsync(); await reloadAsync(); } }, { label: 'Later', onPress: () => {} }],
        });
      } else {
        showDialog({ title: 'Up to Date', message: 'You are on the latest version.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
      }
    } catch {
      showDialog({ title: 'Update Check Failed', message: 'Could not check for updates. Check your internet connection.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
    }
  };

  const handleClearCache = async () => {
    await clearAppCache();
    bumpTagVersion();
    showDialog({ title: 'Cache Cleared', message: 'Local cache has been cleared successfully.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
  };

  const handleExportData = async () => {
    try {
      const data = await exportAppData();
      await Share.share({
        message: data,
        title: 'ClashPrime Export',
      });
    } catch {
      showDialog({ title: 'Export Failed', message: 'Could not export data. Please try again.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] });
    }
  };

  const handleOnboardingSave = async () => {
    if (onboardingStep === 0) {
      if (onboardingTag && onboardingTag.startsWith('#')) {
        await setPlayerTag(onboardingTag);
        setPlayerTagState(onboardingTag);
        setOnboardingStep(1);
      }
    } else {
      if (onboardingToken) {
        await setApiToken(onboardingToken);
        setApiTokenState(maskSecret(onboardingToken));
        bumpTagVersion();
        setShowOnboarding(false);
      }
    }
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

        <SettingGroup title="Account">
          <SettingItem
            icon="person-outline"
            label="Player Tag"
            value={playerTag}
            onPress={handleEditTag}
          />
          <SettingItem
            icon="key-outline"
            label="API Token"
            value={apiToken}
            onPress={handleEditToken}
          />
          <SettingItem
            icon="sync-outline"
            label="Sync Now"
            onPress={() => {
              bumpTagVersion();
              showDialog({ title: 'Sync', message: 'Data will refresh now.', actions: [{ label: 'OK', primary: true, onPress: () => { } }] });
            }}
          />
        </SettingGroup>

        <SettingGroup title="Appearance">
          <View style={[styles.settingItem, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <View style={styles.settingIcon}>
              <Ionicons name="moon-outline" size={16} color={Colors.textSecondary} />
            </View>
            <Text style={styles.settingLabel}>Dark Mode</Text>
            <View style={styles.settingSpacer} />
            <Switch
              value={isDark}
              onValueChange={(v) => setThemeMode(v)}
              trackColor={{ false: Colors.border, true: Colors.textMuted }}
              thumbColor={isDark ? Colors.textPrimary : Colors.bgCard}
            />
          </View>
        </SettingGroup>

        <SettingGroup title="Data">
          <SettingItem
            icon="cloud-download-outline"
            label="Clear Cache"
            onPress={handleClearCache}
          />
          <SettingItem
            icon="download-outline"
            label="Export Data"
            onPress={handleExportData}
          />
          <SettingItem
            icon="cloud-outline"
            label="Check for Updates"
            onPress={handleCheckUpdates}
          />
        </SettingGroup>

        <SettingGroup title="About">
          <SettingItem
            icon="information-circle-outline"
            label="About ClashPrime"
            value="v2.0.0"
            onPress={() => showDialog({ title: 'ClashPrime', message: 'A premium Clash of Clans companion app.', actions: [{ label: 'OK', primary: true, onPress: () => {} }] })}
          />
          <SettingItem
            icon="document-text-outline"
            label="Privacy Policy"
            onPress={openPrivacy}
          />
          <SettingItem
            icon="heart-outline"
            label="Credits"
            onPress={openCredits}
          />
          <SettingItem
            icon="chatbubble-outline"
            label="Send Feedback"
            onPress={openFeedback}
          />
        </SettingGroup>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ClashPrime v2.0.0</Text>
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
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
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
                : 'A long alphanumeric string that grants read-only access to your profile. Generate one at developer.clashofclans.com → My Account → API Keys'}
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
                secureTextEntry={modalType === 'token' && !showToken}
                keyboardAppearance="dark"
              />
              {modalValue.length > 0 && (
                <Pressable style={styles.modalClearBtn} onPress={() => setModalValue('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </Pressable>
              )}
              {modalType === 'token' && (
                <Pressable style={styles.modalToggleBtn} onPress={() => setShowToken((s) => !s)} hitSlop={8}>
                  <Ionicons name={showToken ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>
            {modalError ? (
              <Text style={styles.modalErrorText}>{modalError}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSaveBtn}
                onPress={() => modalOnSave(modalValue)}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
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
          <Pressable style={styles.contentBackdrop} onPress={() => setContentVisible(false)} />
          <View style={styles.contentCard}>
            <View style={styles.contentHeader}>
              <Text style={styles.contentTitle}>{contentTitle}</Text>
              <Pressable onPress={() => setContentVisible(false)} style={styles.contentClose} hitSlop={8}>
                <Ionicons name="close" size={20} color={Colors.textTertiary} />
              </Pressable>
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
                <Pressable
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
                </Pressable>
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
              <Ionicons name={onboardingStep === 0 ? 'person-outline' : 'key-outline'} size={24} color={Colors.textPrimary} />
            </View>
            <Text style={styles.onboardingTitle}>
              {onboardingStep === 0 ? 'Enter Your Player Tag' : 'Enter Your API Token'}
            </Text>
            <Text style={styles.onboardingDesc}>
              {onboardingStep === 0
                ? 'Find your tag in-game under Settings → More → Show Tag'
                : 'Get your token from developer.clashofclans.com → My Account → API Keys'}
            </Text>
            <TextInput
              style={styles.onboardingInput}
              value={onboardingStep === 0 ? onboardingTag : onboardingToken}
              onChangeText={(t) => onboardingStep === 0 ? setOnboardingTag(t) : setOnboardingToken(t)}
              placeholder={onboardingStep === 0 ? '#PG8U2LR00' : 'Paste your API token'}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.onboardingActions}>
              <Pressable
                style={styles.onboardingBtn}
                onPress={handleOnboardingSave}
              >
                <Text style={styles.onboardingBtnText}>
                  {onboardingStep === 0 ? 'Continue' : 'Get Started'}
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.onboardingSkip}
              onPress={() => setShowOnboarding(false)}
            >
              <Text style={styles.onboardingSkipText}>Skip for now</Text>
            </Pressable>
            <View style={styles.onboardingMadeRow}>
              <Text style={styles.onboardingMadeText}>Made with </Text>
              <Image source={heartImg} style={styles.onboardingHeart} />
              <Text style={styles.onboardingMadeText}> by Parzival</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  group: {
    marginBottom: Spacing.xl,
  },
  groupTitle: {
    ...Typography.footnote,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  groupItems: {
    marginHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDanger: {
    backgroundColor: Colors.destructive,
  },
  settingLabel: {
    ...Typography.subhead,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  settingLabelDanger: {
    color: Colors.bg,
  },
  settingSpacer: {
    flex: 1,
  },
  settingValue: {
    ...Typography.footnote,
    color: Colors.textMuted,
    flexShrink: 1,
    fontWeight: '500',
    maxWidth: 160,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
  modalToggleBtn: {
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
    borderWidth: 1,
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
    borderRadius: Radius.full,
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
    marginTop: Spacing.sm,
  },
  creditSourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    width: '100%',
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
