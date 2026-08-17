import { Stack, useRouter, useNavigationContainerRef } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BackHandler } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useFonts } from 'expo-font';
import { PlayerProvider } from '../src/hooks/usePlayerContext';
import { GameDataProvider } from '../src/hooks/useGameData';
import { TimerProvider } from '../src/hooks/useTimerContext';
import { useTheme, loadTheme, loadClashFontPref, setClashFontLoaded, useClashFontPref } from '../src/theme';
import { getApiToken } from '../src/hooks/usePlayer';
import { loadDiscounts } from '../src/hooks/useDiscounts';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const [checked, setChecked] = useState(false);
  const { isDark, colors } = useTheme();
  const { pref: fontPref } = useClashFontPref();

  const [fontsLoaded, fontError] = useFonts({
    'Clash-Regular': require('../assets/fonts/Clash-Regular.ttf'),
    'Clash-Bold': require('../assets/fonts/Clash-Bold.ttf'),
  });
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    (async () => {
      await loadTheme();
      await loadClashFontPref();
      await loadDiscounts();
      const token = await getApiToken();
      if (!token) {
        router.replace('/onboarding');
      }
      setChecked(true);
    })();
  }, []);

  useEffect(() => {
    setClashFontLoaded(fontsLoaded);
  }, [fontsLoaded]);

  useEffect(() => {
    if (checked && fontsReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [checked, fontsReady]);

  const handleBackPress = useCallback(() => {
    const navigation = navigationRef.current;
    if (!navigation) {
      return false;
    }
    const rootState = navigation.getRootState();
    const appStack = rootState.routes[0]?.state as
      | { key: string; index: number; routes: { name: string; state?: unknown }[] }
      | undefined;
    if (!appStack || !Array.isArray(appStack.routes)) {
      return false;
    }
    if (appStack.routes.length > 1 && appStack.index === appStack.routes.length - 1) {
      navigation.dispatch({ type: 'GO_BACK', target: appStack.key });
      return true;
    }
    const tabsRoute = appStack.routes.find((r) => r.name === '(tabs)');
    const tabState = tabsRoute?.state as
      | { key: string; history: { key: string }[] }
      | undefined;
    if (tabState && tabState.history && tabState.history.length > 1) {
      navigation.dispatch({ type: 'GO_BACK', target: tabState.key });
      return true;
    }
    return false;
  }, [navigationRef]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [handleBackPress]);

  if (!checked || !fontsReady) return null;

  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <GameDataProvider>
          <TimerProvider>
            <StatusBar style={isDark ? 'light' : 'dark'} hidden />
            <Stack
              key={`${isDark ? 'dark' : 'light'}-${fontPref}`}
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
