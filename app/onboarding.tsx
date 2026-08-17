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
    <View style={styles.stepCard}>
      <PressableRipple style={styles.stepHeader} onPress={() => setExpanded((e) => !e)}>
        <View style={styles.stepIconWrap}>
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

  const currentTh = mode === 'reset' ? Number(thParam) || 16 : playerData?.townHallLevel || 16;
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
    const currentTh = mode === 'reset' ? Number(thParam) || 16 : playerData?.townHallLevel || 16;

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
                  { text: 'Copy the generated token — it starts with "eyJ"', icon: 'copy-outline', emphasize: true },
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
                <View style={styles.profileHero}>
                  {playerData.clan?.badgeUrls?.small && (
                    <Image source={{ uri: playerData.clan.badgeUrls.small }} style={styles.profileClanBadge} resizeMode="contain" />
                  )}
                  <Image source={require('../assets/icon.png')} style={styles.profileLogo} />
                  <Text style={styles.profileName}>{playerData.name}</Text>
                  <Text style={styles.profileTag}>{playerData.tag}</Text>
                  {playerData.clan && (
                    <Text style={styles.profileClan}>{playerData.clan.name}</Text>
                  )}
                  <View style={styles.profileStats}>
                    <View style={styles.profileStat}>
                      <Text style={styles.profileStatValue}>TH{playerData.townHallLevel}</Text>
                      <Text style={styles.profileStatLabel}>Town Hall</Text>
                    </View>
                    {playerData.builderHallLevel && (
                      <View style={styles.profileStat}>
                        <Text style={styles.profileStatValue}>BH{playerData.builderHallLevel}</Text>
                        <Text style={styles.profileStatLabel}>Builder Hall</Text>
                      </View>
                    )}
                    <View style={styles.profileStat}>
                      <Text style={styles.profileStatValue}>{playerData.trophies?.toLocaleString()}</Text>
                      <Text style={styles.profileStatLabel}>Trophies</Text>
                    </View>
                    <View style={styles.profileStat}>
                      <Text style={styles.profileStatValue}>{playerData.warStars?.toLocaleString()}</Text>
                      <Text style={styles.profileStatLabel}>War Stars</Text>
                    </View>
                  </View>
                  <Text style={styles.profileConfirmText}>Does this look right?</Text>
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
                <ScrollView style={styles.thGrid} contentContainerStyle={styles.thGridInner}>
                  {thOptions.map((th) => {
                    const thImg = getTownHallImageUrl(th);
                    const isCurrent = th === currentTh;
                    return (
                      <View key={th} style={styles.thCell}>
                        {isCurrent && (
                          <View style={styles.thCellPill}>
                            <View style={styles.thCellPillBadge}>
                              <Ionicons name="sparkles" size={9} color={Colors.bg} />
                              <Text style={styles.thCellPillText}>Current</Text>
                            </View>
                          </View>
                        )}
                        <PressableRipple
                          style={[styles.thCellPress, isCurrent && styles.thCellPressCurrent]}
                          onPress={() => handleThPick(th)}
                        >
                          {thImg ? (
                            <Image source={{ uri: thImg }} style={styles.thCellImg} resizeMode="contain" />
                          ) : (
                            <View style={styles.thCellImgFallback}>
                              <Text style={styles.thCellImgFallbackText}>{th}</Text>
                            </View>
                          )}
                          <Text style={styles.thCellText}>TH{th}</Text>
                        </PressableRipple>
                      </View>
                    );
                  })}
                </ScrollView>
                <Text style={styles.thHint}>
                  You're on TH{currentTh}. Pick the last Town Hall you've fully maxed.
                </Text>
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
    gap: Spacing.sm,
  },
  label: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  inputFlex: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
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
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
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
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgCardHover,
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
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumEmph: {
    backgroundColor: Colors.warning,
    borderWidth: 0,
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
    borderRadius: Radius.lg,
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
    maxHeight: 400,
  },
  thGridInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    paddingVertical: Spacing.md,
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
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  profileBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
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
    width: 92,
    position: 'relative',
  },
  thCellPill: {
    position: 'absolute',
    top: -9,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 3,
    pointerEvents: 'none',
  },
  thCellPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  thCellPillText: {
    color: Colors.bg,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  thCellPress: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
  },
  thCellPressCurrent: {
    borderColor: Colors.accent,
    borderWidth: 1.25,
    backgroundColor: Colors.accentGhost,
  },
  thCellImg: {
    width: 52,
    height: 52,
  },
  thCellImgFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thCellImgFallbackText: {
    ...Typography.headline,
    color: Colors.textSecondary,
  },
  thCellText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});
