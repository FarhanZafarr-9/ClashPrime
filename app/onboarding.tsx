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
} from '../src/hooks/usePlayer';
import { usePlayer } from '../src/hooks/usePlayerContext';
import { ClashAPI } from '../src/api/clash';
import { cachePlayer } from '../src/hooks/usePlayer';
import { getMaxLevelAtTH } from '../src/utils/thMaxLevels';
import type { ClashPlayer } from '../src/types/clash';
import { isSuperTroop } from '../src/types/clash';
import buildingLevelsData from '../src/data/building-levels.json';

const NAME_REV: Record<string, string> = {
  "Builder's Hut": 'Builder Hut',
  'Laboratory': 'Lab',
  'Wall': 'Walls',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { mode, th: thParam } = useLocalSearchParams<{ mode?: string; th?: string }>();
  const { player: contextPlayer, setBulkLevels, setLastMaxed } = usePlayer();
  const [step, setStep] = useState<'form' | 'thPicker'>(mode === 'reset' ? 'thPicker' : 'form');
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

  const handleThPick = async (selectedTh: number) => {
    const currentTh = mode === 'reset' ? Number(thParam) || 16 : playerData?.townHallLevel || 16;
    if (mode !== 'reset' && !playerData) return;
    setLoading(true);

    const player = mode === 'reset' ? contextPlayer : playerData;
    const currentBh = player?.builderHallLevel ?? 1;

    const levels: Record<string, number> = {};
    const known = (buildingLevelsData as any[]) || [];

    for (const b of known) {
      if (b.village === 'builderBase') continue;
      const storeName = NAME_REV[b.name] || b.name;
      const unlockTh = b.levels?.[0]?.['Town Hall Level'] ?? 99;
      const globalMax = b.maxLevel || (b.levels ? b.levels.length : 0);
      const thMax = getMaxLevelAtTH(storeName, selectedTh);
      const effectiveMax = thMax != null ? Math.min(globalMax, thMax) : globalMax;

      if (unlockTh <= selectedTh) {
        levels[storeName] = effectiveMax > 0 ? effectiveMax : 1;
      } else if (unlockTh <= currentTh) {
        levels[storeName] = 1;
      } else {
        levels[storeName] = 0;
      }
    }

    if (player) {
      const homeTroops = (player.troops || []).filter((t: any) => t.village === 'home' && !isSuperTroop(t.name));
      const homeSpells = (player.spells || []).filter((s: any) => s.village === 'home');
      const heroes = player.heroes || [];
      const equipment = player.heroEquipment || [];

      function inferLevel(buildingName: string, column: string, items: { name: string }[]): number {
        const b = known.find((x: any) => x.name === buildingName);
        if (!b) return 0;
        let level = 0;
        for (const lev of b.levels || []) {
          const val: string = lev[column] || '';
          if (!val) continue;
          if (items.some((i) => val === i.name || val.includes(i.name) || i.name.includes(val))) {
            level = Math.max(level, lev.Level);
          }
        }
        return level;
      }

      const setIf = (jsonName: string, lvl: number) => { if (lvl > 0) levels[NAME_REV[jsonName] || jsonName] = lvl; };

      setIf('Barracks', inferLevel('Barracks', 'Unlocked Unit', homeTroops));
      setIf('Dark Barracks', inferLevel('Dark Barracks', 'Unlocked Unit', homeTroops));
      setIf('Spell Factory', inferLevel('Spell Factory', 'Spell(s) Unlocked', homeSpells));
      setIf('Dark Spell Factory', inferLevel('Dark Spell Factory', 'Spell(s) Unlocked', homeSpells));
      setIf('Blacksmith', inferLevel('Blacksmith', 'Equipment Unlocked', equipment));
      setIf('Hero Hall', inferLevel('Hero Hall', 'Unlocked Hero', heroes));
    }

    const bbKnown = known.filter((b: any) => b.village === 'builderBase');
    for (const b of bbKnown) {
      const storeName = NAME_REV[b.name] || b.name;
      const unlockBh = b.levels?.[0]?.['Town Hall Level'] ?? 99;
      const globalMax = b.maxLevel || (b.levels ? b.levels.length : 0);
      const bhLevels = b.levels.filter((l: any) => (l['Town Hall Level'] ?? 99) <= currentBh);
      const effectiveMax = bhLevels.length > 0 ? Math.max(...bhLevels.map((l: any) => l.Level)) : 0;

      if (unlockBh <= currentBh) {
        levels[storeName] = effectiveMax > 0 ? effectiveMax : 1;
      } else {
        levels[storeName] = 0;
      }
    }

    const supplement: Record<string, Record<number, number>> = {
      'Builder Hall':         { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
      'BB Cannon':            { 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
      'Double Cannon':        { 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
      'Guard Post':           { 6: 1, 7: 2, 8: 3, 9: 4, 10: 5 },
      "O.T.T.O's Outpost":    { 10: 3 },
      'Mega Tesla':           { 9: 1, 10: 3 },
      'Push Trap':            { 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 },
      'Gem Mine':             { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 7, 10: 9 },
      'Builder Barracks':     { 2: 2, 3: 4, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 12 },
      'Star Laboratory':      { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7 },
      'Battle Machine Altar': { 5: 1, 6: 5, 7: 10, 8: 15, 9: 20, 10: 25 },
      'Reinforcement Camp':   { 8: 1, 9: 2, 10: 3 },
      'Healing Hut':          { 8: 1, 9: 2, 10: 3 },
      'Battle Copter Altar':  { 9: 1, 10: 10 },
      'Clock Tower':          { 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7 },
      "B.O.T.O's Shack":      { 10: 1 },
      'Elixir Cart':          { 1: 1 },
    };
    for (const [name, bhs] of Object.entries(supplement)) {
      const maxInRange = Math.max(...Object.entries(bhs).filter(([bh]) => Number(bh) <= currentBh).map(([, lvl]) => lvl), 0);
      if (maxInRange > 0) levels[name] = maxInRange;
    }

    await setBulkLevels(levels);
    await setLastMaxed(selectedTh);

    if (mode === 'reset') {
      router.back();
    } else {
      playerData!.buildingLevels = levels;
      playerData!.lastMaxedTH = selectedTh;
      await cachePlayer(playerData!);
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
              {Array.from({ length: (mode === 'reset' ? Number(thParam) || 16 : playerData?.townHallLevel || 16) - 1 }, (_, i) => i + 2).map((th) => (
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
