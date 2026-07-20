import { useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DarkColors = {
  bg: '#0A0A0A',
  bgElevated: '#141414',
  bgCard: '#1A1A1A',
  bgCardHover: '#222222',
  bgSubtle: '#111111',
  border: '#2A2A2A',
  borderSubtle: '#1E1E1E',
  textPrimary: '#FAFAFA',
  textSecondary: '#A0A0A0',
  textTertiary: '#666666',
  textMuted: '#444444',
  accent: '#FFFFFF',
  accentSubtle: 'rgba(255,255,255,0.08)',
  accentGhost: 'rgba(255,255,255,0.04)',
  success: '#A0A0A0',
  warning: '#D4A359', // Premium gold theme color
  destructive: '#666666',
  overlay: 'rgba(0,0,0,0.6)',
  shimmer: '#1A1A1A',
};

export const LightColors = {
  bg: '#F2F2F7',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardHover: '#E5E5EA',
  bgSubtle: '#E5E5EA',
  border: '#D1D1D6',
  borderSubtle: '#E5E5EA',
  textPrimary: '#1C1C1E',
  textSecondary: '#3A3A3C',
  textTertiary: '#6C6C70',
  textMuted: '#AEAEB2',
  accent: '#1C1C1E',
  accentSubtle: 'rgba(0,0,0,0.06)',
  accentGhost: 'rgba(0,0,0,0.03)',
  success: '#34C759',
  warning: '#D4A359', // Premium gold theme color
  destructive: '#FF3B30',
  overlay: 'rgba(0,0,0,0.4)',
  shimmer: '#D1D1D6',
};

// Global theme state
let isDarkTheme = true;
const listeners = new Set<() => void>();

export function isDark() {
  return isDarkTheme;
}

export async function loadTheme() {
  try {
    const val = await AsyncStorage.getItem('clashprime_theme');
    if (val !== null) {
      isDarkTheme = val === 'dark';
      notify();
    }
  } catch (e) {
    console.warn('Failed to load theme preference', e);
  }
}

export async function setThemeMode(dark: boolean) {
  isDarkTheme = dark;
  try {
    await AsyncStorage.setItem('clashprime_theme', dark ? 'dark' : 'light');
  } catch (e) {
    console.warn('Failed to save theme preference', e);
  }
  notify();
}

function notify() {
  listeners.forEach((l) => l());
}

// React Hook for subscription
export function useTheme() {
  const [dark, setDark] = useState(isDarkTheme);

  useEffect(() => {
    const l = () => setDark(isDarkTheme);
    listeners.add(l);
    // Sync initial state
    setDark(isDarkTheme);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return {
    isDark: dark,
    colors: dark ? DarkColors : LightColors,
    setThemeMode,
  };
}

// Proxy for the Colors object to dynamically return values based on current theme state
export const Colors = new Proxy({}, {
  get(target, prop) {
    const activeColors = isDarkTheme ? DarkColors : LightColors;
    return (activeColors as any)[prop];
  },
}) as typeof DarkColors;

// Monkey-patch StyleSheet.create to dynamically resolve colors at render time.
// React Native's originalCreate returns integer IDs, not style objects — so we
// keep the raw input styles ourselves and use them for color resolution.
const originalCreate = StyleSheet.create;
StyleSheet.create = function <T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  styles: T | StyleSheet.NamedStyles<T>
): T {
  const rawStyles = styles as Record<string, Record<string, any>>;
  // Still call original so RN's internal registry is populated (needed for web / some platforms)
  originalCreate(styles);

  return new Proxy({} as any, {
    get(_, propKey: string) {
      const rawStyle = rawStyles[propKey];
      if (!rawStyle || typeof rawStyle !== 'object') return undefined;

      // Build a fresh plain object with colors resolved to the current theme
      const currentColors = isDarkTheme ? DarkColors : LightColors;
      const resolved: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawStyle)) {
        if (typeof v === 'string') {
          const colorKey = (Object.keys(DarkColors) as (keyof typeof DarkColors)[]).find(
            (ck) => DarkColors[ck] === v
          );
          resolved[k] = colorKey ? currentColors[colorKey] : v;
        } else {
          resolved[k] = v;
        }
      }
      return resolved;
    },
  }) as T;
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  section: 48,
};

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 14,
  xxl: 18,
  full: 9999,
};

export const Typography = {
  largeTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 41,
  },
  title1: {
    fontSize: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  title2: {
    fontSize: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  title3: {
    fontSize: 20,
    fontWeight: '600' as const,
    letterSpacing: 0,
    lineHeight: 25,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  callout: {
    fontSize: 15,
    fontWeight: '400' as const,
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  subhead: {
    fontSize: 13,
    fontWeight: '400' as const,
    letterSpacing: 0,
    lineHeight: 18,
  },
  footnote: {
    fontSize: 12,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
    lineHeight: 16,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
};

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const Theme = {
  Colors,
  Spacing,
  Radius,
  Typography,
  Shadow,
};
