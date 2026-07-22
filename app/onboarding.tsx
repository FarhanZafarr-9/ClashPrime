import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius } from '../src/theme';
import { setPlayerTag, setApiToken } from '../src/hooks/usePlayer';
import { ClashAPI } from '../src/api/clash';
import { cachePlayer } from '../src/hooks/usePlayer';

export default function OnboardingScreen() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    const cleanTag = tag.trim();
    const cleanToken = token.trim();
    if (!cleanTag.startsWith('#') || cleanTag.length < 3) {
      setError('Enter a valid player tag starting with #');
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
      await setPlayerTag(cleanTag);
      await setApiToken(cleanToken);
      await cachePlayer(data);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Failed to connect. Check your token and tag.');
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <View style={styles.content}>
          <View style={styles.hero}>
            <Image source={require('../assets/icon.png')} style={styles.logo} />
            <Text style={styles.title}>ClashPrime</Text>
            <Text style={styles.subtitle}>Your Clash of Clans companion</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Player Tag</Text>
            <TextInput
              style={styles.input}
              value={tag}
              onChangeText={(t) => { setTag(t); setError(null); }}
              placeholder="#YOUR-TAG"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!loading}
            />
            <Text style={styles.hint}>Find it in-game under Profile → My Profile</Text>

            <Text style={styles.label}>API Token</Text>
            <TextInput
              style={styles.input}
              value={token}
              onChangeText={(t) => { setToken(t); setError(null); }}
              placeholder="Paste your API token"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              editable={!loading}
            />
            <Text style={styles.hint}>Get it from developer.clashofclans.com → My Account → API Keys</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleContinue}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.bg} />
              ) : (
                <Text style={styles.btnText}>Continue</Text>
              )}
            </Pressable>
          </View>
        </View>
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
  input: {
    ...Typography.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  hint: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: -4,
  },
  errorBox: {
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
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
});
