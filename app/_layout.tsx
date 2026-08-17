import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BackHandler } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { PlayerProvider } from '../src/hooks/usePlayerContext';
import { GameDataProvider } from '../src/hooks/useGameData';
import { TimerProvider } from '../src/hooks/useTimerContext';
import { useTheme, loadTheme } from '../src/theme';
import { getApiToken } from '../src/hooks/usePlayer';
import { loadDiscounts } from '../src/hooks/useDiscounts';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);
  const { isDark, colors } = useTheme();

  useEffect(() => {
    (async () => {
      await loadTheme();
      await loadDiscounts();
      const token = await getApiToken();
      if (!token) {
        router.replace('/onboarding');
      }
      setChecked(true);
      SplashScreen.hideAsync().catch(() => {});
    })();
  }, []);

  const handleBackPress = useCallback(() => {
    // Let expo-router handle back navigation within tabs
    // Return true to indicate we've handled it (prevents app exit)
    if (segments.length > 1) {
      router.back();
      return true;
    }
    return false;
  }, [router, segments.length]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  if (!checked) return null;

  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <GameDataProvider>
          <TimerProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} hidden />
            <Stack
              key={isDark ? 'dark' : 'light'}
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
                gestureEnabled: true,
              }}
            />
          </TimerProvider>
        </GameDataProvider>
      </PlayerProvider>
    </SafeAreaProvider>
  );
}
