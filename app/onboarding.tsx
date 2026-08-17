import React, { useState } from 'react';
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
} from 'react-native';
import PressableRipple from '../src/components/PressableRipple';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStringAsync } from 'expo-clipboard';
import { getMaxTownHall } from '../src/utils/buildingData';
import { Colors, Typography, Spacing, Radius } from '../src/theme';
import {
  setPlayerTag,
  setApiToken,
  saveAccount,
  setActiveAccountTag,
} from '../src/hooks/usePlayer';
import { usePlayer } from '../src/hooks/usePlayerContext';
import { ClashAPI } from '../src/api/clash';
import { cachePlayer } from '../src/hooks/usePlayer';
import { getTownHallImageUrl } from '../src/utils/thImages';
import { seedBuildingLevelsForTH } from '../src/utils/seedBuildingLevels';
import type { ClashPlayer } from '../src/types/clash';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface StepItem {
  text: string;
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
  desc: string;
  steps: StepItem[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[styles.stepCard, expanded && { borderTopLeftRadius: Radius.xl * 1.25, borderTopRightRadius: Radius.xl * 1.25 }]}>
      <PressableRipple style={styles.stepHeader} onPress={() => setExpanded((e) => !e)}>
        <View style={[
          styles.stepIconWrap,
          expanded && { borderTopLeftRadius: Radius.lg },
          !expanded && { borderBottomLeftRadius: Radius.lg },

        ]}>
          <Ionicons name={icon} size={15} color={Colors.textPrimary} />
        </View>
        <View style={styles.stepTextBlock}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepDesc} numberOfLines={1}>{desc}</Text>
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

export default function OnboardingScreen() {
  const router = useRouter();
  const { mode, th: thParam } = useLocalSearchParams<{ mode?: string; th?: string }>();
  const { player: contextPlayer, setBulkLevels, setLastMaxed, refresh, refreshAccounts } = usePlayer();
  const [step, setStep] = useState<'form' | 'profile' | 'thPicker'>(mode === 'reset' ? 'thPicker' : 'form');
  const [playerData, setPlayerData] = useState<ClashPlayer | null>(null);
  const [token, setToken] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTh = mode === 'reset' ? Number(thParam) || getMaxTownHall() : playerData?.townHallLevel || getMaxTownHall();
  const thOptions = Array.from({ length: currentTh - 1 }, (_, i) => i + 2);

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
      setLoading(false);
    }
  };

  const handleThPick = async (selectedTh: number) => {
    if (mode !== 'reset' && !playerData) return;
    setLoading(true);

    const player = mode === 'reset' ? contextPlayer : playerData;
const currentTh = mode === 'reset' ? Number(thParam) || getMaxTownHall() : playerData?.townHallLevel || getMaxTownHall();

    const levels = seedBuildingLevelsForTH(player, selectedTh, { currentTh });

    await setBulkLevels(levels);
    await setLastMaxed(selectedTh);

    if (mode === 'reset') {
      router.back();
    } else {
      playerData!.buildingLevels = levels;
      playerData!.lastMaxedTH = selectedTh;
      await cachePlayer(playerData!);
      try { await refresh(); } catch { /* proceed even if API is unreachable */ }
      router.replace('/(tabs)');
    }
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
                  editable={!loading}
                />
                <PressableRipple style={styles.inputIcon} onPress={async () => { const t = await getStringAsync(); if (t) setToken(t); }} hitSlop={8}>
                  <Ionicons name="clipboard-outline" size={18} color={Colors.textMuted} />
                </PressableRipple>
              </View>
              <StepCard
                icon="key-outline"
                title="Create an API Token"
                desc="developer.clashofclans.com → My Account → API Keys"
                steps={[
                  { text: 'Open developer.clashofclans.com and sign in with your Supercell account' },
                  { text: 'Go to My Account → Create New Key' },
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
                      <Image source={{ uri: getTownHallImageUrl(playerData.townHallLevel)! }} style={styles.profileCardIconImage} resizeMode="contain" />
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
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={Colors.textPrimary} />
                <Text style={styles.loadingStateText}>Fetching profile…</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.content}>
            {!loading && (
              <View style={styles.hero}>
                <Ionicons name="hammer-outline" size={48} color={Colors.textPrimary} />
                <Text style={styles.title}>Building Levels</Text>
                <Text style={styles.subtitle}>Set your starting point for building tracking</Text>
              </View>
            )}
            {loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="small" color={Colors.textPrimary} />
                <Text style={styles.loadingStateText}>Setting up your base…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.thLabel}>What was your last fully maxed Town Hall?</Text>
                <View style={styles.thGrid}>
                  {thOptions.map((th, index, arr) => {
                    const thImg = getTownHallImageUrl(th);
                    return (
                      <PressableRipple
                        key={th}
                        style={[
                          styles.thCell,
                          index === 0 && { borderTopLeftRadius: Radius.xl * 1.25 },
                          index === 1 && { borderTopRightRadius: Radius.xl * 1.25 },
                          index === arr.length - 2 && index % 2 === 0 && { borderBottomLeftRadius: Radius.xl * 1.25 },
                          index === arr.length - 1 && { borderBottomRightRadius: Radius.xl * 1.25 },
                        ]}
                        onPress={() => handleThPick(th)}
                      >
                        <Image source={{ uri: thImg! }} style={styles.thImg} resizeMode="contain" />
                        <Text style={styles.thText}>TH{th}</Text>
                      </PressableRipple>
                    );
                  })}
                </View>
                <Text style={styles.thHint}>
                  You're on TH{currentTh}. Pick the last Town Hall you've fully maxed.
                </Text>
                <View style={styles.thPickerActions}>
                  <PressableRipple
                    style={[styles.profileBtn, styles.profileBtnGhost]}
                    onPress={() => setStep('profile')}
                  >
                    <Text style={[styles.profileBtnText, styles.profileBtnTextGhost]}>Back</Text>
                  </PressableRipple>
                </View>
              </>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
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
    backgroundColor: Colors.warning,
    borderWidth: 0,
    borderBottomLeftRadius: Radius.sm * 1.25,
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
    gap: Spacing.sm,
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
  loadingStateText: {
    ...Typography.subhead,
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
});
