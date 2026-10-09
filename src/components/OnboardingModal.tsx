import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  type ImageSourcePropType,
} from 'react-native';
import PressableRipple from './PressableRipple';
import BottomSheet from './BottomSheet';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { getTownHallImageSource } from '../utils/buildingImages';
import { getMaxTownHall, getBuildingMaxLevelAtTH, getBuildingItemImage } from '../utils/buildingData';
import type { CocImportResult } from '../utils/cocExport';
import { getStringAsync } from 'expo-clipboard';
import { getApiToken } from '../hooks/usePlayer';
import type { ClashPlayer } from '../types/clash';

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  step: 'tag' | 'import' | 'importToken' | 'profile' | 'builderCount' | 'thPicker';
  setStep: (step: 'tag' | 'import' | 'importToken' | 'profile' | 'builderCount' | 'thPicker') => void;
  onboardingTag: string;
  setOnboardingTag: (tag: string) => void;
  onboardingPlayer: ClashPlayer | null;
  setOnboardingPlayer: (player: ClashPlayer | null) => void;
  onboardingBuilderCount: number;
  setOnboardingBuilderCount: (count: number) => void;
  onboardingThLevel: string;
  setOnboardingThLevel: (level: string) => void;
  onboardingImportJson: string;
  setOnboardingImportJson: (json: string) => void;
  onboardingImportResult: CocImportResult | null;
  setOnboardingImportResult: (result: CocImportResult | null) => void;
  onboardingImportTag: string | null;
  setOnboardingImportTag: (tag: string | null) => void;
  onboardingImportError: string | null;
  setOnboardingImportError: (error: string | null) => void;
  // Handlers
  handleOnboardingSave: () => void;
  handleOnboardingImportPaste: () => void;
  handleOnboardingImportParse: (json: string) => void;
  handleOnboardingImportContinue: () => void;
  // NOTE: signature changed — now takes the token typed in this modal's own
  // field instead of reading `modalValue` from the settings screen's
  // unrelated edit-modal. See the note after this file for the one-line
  // change needed in settings/index.tsx.
  handleOnboardingImportTokenSubmit: (token: string) => void;
}

export default function OnboardingModal({
  visible,
  onClose,
  step,
  setStep,
  onboardingTag,
  setOnboardingTag,
  onboardingPlayer,
  setOnboardingPlayer,
  onboardingBuilderCount,
  setOnboardingBuilderCount,
  onboardingThLevel,
  setOnboardingThLevel,
  onboardingImportJson,
  setOnboardingImportJson,
  onboardingImportResult,
  setOnboardingImportResult,
  onboardingImportTag,
  setOnboardingImportTag,
  onboardingImportError,
  setOnboardingImportError,
  handleOnboardingSave,
  handleOnboardingImportPaste,
  handleOnboardingImportParse,
  handleOnboardingImportContinue,
  handleOnboardingImportTokenSubmit,
}: OnboardingModalProps) {
  // Local state for the API token field on the importToken step — this
  // modal previously had no field bound to any state at all.
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');

  if (!visible) return null;

  const currentTh = onboardingPlayer?.townHallLevel || getMaxTownHall();
  const thOptions = Array.from({ length: currentTh - 1 }, (_, i) => i + 2);
  const builderHutIcon =
    getBuildingItemImage('Builder Hut', getBuildingMaxLevelAtTH('Builder Hut', currentTh) ?? 1) ??
    require('../../assets/images/chiefs-journey/icon.png');

  const STEP_HEADER: Record<
    'tag' | 'import' | 'importToken' | 'profile' | 'builderCount' | 'thPicker',
    { title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; iconSource?: ImageSourcePropType }
  > = {
    tag: { title: 'Add Account', subtitle: "Enter your player tag. We'll fetch the profile for you.", icon: 'person-add-outline' },
    import: { title: 'Import JSON Export', subtitle: 'Paste your Coc JSON Export for compelete buildings data.', icon: 'document-text-outline' },
    importToken: { title: 'API Token', subtitle: 'Enter your CoC API token to complete the import.', icon: 'key-outline' },
    profile: { title: 'Confirm Profile', subtitle: 'Does this look like your account?', icon: 'person-outline' },
    builderCount: { title: 'Builder Count', subtitle: 'How many builders do you have in Home Village?', iconSource: builderHutIcon },
    thPicker: {
      title: 'Last Maxed Town Hall',
      subtitle: 'Pick the last Town Hall you fully/partially maxed. This sets base building levels.',
      iconSource: require('../../assets/images/chiefs-journey/icon.png'),
    },
  };

  const handleTokenContinue = () => {
    const trimmed = tokenInput.trim();
    if (trimmed.length < 20) {
      setTokenError('Enter a valid API token from clashofclans.com');
      return;
    }
    setTokenError('');
    handleOnboardingImportTokenSubmit(trimmed);
  };

  const handleTokenPaste = async () => {
    try {
      const t = await getStringAsync();
      if (t) {
        setTokenInput(t);
        setTokenError('');
      }
    } catch {
      // clipboard read failed silently — user can paste manually
    }
  };

  // Refetch whatever API token is already saved on the device — same
  // shortcut as the refresh icon in app/onboarding.tsx.
  const handleTokenRefresh = async () => {
    try {
      const saved = await getApiToken();
      if (saved) {
        setTokenInput(saved);
        setTokenError('');
      }
    } catch {
      // nothing saved yet — leave the field as-is
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight="92%"
      title={STEP_HEADER[step].title}
      subtitle={STEP_HEADER[step].subtitle}
      icon={STEP_HEADER[step].icon}
      iconSource={STEP_HEADER[step].iconSource}
    >
        {step === 'tag' && (
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Player Tag</Text>
              <TextInput
                style={styles.input}
                value={onboardingTag}
                onChangeText={setOnboardingTag}
                placeholder="#PG8U2LR00"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
            <PressableRipple
              style={styles.importBtn}
              onPress={() => {
                setOnboardingImportJson('');
                setOnboardingImportError(null);
                setOnboardingImportResult(null);
                setOnboardingImportTag(null);
                setStep('import');
              }}
            >
              <Ionicons name="document-text-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.importBtnText}>Or import from Clash of Clans JSON Export</Text>
            </PressableRipple>
            <View style={styles.actions}>
              <PressableRipple style={[styles.btn, styles.btnGhost]} onPress={onClose}>
                <Text style={[styles.btnText, styles.btnTextGhost]}>Cancel</Text>
              </PressableRipple>
              <PressableRipple style={styles.btn} onPress={handleOnboardingSave} disabled={!onboardingTag.trim()}>
                <Text style={styles.btnText}>Next</Text>
              </PressableRipple>
            </View>
          </View>
        )}

        {step === 'import' && (
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Paste JSON Export</Text>
              <TextInput
                style={[styles.input, styles.importInput]}
                value={onboardingImportJson}
                onChangeText={(t) => {
                  setOnboardingImportJson(t);
                  handleOnboardingImportParse(t);
                }}
                placeholder={'Paste the full export JSON here…\ne.g. {"tag":"#AAAAAA","buildings":[…],…}'}
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View style={styles.btnRow}>
              <PressableRipple style={[styles.ghostBtn, onboardingImportJson.trim() && { borderBottomRightRadius: Radius.sm }]} onPress={handleOnboardingImportPaste}>
                <Ionicons name="clipboard-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.ghostBtnText}>Paste from clipboard</Text>
              </PressableRipple>
              {onboardingImportJson.trim() ? (
                <PressableRipple
                  style={styles.parseBtn}
                  onPress={() => handleOnboardingImportParse(onboardingImportJson)}
                  disabled={!onboardingImportJson.trim()}
                >
                  <Text style={styles.parseBtnText}>Parse</Text>
                </PressableRipple>
              ) : null}
            </View>
            {onboardingImportError ? <Text style={styles.errorText}>{onboardingImportError}</Text> : null}
            {onboardingImportResult ? (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tag</Text>
                  <Text style={styles.summaryValue}>{onboardingImportTag ?? '—'}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Buildings</Text>
                  <Text style={styles.summaryValue}>{onboardingImportResult.resolved.length} types, {onboardingImportResult.resolved.reduce((s, r) => s + r.copies, 0)} copies</Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.summaryLabel}>In-progress</Text>
                  <Text style={styles.summaryValue}>{onboardingImportResult.resolved.reduce((s, r) => s + r.timerRows.length, 0)}</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.actions}>
              <PressableRipple style={[styles.btn, styles.btnGhost]} onPress={() => setStep('tag')}>
                <Text style={[styles.btnText, styles.btnTextGhost]}>Back</Text>
              </PressableRipple>
              <PressableRipple style={styles.btn} onPress={handleOnboardingImportContinue} disabled={!onboardingImportResult}>
                <Text style={styles.btnText}>Continue</Text>
              </PressableRipple>
            </View>
          </View>
        )}

        {step === 'importToken' && (
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>API Token</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.inputFlex}
                  value={tokenInput}
                  onChangeText={(t) => { setTokenInput(t); setTokenError(''); }}
                  placeholder="Paste your API token"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <PressableRipple style={styles.inputIcon} onPress={handleTokenPaste} hitSlop={8}>
                  <Ionicons name="clipboard-outline" size={18} color={Colors.textMuted} />
                </PressableRipple>
                <PressableRipple style={styles.inputIcon} onPress={handleTokenRefresh} hitSlop={8}>
                  <Ionicons name="refresh-outline" size={18} color={Colors.textPrimary} />
                </PressableRipple>
              </View>
            </View>
            {tokenError ? <Text style={styles.errorText}>{tokenError}</Text> : null}
            <View style={styles.actions}>
              <PressableRipple style={[styles.btn, styles.btnGhost]} onPress={() => setStep('import')}>
                <Text style={[styles.btnText, styles.btnTextGhost]}>Back</Text>
              </PressableRipple>
              <PressableRipple style={styles.btn} onPress={handleTokenContinue}>
                <Text style={styles.btnText}>Continue</Text>
              </PressableRipple>
            </View>
          </View>
        )}

        {step === 'profile' && onboardingPlayer && (
          <View style={styles.card}>
            <View style={styles.profileCard}>
              <View style={styles.profileCardRow}>
                <View style={styles.profileCardIconWrap}>
                  <Image source={getTownHallImageSource(onboardingPlayer.townHallLevel)!} style={styles.profileCardIconImage} resizeMode="contain" />
                </View>
                <View style={styles.profileCardMiddle}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.profileCardName} numberOfLines={1}>{onboardingPlayer.name}</Text>
                    {onboardingPlayer.clan && <Text style={styles.profileCardSubtitle} numberOfLines={1}>{onboardingPlayer.clan.name}</Text>}
                  </View>
                  <View style={styles.profileCardProgressRow}>
                    <View style={styles.profileCardProgressTrack}>
                      <View
                        style={[
                          styles.profileCardProgressFill,
                          {
                            width: `${Math.min((onboardingPlayer.townHallLevel || 1) / getMaxTownHall(), 1) * 100}%`,
                            backgroundColor: Colors.textSecondary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.profileCardTimeLabel} numberOfLines={1}>TH{onboardingPlayer.townHallLevel} · {onboardingPlayer.trophies?.toLocaleString()} trophies</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.actions}>
              <PressableRipple
                style={[styles.btn, styles.btnGhost]}
                onPress={() => {
                  setStep('tag');
                  setOnboardingPlayer(null);
                }}
              >
                <Text style={[styles.btnText, styles.btnTextGhost]}>Back</Text>
              </PressableRipple>
              <PressableRipple style={styles.btn} onPress={handleOnboardingSave}>
                <Text style={styles.btnText}>Confirm & Continue</Text>
              </PressableRipple>
            </View>
          </View>
        )}

        {step === 'builderCount' && onboardingPlayer && (
          <View style={styles.card}>
            <View style={styles.thGrid}>
              {[2, 3, 4, 5].map((n, index, arr) => {
                const isSelected = onboardingBuilderCount === n;
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
                    onPress={() => setOnboardingBuilderCount(n)}
                  >
                    <Image source={builderHutIcon} style={styles.thImg} resizeMode="contain" />
                    <Text style={[styles.thText, isSelected && styles.thTextSelected]}>
                      {String(n)}
                    </Text>
                  </PressableRipple>
                );
              })}
            </View>
            <View style={styles.actions}>
              <PressableRipple style={[styles.btn, styles.btnGhost]} onPress={() => setStep('profile')}>
                <Text style={[styles.btnText, styles.btnTextGhost]}>Back</Text>
              </PressableRipple>
              <PressableRipple style={styles.btn} onPress={handleOnboardingSave}>
                <Text style={styles.btnText}>Continue</Text>
              </PressableRipple>
            </View>
          </View>
        )}

        {step === 'thPicker' && onboardingPlayer && (
          <View style={styles.card}>
            <View style={styles.thGrid}>
              {thOptions.map((th, index, arr) => {
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
                    <Image source={getTownHallImageSource(th)!} style={styles.thImg} resizeMode="contain" />
                    <Text style={[styles.thText, isSelected && styles.thTextSelected]}>TH{th}</Text>
                  </PressableRipple>
                );
              })}
            </View>
            <Text style={styles.thHint}>
              {`You're on TH${currentTh}. Pick the last Town Hall you've fully maxed.`}
            </Text>
            <View style={styles.actions}>
              <PressableRipple style={[styles.btn, styles.btnGhost]} onPress={() => setStep('builderCount')}>
                <Text style={[styles.btnText, styles.btnTextGhost]}>Back</Text>
              </PressableRipple>
              <PressableRipple style={styles.btn} onPress={handleOnboardingSave} disabled={!onboardingThLevel}>
                <Text style={styles.btnText}>Continue</Text>
              </PressableRipple>
            </View>
          </View>
        )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
  },
  inputGroup: {
    width: '100%',
    gap: Spacing.xs,
  },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  input: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.sm,
    borderTopLeftRadius: Radius.xl * 1.25,
    borderTopRightRadius: Radius.xl * 1.25,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    width: '100%',
  },
  importInput: {
    maxHeight: 100,
  },
  // Standalone input row for the API token step — no companion button
  // below it anymore (paste + refresh live inline), so it gets uniform
  // rounding instead of the top-only half of a grouped pair.
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSubtle,
    borderRadius: Radius.md,
    width: '100%',
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
  actions: {
    width: '100%',
    flexDirection: 'column',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  btn: {
    backgroundColor: Colors.textPrimary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    width: '100%',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
    textAlign: 'center',
  },
  btnTextGhost: {
    color: Colors.textSecondary,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: Radius.sm,
    borderBottomLeftRadius: Radius.xl * 1.25,
    borderBottomRightRadius: Radius.xl * 1.25,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardHover,
  },
  importBtnText: {
    ...Typography.subhead,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  btnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  ghostBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.sm,
    borderBottomLeftRadius: Radius.xl * 1.25,
    borderBottomRightRadius: Radius.xl * 1.25,
    borderWidth: 0.75,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCardHover,
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
    borderRadius: Radius.sm,
    borderBottomRightRadius: Radius.xl * 1.25,
    backgroundColor: Colors.textPrimary,
  },
  parseBtnText: {
    ...Typography.subhead,
    color: Colors.bg,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.xl,
    borderWidth: 0.75,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
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
  errorText: {
    ...Typography.caption,
    color: Colors.destructive,
    marginTop: Spacing.sm,
  },
  thGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    justifyContent: 'space-between',
  },
  thCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCardHover,
    borderRadius: Radius.sm,
    minWidth: '48%',
    flex: 1,
  },
  thCellSelected: {
    backgroundColor: Colors.textPrimary,
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
  thTextSelected: {
    color: Colors.bg,
    fontWeight: '700',
  },
  thHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  profileCard: {
    backgroundColor: Colors.bgCardHover,
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
});