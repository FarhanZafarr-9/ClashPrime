import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
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
              }}
            />
          </TimerProvider>
        </GameDataProvider>
      </PlayerProvider>
    </SafeAreaProvider>
  );
}
