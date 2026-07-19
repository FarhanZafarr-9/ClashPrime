export const Colors = {
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
  warning: '#888888',
  destructive: '#666666',
  overlay: 'rgba(0,0,0,0.6)',
  shimmer: '#1A1A1A',
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
