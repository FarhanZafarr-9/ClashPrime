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
  progressTrack: '#2A2A2A',
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
  shimmer: '#555555',
};

export const LightColors = {
  bg: '#F2F2F7',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  bgCardHover: '#E5E5EA',
  bgSubtle: '#E5E5EA',
  border: '#D1D1D6',
  borderSubtle: '#E5E5EA',
  progressTrack: '#D1D1D6',
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
  shimmer: '#B0B0B5',
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

// Optional Clash font: 'off' | 'titles' | 'all'
export type FontPref = 'off' | 'titles' | 'all';

// Properties that mark a style as text so "all" mode can target every label.
const FONT_TEXT_PROPS = ['fontSize', 'fontWeight', 'fontVariant', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform', 'fontStyle'] as const;

// Clash glyphs render large, so scale sizes down when the font is active.
const CLASH_FONT_SCALE = 0.85;

let clashFontPref: FontPref = 'off';
let clashFontLoaded = false;

export function isClashFontLoaded() {
  return clashFontLoaded;
}

export function setClashFontLoaded(loaded: boolean) {
  if (clashFontLoaded === loaded) return;
  clashFontLoaded = loaded;
  notify();
}

export function getClashFontPref() {
  return clashFontPref;
}

export async function loadClashFontPref() {
  try {
    const val = await AsyncStorage.getItem('clashprime_clashfont');
    if (val === 'off' || val === 'titles' || val === 'all') {
      clashFontPref = val;
      notify();
    }
  } catch (e) {
    console.warn('Failed to load font preference', e);
  }
}

export async function setClashFontPref(pref: FontPref) {
  clashFontPref = pref;
  try {
    await AsyncStorage.setItem('clashprime_clashfont', pref);
  } catch (e) {
    console.warn('Failed to save font preference', e);
  }
  notify();
}

// Resolve the Clash font family for inline styles (not routed through StyleSheet).
// Returns undefined when the font is off or the style is below 'titles' size.
export function clashFontFamily(weight: number | string = 400, fontSize?: number): string | undefined {
  if (!clashFontLoaded || clashFontPref === 'off') return undefined;
  if (clashFontPref === 'titles' && (!fontSize || fontSize < 20)) return undefined;
  let w = typeof weight === 'number' ? weight : parseInt(String(weight), 10);
  if (String(weight) === 'bold') w = 700;
  return w >= 600 ? 'Clash-Bold' : 'Clash-Regular';
}

// React Hook for the Clash font preference
export function useClashFontPref() {
  const [pref, setPref] = useState<FontPref>(clashFontPref);

  useEffect(() => {
    const l = () => setPref(clashFontPref);
    listeners.add(l);
    // Sync initial state
    setPref(clashFontPref);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return {
    pref,
    loaded: clashFontLoaded,
    setClashFontPref,
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
  // Palette that was active when the style was defined. Colors captured from
  // `Colors.*` are values from this palette; reversing against any other
  // palette would mis-map shared values (e.g. #FFFFFF is `accent` in dark but
  // `bgCard`/`bgElevated` in light) and leave cards dark in light mode.
  const capturePalette = isDarkTheme ? DarkColors : LightColors;
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
          const colorKey = (Object.keys(capturePalette) as (keyof typeof DarkColors)[]).find(
            (ck) => capturePalette[ck] === v
          );
          resolved[k] = colorKey ? currentColors[colorKey] : v;
        } else {
          resolved[k] = v;
        }
      }

      // Apply the Clash font when enabled: 'titles' only touches large styles,
      // 'all' applies to every text style. Clash glyphs run big, so sizes are
      // scaled down at the same time.
      if (clashFontLoaded && clashFontPref !== 'off' && !rawStyle.fontFamily) {
        const isTextStyle = FONT_TEXT_PROPS.some((p) => rawStyle[p] != null);
        const fontSize = typeof rawStyle.fontSize === 'number' ? rawStyle.fontSize : 0;
        if (isTextStyle && (clashFontPref === 'all' || fontSize >= 20)) {
          let weight = typeof rawStyle.fontWeight === 'number'
            ? rawStyle.fontWeight
            : parseInt(String(rawStyle.fontWeight), 10);
          if (String(rawStyle.fontWeight) === 'bold') weight = 700;
          resolved.fontFamily = weight >= 600 ? 'Clash-Bold' : 'Clash-Regular';
          delete resolved.fontWeight;
          if (typeof rawStyle.fontSize === 'number') {
            resolved.fontSize = Math.max(9, Math.round(rawStyle.fontSize * CLASH_FONT_SCALE));
            if (typeof rawStyle.lineHeight === 'number') {
              resolved.lineHeight = Math.round(rawStyle.lineHeight * CLASH_FONT_SCALE);
            }
          }
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
