import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { PlayerProvider } from '../src/hooks/usePlayerContext';
import { Colors } from '../src/theme';
import { getApiToken } from '../src/hooks/usePlayer';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getApiToken();
      if (!token) {
        router.replace('/onboarding');
      }
      setChecked(true);
    })();
  }, []);

  if (!checked) return null;

  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <StatusBar style="light" hidden />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.bg },
            animation: 'fade',
          }}
        />
      </PlayerProvider>
    </SafeAreaProvider>
  );
}
