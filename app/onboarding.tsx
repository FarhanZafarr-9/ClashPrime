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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getStringAsync } from 'expo-clipboard';
import { Colors, Typography, Spacing, Radius } from '../src/theme';
import {
  setPlayerTag,
  setApiToken,
  setBulkBuildingLevels,
  setLastMaxedTH,
} from '../src/hooks/usePlayer';
import { ClashAPI } from '../src/api/clash';
import { cachePlayer } from '../src/hooks/usePlayer';
import { getBuildingData, getBuildingEffectiveMax } from '../src/utils/buildingImages';
import type { ClashPlayer } from '../src/types/clash';
import buildingLevelsData from '../src/data/building-levels.json';

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'thPicker'>('form');
  const [playerData, setPlayerData] = useState<ClashPlayer | null>(null);
  const [token, setToken] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const tagNoHash = cleanTag.replace('#', '');
      const cosRes = await fetch(`https://www.clashofstats.com/players/${tagNoHash}`);
      if (!cosRes.ok) {
        setError('Player tag not found on Clash of Stats. Double-check your tag.');
        setLoading(false);
        return;
      }

      const api = new ClashAPI(cleanToken);
      const data = await api.getPlayer(cleanTag);
      await setPlayerTag(cleanTag);
      await setApiToken(cleanToken);
      setPlayerData(data);
      setStep('thPicker');
      setLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to connect. Check your token and tag.');
      setLoading(false);
    }
  };

  const handleThPick = async (th: number) => {
    if (!playerData) return;
    setLoading(true);

    const levels: Record<string, number> = {};
    const known = (buildingLevelsData as any[]) || [];
    for (const b of known) {
      const emax = getBuildingEffectiveMax(b.name, th);
      if (emax > 0) levels[b.name] = emax;
    }

    await setBulkBuildingLevels(levels);
    await setLastMaxedTH(th);
    playerData.buildingLevels = levels;
    playerData.lastMaxedTH = th;
    await cachePlayer(playerData);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        {step === 'form' ? (
          <View style={styles.content}>
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
              <Text style={styles.hint}>Find it in-game under Profile → My Profile</Text>

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
              <Text style={styles.hint}>Get it from developer.clashofclans.com → My Account → API Keys (whitelist IP 45.79.218.79 — the app uses a proxy)</Text>

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
                  <ActivityIndicator size="small" color={Colors.bg} />
                ) : (
                  <Text style={styles.btnText}>Continue</Text>
                )}
              </PressableRipple>
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            <View style={styles.hero}>
              <Ionicons name="hammer-outline" size={48} color={Colors.textPrimary} />
              <Text style={styles.title}>Building Levels</Text>
              <Text style={styles.subtitle}>Set your starting point for building tracking</Text>
            </View>
            <Text style={styles.thLabel}>What was your last fully maxed Town Hall?</Text>
            <ScrollView style={styles.thGrid} contentContainerStyle={styles.thGridInner}>
              {Array.from({ length: (playerData?.townHallLevel || 16) - 1 }, (_, i) => i + 2).map((th) => (
                <PressableRipple
                  key={th}
                  style={styles.thCell}
                  onPress={() => handleThPick(th)}
                  disabled={loading}
                >
                  <Text style={styles.thCellText}>TH{th}</Text>
                </PressableRipple>
              ))}
            </ScrollView>
            {loading && <ActivityIndicator size="small" color={Colors.textPrimary} style={{ marginTop: Spacing.md }} />}
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
  },
  thCell: {
    width: 80,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 0.75,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thCellText: {
    ...Typography.headline,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});
