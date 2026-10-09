import React, { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
} from 'react-native';
import PressableRipple from '../src/components/PressableRipple';
import { useDialog } from '../src/components/AlertDialog';
import { useBuilderCount } from '../src/hooks/useBuilderCount';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStringAsync } from 'expo-clipboard';
import { openURL } from 'expo-linking';
import { getMaxTownHall, getBuildingItemImage, getBuildingMaxLevelAtTH } from '../src/utils/buildingData';
import { Colors, Typography, Spacing, Radius } from '../src/theme';
import { DATA_SOURCE_GROUPS, SUPERCELL_NOTICE } from '../src/data/attribution';
import {
  setPlayerTag,
  setApiToken,
  getApiToken,
  saveAccount,
  setActiveAccountTag,
  cachePlayer,
} from '../src/hooks/usePlayer';
import { usePlayer } from '../src/hooks/usePlayerContext';
import { ClashAPI } from '../src/api/clash';
import { getTownHallImageSource } from '../src/utils/buildingImages';
import { seedBuildingLevelsForTH } from '../src/utils/seedBuildingLevels';
import { parseCocExport, cocExportToBuildingLevels, detectBuilderHutCount, normalizeTag, type CocImportResult } from '../src/utils/cocExport';
import type { ClashPlayer } from '../src/types/clash';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface StepItem {
  text: string | ReactNode;
  icon?: IoniconName;
  emphasize?: boolean;
}

function StepCard({
  icon,
  title,
  desc,
  steps,
}: {
  icon: IoniconName;
  title: string;
  desc: string | ReactNode;
  steps: StepItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.stepCard, expanded && { borderTopLeftRadius: Radius.xl * 1.25, borderTopRightRadius: Radius.xl * 1.25 }]}>
      <PressableRipple style={styles.stepHeader} onPress={() => setExpanded((e) => !e)}>
        <View style={[
          styles.stepIconWrap,
          expanded && { borderTopLeftRadius: Radius.md * 1.35 },
          !expanded && { borderBottomLeftRadius: Radius.md * 1.35 },

        ]}>
          <Ionicons name={icon} size={15} color={Colors.textPrimary} />
        </View>
        <View style={styles.stepTextBlock}>
          <Text style={styles.stepTitle}>{title}</Text>
          {typeof desc === 'string' ? <Text style={styles.stepDesc} numberOfLines={1}>{desc}</Text> : desc}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textMuted} />
      </PressableRipple>
      {expanded && (
        <View style={styles.stepList}>
          {steps.map((step, i) => (
            <View key={i} style={[styles.stepRow, step.emphasize && styles.stepRowEmph]}>
              <View style={[styles.stepNum, step.emphasize && styles.stepNumEmph]}>
                {step.icon ? (
                  <Ionicons name={step.icon} size={11} color={Colors.bg} />
                ) : (
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepText, step.emphasize && styles.stepTextEmph]}>{step.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function OnboardingLoading({
  image,
  title,
  subtitle,
}: {
  image: ImageSourcePropType;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.loadingState}>
      <Image source={image} style={styles.loadingImage} resizeMode="contain" />
      <Text style={styles.loadingTitle}>{title}</Text>
      <Text style={styles.loadingSubtitle}>{subtitle}</Text>
      <ActivityIndicator size="small" color={Colors.textPrimary} style={styles.loadingSpinner} />
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { mode, th: thParam } = useLocalSearchParams<{ mode?: string; th?: string }>();
  const { player: contextPlayer, setBulkLevels, setLastMaxed, refresh, refreshAccounts } = usePlayer();
  const { show: showDialog, Dialog } = useDialog();
  const { setBuilderCount, verifyBuilderCount } = useBuilderCount();
  const [step, setStep] = useState<'form' | 'import' | 'importToken' | 'profile' | 'thPicker' | 'builderHutPicker' | 'attribution'>(mode === 'reset' ? 'thPicker' : 'form');
  const [playerData, setPlayerData] = useState<ClashPlayer | null>(null);
  const [token, setToken] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingBuilderHuts, setOnboardingBuilderHuts] = useState(2);
  const [onboardingThLevel, setOnboardingThLevel] = useState('');

  // Import flow state
  const [importJson, setImportJson] = useState('');
  const [importResult, setImportResult] = useState<CocImportResult | null>(null);
  const [importTag, setImportTag] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  /** Builder huts found in the pasted export; seeds the picker when the user
   *  goes through it instead of the import path. */
  const [importedBuilderHuts, setImportedBuilderHuts] = useState<number | null>(null);

  const currentTh = mode === 'reset' ? Number(thParam) || getMaxTownHall() : playerData?.townHallLevel || getMaxTownHall();
  const thOptions = Array.from({ length: currentTh - 1 }, (_, i) => i + 2);

  const plannedTh = parseInt(onboardingThLevel, 10) || currentTh;
  const builderHutIcon = getBuildingItemImage(
    'Builder Hut',
    getBuildingMaxLevelAtTH('Builder Hut', plannedTh) ?? 1,
  ) ?? require('../assets/images/chiefs-journey/icon.png');

  const handleParseImport = (raw: string) => {
    const parsed = parseCocExport(raw);
    if (!parsed.ok || !parsed.data) {
      setImportError(parsed.error ?? 'Failed to parse export.');
      setImportResult(null);
      setImportTag(null);
      return;
    }
    setImportError(null);
    const result = cocExportToBuildingLevels(parsed.data);
    setImportResult(result);
    setImportTag(normalizeTag(parsed.data.tag) || null);
    const huts = detectBuilderHutCount(result);
    setImportedBuilderHuts(huts);
    if (huts) setOnboardingBuilderHuts(huts);
  };

  const handleImportPaste = async () => {
    try {
      const raw = await getStringAsync();
      if (raw) {
        setImportJson(raw);
        handleParseImport(raw);
      } else {
        setImportError('Clipboard is empty. Copy the export JSON first, then try again.');
      }
    } catch {
      setImportError('Could not read the clipboard. Paste the JSON manually instead.');
    }
  };

  const handleImportContinue = async () => {
    if (!importResult || !importTag) return;
    setStep('importToken');
  };

  const handleImportTokenSubmit = async () => {
    const cleanToken = token.trim();
    if (cleanToken.length < 20) {
      setError('Enter a valid API token from clashofclans.com');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const api = new ClashAPI(cleanToken);
      const data = await api.getPlayer(importTag!);

      // Merge: API data for live fields, import for building levels
      if (!importResult) return;
      const mergedPlayer: ClashPlayer = {
        ...data,
        buildingLevels: importResult.levels,
        lastMaxedTH: data.townHallLevel || getMaxTownHall(),
      };

      await saveAccount({
        tag: importTag!,
        name: data.name,
        townHallLevel: data.townHallLevel,
        addedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
      });
      await setActiveAccountTag(importTag!);
      await refreshAccounts();
      await setPlayerTag(importTag!);
      await setApiToken(cleanToken);
      await cachePlayer(mergedPlayer, importTag!);

      // The import path skips the builder hut step, so take the count from the
      // export here — otherwise it stays at the default of 2 and every
      // time-to-max estimate is wrong. Pass the tag explicitly: the account
      // switch above has not settled into context by this render.
      const detectedHuts = detectBuilderHutCount(importResult);
      if (detectedHuts) {
        await verifyBuilderCount(detectedHuts, importTag!);
      }

      // Import provides all building levels + lastMaxedTH; skip profile/TH/builder steps
      setStep('attribution');
      setLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to connect. Check your token.');
      showDialog({
        title: 'Sign-in Failed',
        message: e.message || 'Failed to connect. Check your token.',
        actions: [{ label: 'OK', primary: true, onPress: () => { } }],
      });
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    let cleanTag = tag.trim().toUpperCase();
    if (!cleanTag.startsWith('#')) cleanTag = `#${cleanTag}`;
    const cleanToken = token.trim();
    if (cleanTag.length < 3) {
      setError('Enter a valid player tag (e.g. #PG8U2LR00)');
      return;
    }
    if (cleanToken.length < 20) {
      setError('Enter a valid API token from clashofclans.com');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const api = new ClashAPI(cleanToken);
      const data = await api.getPlayer(cleanTag);
      if (mode === 'add') {
        await saveAccount({
          tag: cleanTag,
          name: cleanTag,
          townHallLevel: data.townHallLevel,
          addedAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        });
        await setActiveAccountTag(cleanTag);
        await refreshAccounts();
        await setPlayerTag(cleanTag);
        await setApiToken(cleanToken);
      } else {
        await setPlayerTag(cleanTag);
        await setApiToken(cleanToken);
        await saveAccount({
          tag: cleanTag,
          name: cleanTag,
          townHallLevel: data.townHallLevel,
          addedAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        });
      }
      setPlayerData(data);
      setStep('profile');
      setLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to connect. Check your token and tag.');
      showDialog({
        title: 'Sign-in Failed',
        message: e.message || 'Failed to connect. Check your token and tag.',
        actions: [{ label: 'OK', primary: true, onPress: () => { } }],
      });
      setLoading(false);
    }
  };

  const handleThPick = async (selectedTh: number) => {
    if (mode !== 'reset' && !playerData) return;
    // Switch step FIRST so UI transitions before loading state
    setStep('builderHutPicker');
    setLoading(true);

    const player = mode === 'reset' ? contextPlayer : playerData;
    const currentTh = mode === 'reset' ? Number(thParam) || getMaxTownHall() : playerData?.townHallLevel || getMaxTownHall();

    const levels = seedBuildingLevelsForTH(player, selectedTh, { currentTh });

    await setBulkLevels(levels);
    await setLastMaxed(selectedTh);

    if (mode === 'reset') {
      router.back();
    } else {
      const updated: ClashPlayer = {
        ...playerData!,
        buildingLevels: levels,
        lastMaxedTH: selectedTh,
      };
      await cachePlayer(updated);
      try { await refresh(); } catch { /* proceed even if API is unreachable */ }
    }
    setLoading(false);
  };

  const handleBuilderHutNext = async () => {
    // Write against this account explicitly - on a first-time onboarding the
    // active account in context may still be a different (previous) one.
    const cleanTag = tag.trim().toUpperCase();
    await setBuilderCount(onboardingBuilderHuts, cleanTag ? (cleanTag.startsWith('#') ? cleanTag : `#${cleanTag}`) : undefined);
    setStep('attribution');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        {step === 'form' ? (
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.hero}>
              <Image source={require('../assets/icon.png')} style={styles.logo} />
              <Text style={styles.title}>ClashPrime</Text>
              <Text style={styles.subtitle}>Your Clash of Clans companion</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Player Tag</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  value={tag}
                  onChangeText={(t) => { setTag(t); setError(null); }}
                  placeholder="#YOUR-TAG"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
              <StepCard
                icon="pricetag-outline"
                title="Find your Player Tag"
                desc="Tap the profile icon in the top-left corner"
                steps={[
                  { text: 'Open Clash of Clans on your device' },
                  { text: 'Tap your profile in the top-left corner' },
                  { text: 'Copy the tag starting with "#" — e.g. #PG8U2LR00', icon: 'copy-outline', emphasize: true },
                ]}
              />

              <PressableRipple
                style={styles.importBtn}
                onPress={() => { setImportJson(''); setImportError(null); setImportResult(null); setImportTag(null); setStep('import'); }}
              >
                <Ionicons name="document-text-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.importBtnText}>Or import from Clash of Clans JSON Export</Text>
              </PressableRipple>

              <Text style={styles.label}>API Token</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  value={token}
                  onChangeText={(t) => { setToken(t); setError(null); }}
                  placeholder="Paste your API token"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  editable={!loading}
                />
                <PressableRipple style={styles.inputIcon} onPress={async () => { const t = await getStringAsync(); if (t) setToken(t); }} hitSlop={8}>
                  <Ionicons name="clipboard-outline" size={18} color={Colors.textMuted} />
                </PressableRipple>
                <PressableRipple style={styles.inputIcon} onPress={async () => { const t = await getApiToken(); if (t) setToken(t); }} hitSlop={8}>
                  <Ionicons name="refresh-outline" size={18} color={Colors.textPrimary} />
                </PressableRipple>
              </View>
              <StepCard
                icon="key-outline"
                title="Create an API Token"
                desc={<Text style={styles.stepDesc}>developer.clashofclans.com <Ionicons name="chevron-forward" size={10} color={Colors.textMuted} /> My Account <Ionicons name="chevron-forward" size={10} color={Colors.textMuted} /> API Keys</Text>}
                steps={[
                  { text: 'Open developer.clashofclans.com and sign in with your Supercell account' },
                  { text: <Text style={styles.stepText}>Go to My Account <Ionicons name="chevron-forward" size={10} color={Colors.textMuted} /> Create New Key</Text> },
                  { text: 'Name it anything (e.g. "ClashPrime") and create it' },
                  { text: 'Add 45.79.218.79 to the IP whitelist — the app uses a proxy', icon: 'shield-checkmark-outline', emphasize: true },
                ]}
              />

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <PressableRipple
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleContinue}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color={Colors.bg} />
                    <Text style={styles.btnTextLoading}>Connecting…</Text>
                  </>
                ) : (
                  <Text style={styles.btnText}>Continue</Text>
                )}
              </PressableRipple>
            </View>
          </ScrollView>
        ) : step === 'import' ? (
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.hero}>
              <Image source={require('../assets/icon.png')} style={styles.logo} />
              <Text style={styles.title}>ClashPrime</Text>
              <Text style={styles.subtitle}>Your Clash of Clans companion</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Paste Clash of Clans JSON Export</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.inputFlex, styles.importInput]}
                  value={importJson}
                  onChangeText={(t) => { setImportJson(t); setImportError(null); }}
                  placeholder={'Paste the full export JSON here…\ne.g. {"tag":"#AAAAAA","buildings":[…],…}'}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  textAlignVertical="top"
                  editable={!loading}

                />
              </View>

              <View style={styles.btnRow}>
                <PressableRipple style={styles.ghostBtn} onPress={handleImportPaste}>
                  <Ionicons name="clipboard-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.ghostBtnText}>Paste from clipboard</Text>
                </PressableRipple>
                {importJson.trim() ? (
                  <PressableRipple
                    style={styles.parseBtn}
                    onPress={() => handleParseImport(importJson)}
                    disabled={!importJson.trim()}
                  >
                    <Text style={styles.parseBtnText}>Parse</Text>
                  </PressableRipple>
                ) : null}
              </View>

              <StepCard
                icon="download-outline"
                title="Export your data from Clash of Clans"
                desc="Get your JSON export from the game settings"
                steps={[
                  { text: 'Open Clash of Clans on your device' },
                  { text: 'Tap Settings in the bottom-right corner' },
                  { text: 'Tap "Export Data" and paste the text here', icon: 'download-outline', emphasize: true },
                ]}
              />

              {importError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.destructive} />
                  <Text style={styles.errorText}>{importError}</Text>
                </View>
              ) : null}

              {importResult ? (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderIcon}>
                      <Ionicons name="checkmark-done-outline" size={20} color={Colors.success} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Export parsed successfully</Text>
                      <Text style={styles.cardSubtitle}>
                        {importResult.resolved.length} building types · {importTag ?? 'unknown tag'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Tag</Text>
                      <Text style={styles.summaryValue}>{importTag ?? '—'}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Buildings to import</Text>
                      <Text style={styles.summaryValue}>{importResult.resolved.length} types, {importResult.resolved.reduce((s: number, r: any) => s + r.copies, 0)} copies</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>In-progress upgrades</Text>
                      <Text style={styles.summaryValue}>{importResult.resolved.reduce((s: number, r: any) => s + r.timerRows.length, 0)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Builder huts</Text>
                      <Text style={styles.summaryValue}>
                        {importedBuilderHuts ? `${importedBuilderHuts} detected` : 'Not in export'}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              <PressableRipple
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleImportContinue}
                disabled={loading || !importResult}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color={Colors.bg} />
                    <Text style={styles.btnTextLoading}>Continuing…</Text>
                  </>
                ) : (
                  <Text style={styles.btnText}>Continue with this export</Text>
                )}
              </PressableRipple>
            </View>
          </ScrollView>
        ) : step === 'importToken' ? (
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.hero}>
              <Image source={require('../assets/icon.png')} style={styles.logo} />
              <Text style={styles.title}>ClashPrime</Text>
              <Text style={styles.subtitle}>Your Clash of Clans companion</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>API Token</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  value={token}
                  onChangeText={(t) => { setToken(t); setError(null); }}
                  placeholder="Paste your API token"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  editable={!loading}
                />
                <PressableRipple style={styles.inputIcon} onPress={async () => { const t = await getStringAsync(); if (t) setToken(t); }} hitSlop={8}>
                  <Ionicons name="clipboard-outline" size={18} color={Colors.textMuted} />
                </PressableRipple>
                <PressableRipple style={styles.inputIcon} onPress={async () => { const t = await getApiToken(); if (t) setToken(t); }} hitSlop={8}>
                  <Ionicons name="refresh-outline" size={18} color={Colors.textPrimary} />
                </PressableRipple>
              </View>
              <StepCard
                icon="key-outline"
                title="Create an API Token"
                    desc={<Text style={styles.stepDesc}>developer.clashofclans.com <Ionicons name="chevron-forward" size={10} color={Colors.textMuted} /> My Account <Ionicons name="chevron-forward" size={10} color={Colors.textMuted} /> API Keys</Text>}
                steps={[
                  { text: 'Open developer.clashofclans.com and sign in with your Supercell account' },
                  { text: <Text style={styles.stepText}>Go to My Account <Ionicons name="chevron-forward" size={10} color={Colors.textSecondary} /> Create New Key</Text> },
                  { text: 'Name it anything (e.g. "ClashPrime") and create it' },
                  { text: 'Add 45.79.218.79 to the IP whitelist — the app uses a proxy', icon: 'shield-checkmark-outline', emphasize: true },
                ]}
              />

              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <PressableRipple
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleImportTokenSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <ActivityIndicator size="small" color={Colors.bg} />
                    <Text style={styles.btnTextLoading}>Connecting…</Text>
                  </>
                ) : (
                  <Text style={styles.btnText}>Continue</Text>
                )}
              </PressableRipple>
            </View>
          </ScrollView>
        ) : step === 'profile' ? (
          <View style={styles.content}>
            {!loading && playerData && (
              <ScrollView
                style={styles.profileScroll}
                contentContainerStyle={styles.profileScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.hero}>
                  <Image source={require('../assets/icon.png')} style={styles.logo} />
                  <Text style={styles.title}>ClashPrime</Text>
                  <Text style={styles.subtitle}>Your Clash of Clans companion</Text>
                </View>

                <Text style={styles.profileConfirmText}>Does this profile information look right? You can go back and change the tag if needed.</Text>

                <View style={styles.profileCard}>
                  <View style={styles.profileCardRow}>
                    <View style={styles.profileCardIconWrap}>
                      <Image source={getTownHallImageSource(playerData.townHallLevel)!} style={styles.profileCardIconImage} resizeMode="contain" />
                    </View>
                    <View style={styles.profileCardMiddle}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.profileCardName} numberOfLines={1}>{playerData.name}</Text>
                        {playerData.clan && (
                          <Text style={styles.profileCardSubtitle} numberOfLines={1}>{playerData.clan.name}</Text>
                        )}
                      </View>
                      <View style={styles.profileCardProgressRow}>
                        <View style={styles.profileCardProgressTrack}>
                          <View
                            style={[
                              styles.profileCardProgressFill,
                              {
                                width: `${Math.min((playerData.townHallLevel || 1) / getMaxTownHall(), 1) * 100}%`,
                                backgroundColor: Colors.textSecondary,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.profileCardTimeLabel} numberOfLines={1}>
                          TH{playerData.townHallLevel} · {playerData.trophies?.toLocaleString()} trophies
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.profileActions}>
                  <PressableRipple
                    style={[styles.profileBtn, styles.profileBtnGhost]}
                    onPress={() => {
                      setStep('form');
                      setPlayerData(null);
                      setError(null);
                    }}
                  >
                    <Text style={[styles.profileBtnText, styles.profileBtnTextGhost]}>Back</Text>
                  </PressableRipple>
                  <PressableRipple
                    style={styles.profileBtn}
                    onPress={() => setStep('thPicker')}
                  >
                    <Text style={styles.profileBtnText}>Confirm & Continue</Text>
                  </PressableRipple>
                </View>
              </ScrollView>
            )}
            {loading && (
              <OnboardingLoading
                image={require('../assets/icon.png')}
                title="Fetching your profile"
                subtitle="Getting your village ready…"
              />
            )}
          </View>
        ) : step === 'thPicker' ? (
          <View style={styles.content}>
            {!loading && (
              <View style={styles.hero}>
                <Image
                  source={require('../assets/images/chiefs-journey/icon.png')}
                  style={styles.heroIcon}
                  resizeMode="contain"
                />
                <Text style={styles.title}>Building Levels</Text>
                <Text style={styles.subtitle}>Set your starting point for building tracking</Text>
              </View>
            )}
            {loading ? (
              <OnboardingLoading
                image={require('../assets/images/chiefs-journey/icon.png')}
                title="Setting things up"
                subtitle="Saving your starting point…"
              />
            ) : (
              <>
                <Text style={styles.thLabel}>Pick a starting reference point for your progress</Text>
                <View style={styles.thGrid}>
                  {thOptions.map((th, index, arr) => {
                    const thImg = getTownHallImageSource(th);
                    const isSelected = onboardingThLevel === String(th);
                    return (
                      <PressableRipple
                        key={th}
                        style={[
                          styles.thCell,
                          isSelected && styles.thCellSelected,
                          index === 0 && { borderTopLeftRadius: Radius.xl * 1.25 },
                          index === 1 && { borderTopRightRadius: Radius.xl * 1.25 },
                          ((index === arr.length - 2 && index % 2 === 0) || (index === arr.length - 1 && arr.length % 2 === 1) ) && { borderBottomLeftRadius: Radius.xl * 1.25 },
                          index === arr.length - 1 && { borderBottomRightRadius: Radius.xl * 1.25 },
                        ]}
                        onPress={() => setOnboardingThLevel(String(th))}
                      >
                        <Image source={thImg!} style={styles.thImg} resizeMode="contain" />
                        <Text style={[
                          styles.thText,
                          isSelected && styles.thTextSelected
                        ]}>TH{th}</Text>
                      </PressableRipple>
                    );
                  })}
                </View>
                <Text style={styles.thHint}>
                  You&apos;re on TH{currentTh}. You can change this later manually or by importing your data.
                </Text>
                <View style={styles.thPickerActions}>
                  <PressableRipple
                    style={[styles.profileBtn, styles.profileBtnGhost]}
                    onPress={() => setStep('profile')}
                  >
                    <Text style={[styles.profileBtnText, styles.profileBtnTextGhost]}>Back</Text>
                  </PressableRipple>
                  <PressableRipple
                    style={[styles.profileBtn, !onboardingThLevel && styles.btnDisabled]}
                    onPress={() => handleThPick(parseInt(onboardingThLevel, 10))}
                    disabled={!onboardingThLevel}
                  >
                    <Text style={styles.profileBtnText}>Next</Text>
                  </PressableRipple>
                </View>
              </>
            )}
          </View>
        ) : step === 'attribution' ? (
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <Image
                source={require('../assets/images/chiefs-journey/Builder.png')}
                style={styles.heroIcon}
                resizeMode="contain"
              />
              <Text style={styles.title}>Data &amp; Credits</Text>
              <Text style={styles.subtitle}>Where ClashPrime&apos;s content comes from</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.attributeIntro}>
                ClashPrime is an independent companion app. Your player data comes from the official
                Clash of Clans API, and reference content is drawn from these public projects — each
                remains the work of its own authors.
              </Text>

              {DATA_SOURCE_GROUPS.map((g) => (
                <View key={g.key} style={styles.attributeGroup}>
                  <Text style={styles.attributeGroupLabel}>{g.label}</Text>
                  {g.sources.map((s, i) => (
                    <PressableRipple
                      key={s.name}
                      style={[
                        styles.attributeRow,
                        i === 0 && styles.attributeRowFirst,
                        i === g.sources.length - 1 && styles.attributeRowLast,
                        i > 0 && styles.attributeRowDivider,
                      ]}
                      onPress={() => openURL(s.url)}
                      hitSlop={4}
                    >
                      <Ionicons name="link-outline" size={15} color={Colors.textTertiary} style={styles.attributeIcon} />
                      <View style={styles.attributeText}>
                        <Text style={styles.attributeName} numberOfLines={1}>{s.name}</Text>
                        <Text style={styles.attributeUse} numberOfLines={1}>{s.use}</Text>
                      </View>
                      <Ionicons name="open-outline" size={14} color={Colors.textMuted} />
                    </PressableRipple>
                  ))}
                </View>
              ))}

              <Text style={styles.attributeNotice}>{SUPERCELL_NOTICE}</Text>

              <PressableRipple style={styles.btn} onPress={() => router.replace('/(tabs)')}>
                <Text style={styles.btnText}>Get Started</Text>
              </PressableRipple>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.content}>
            {!loading && (
              <View style={styles.hero}>
                <Image source={builderHutIcon} style={styles.heroIcon} resizeMode="contain" />
                <Text style={styles.title}>Builder Huts</Text>
                <Text style={styles.subtitle}>How many Builder Huts do you have?</Text>
              </View>
            )}
            {loading ? (
              <OnboardingLoading
                image={require('../assets/images/chiefs-journey/Builder.png')}
                title="Setting things up"
                subtitle="Saving your building levels…"
              />
            ) : (
              <>
                <Text style={styles.thLabel}>Select your builder hut count</Text>
                <View style={styles.thGrid}>
                  {[2, 3, 4, 5].map((n, index, arr) => {
                    const isSelected = onboardingBuilderHuts === n;
                    return (
                      <PressableRipple
                        key={n}
                        style={[
                          styles.thCell,
                          isSelected && styles.thCellSelected,
                          index === 0 && { borderTopLeftRadius: Radius.xl * 1.25 },
                          index === 1 && { borderTopRightRadius: Radius.xl * 1.25 },
                          ((index === arr.length - 2 && index % 2 === 0) || (index === arr.length - 1 && arr.length % 2 === 1) ) && { borderBottomLeftRadius: Radius.xl * 1.25 },
                          index === arr.length - 1 && { borderBottomRightRadius: Radius.xl * 1.25 },
                        ]}
                        onPress={() => setOnboardingBuilderHuts(n)}
                      >
                        <Image source={builderHutIcon} style={styles.thImg} resizeMode="contain" />
                        <Text style={[
                          styles.thText,
                          isSelected && styles.thTextSelected
                        ]}>
                          {String(n)}
                        </Text>
                      </PressableRipple>
                    );
                  })}
                </View>
                <View style={styles.thPickerActions}>
                  <PressableRipple
                    style={[styles.profileBtn, styles.profileBtnGhost]}
                    onPress={() => setStep('thPicker')}
                  >
                    <Text style={[styles.profileBtnText, styles.profileBtnTextGhost]}>Back</Text>
                  </PressableRipple>
                  <PressableRipple
                    style={styles.profileBtn}
                    onPress={handleBuilderHutNext}
                  >
                    <Text style={styles.profileBtnText}>Continue</Text>
                  </PressableRipple>
                </View>
              </>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <Dialog />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  hero: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: Spacing.md,
  },
  heroIcon: {
    width: 48,
    height: 48,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    borderTopLeftRadius: Radius.xl * 1.25,
    borderTopRightRadius: Radius.xl * 1.25,
  },
  inputFlex: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md + 1,
  },
  importInput: {
    maxHeight: 100,
  },
  inputIcon: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: -4,
  },
  stepCard: {
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    borderBottomLeftRadius: Radius.xl * 1.25,
    borderBottomRightRadius: Radius.xl * 1.25,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,

  },
  stepIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTextBlock: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  stepDesc: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  stepList: {
    borderTopWidth: 0.75,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 3,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  stepRowEmph: {
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumEmph: {
    backgroundColor: Colors.textPrimary,
    borderWidth: 0,
    borderBottomLeftRadius: Radius.sm,
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  stepText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1,
  },
  stepTextEmph: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: Colors.bgSubtle,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
    minHeight: 48,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    ...Typography.headline,
    color: Colors.bg,
    fontWeight: '600',
  },
  btnTextLoading: {
    ...Typography.headline,
    color: Colors.bg,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
  thLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  thGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    justifyContent: 'space-between',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingImage: {
    width: 96,
    height: 96,
    marginBottom: Spacing.lg,
  },
  loadingTitle: {
    ...Typography.title2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  loadingSubtitle: {
    ...Typography.subhead,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  loadingSpinner: {
    marginTop: Spacing.xl,
  },
  thHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  thPickerActions: {
    flexDirection: 'column',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  profileScroll: {
    flex: 1,
  },
  profileScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  profileHero: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  profileClanBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  profileLogo: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  profileName: {
    ...Typography.largeTitle,
    color: Colors.textPrimary,
  },
  profileTag: {
    ...Typography.subhead,
    color: Colors.textTertiary,
  },
  profileClan: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  profileStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  profileStat: {
    alignItems: 'center',
    minWidth: 80,
  },
  profileStatValue: {
    ...Typography.title2,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  profileStatLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  profileConfirmText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xl
  },
  profileCard: {
    backgroundColor: Colors.bgCard,
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
  profileActions: {
    flexDirection: 'column',
    gap: Spacing.sm,
    marginTop: Spacing.lg * 2,
  },
  profileBtn: {
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    width: '100%',
  },
  profileBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileBtnTextGhost: {
    color: Colors.textSecondary,
  },
  thCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    minWidth: '48%',
    flex: 1,
  },
  thImg: {
    width: 32,
    height: 32,
    marginRight: Spacing.lg,
  },
  thText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  thCellSelected: {
    backgroundColor: Colors.textPrimary,
  },
  thTextSelected: {
    color: Colors.bg,
    fontWeight: '700',
  },
  importBtn: {
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
  importBtnText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  ghostBtn: {
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
  ghostBtnText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  parseBtn: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.textPrimary,
  },
  parseBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  cardHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...Typography.title3,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  cardSubtitle: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: 4
  },
  cardContent: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },
  summaryLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  summaryValue: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  attributeIntro: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  attributeGroup: {
    marginTop: Spacing.lg,
    gap:Spacing.xs
  },
  attributeGroupLabel: {
    ...Typography.caption,
    color: Colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  attributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCardHover,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius:4,
  },
  attributeRowFirst: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  attributeRowLast: {
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
  },
  attributeRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderSubtle,
  },
  attributeIcon: {
    marginTop: 1,
  },
  attributeText: {
    flex: 1,
  },
  attributeName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  attributeUse: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  attributeNotice: {
    ...Typography.caption,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: Spacing.md,
  },
});