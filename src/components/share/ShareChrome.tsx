import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../../theme';
import { getBuildingLevelImageSource, getTownHallImageSource } from '../../utils/buildingImages';
import { BB_LEAGUE_IMAGES } from '../../data/packageImages';
import type { ClashPlayer } from '../../types/clash';

const WATERMARK_STEP = 66;

const normalizeLeagueName = (s: string) =>
  s.toLowerCase().replace(/\bleague\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

export function getBBLeagueImage(name?: string) {
  if (!name) return undefined;
  if (BB_LEAGUE_IMAGES[name]) return BB_LEAGUE_IMAGES[name];
  const target = normalizeLeagueName(name);
  if (!target) return undefined;
  const keys = Object.keys(BB_LEAGUE_IMAGES);
  const exact = keys.find((k) => normalizeLeagueName(k) === target);
  if (exact) return BB_LEAGUE_IMAGES[exact];
  const byGroup = keys.find((k) => normalizeLeagueName(k).startsWith(`${target} `));
  if (byGroup) return BB_LEAGUE_IMAGES[byGroup];
  if (__DEV__) console.log('[ShareCard] no BB league image for', JSON.stringify(name));
  return undefined;
}

export function WatermarkLines({ width, height }: { width: number; height: number }) {
  const diag = Math.ceil(Math.hypot(width, height));
  const lineWidth = width * 1.8;
  const text = 'ClashPrime   '.repeat(Math.ceil(lineWidth / 110) + 2);
  const lines: { key: number; left: number; top: number }[] = [];
  const count = Math.ceil((diag + height) / WATERMARK_STEP) + 2;
  for (let i = 0; i < count; i++) {
    lines.push({
      key: i,
      left: -diag + i * WATERMARK_STEP,
      top: -diag + i * WATERMARK_STEP,
    });
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((l) => (
        <Text key={l.key} style={[shareStyles.watermark, { left: l.left, top: l.top, width: lineWidth }]} numberOfLines={1}>
          {text}
        </Text>
      ))}
    </View>
  );
}

export function ShareProfile({ player, showBH }: { player: ClashPlayer; showBH?: boolean }) {
  const hall = showBH ? (player.builderHallLevel ?? 1) : (player.townHallLevel ?? 0);
  const hallImage = showBH ? getBuildingLevelImageSource('Builder Hall', hall) : undefined;
  const thImage = !showBH ? getTownHallImageSource(player.townHallLevel) : null;
  const leagueIcon = (player.league?.iconUrls ?? player.leagueTier?.iconUrls)?.small;
  const bbLeague = player.builderBaseLeague?.name;
  const bbLeagueImage = getBBLeagueImage(bbLeague);

  return (
    <View style={shareStyles.profile}>
      <View style={shareStyles.profileRow}>
        <View style={shareStyles.hallWrap}>
          {hallImage ? (
            <Image source={hallImage} style={shareStyles.hallImage} resizeMode="contain" />
  ) : thImage ? (
    <Image source={thImage} style={shareStyles.hallImage} resizeMode="contain" />
  ) : (
            <View style={shareStyles.hallFallback}>
              <Text style={shareStyles.hallFallbackText}>{player.name.charAt(0)}</Text>
            </View>
          )}
        </View>
        <View style={shareStyles.profileInfo}>
          <View style={shareStyles.profileTop}>
            <Text style={shareStyles.name} numberOfLines={1} adjustsFontSizeToFit>{player.name}</Text>
            {showBH ? (
              bbLeagueImage ? (
                <Image source={bbLeagueImage} style={shareStyles.badgeLeagueIcon} resizeMode="contain" />
              ) : bbLeague ? (
                <Text style={shareStyles.bbLeagueText} numberOfLines={1}>{bbLeague}</Text>
              ) : null
            ) : leagueIcon ? (
              <Image source={{ uri: leagueIcon }} style={shareStyles.badgeLeagueIcon} />
            ) : null}
          </View>
          <View style={shareStyles.profileBottom}>
            <View style={shareStyles.tagLevelRow}>
              <Text style={shareStyles.tag} numberOfLines={1}>{player.tag}</Text>
              <Text style={shareStyles.statText}>· Lv {player.expLevel}</Text>
            </View>
            {player.clan ? (
              <View style={shareStyles.clanRow}>
                {player.clan.badgeUrls?.small ? (
                  <Image source={{ uri: player.clan.badgeUrls.small }} style={shareStyles.clanBadge} />
                ) : null}
                <Text style={shareStyles.statText} numberOfLines={1}>{player.clan.name}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export function ShareFooter({ subtitle }: { subtitle?: string }) {
  return (
    <View style={shareStyles.footerRow}>
      <Image source={require('../../../assets/images/brand/icon-96.png')} style={shareStyles.brandIcon} resizeMode="contain" />
      <View style={shareStyles.footerBrand}>
        <Text style={shareStyles.footerText}>ClashPrime</Text>
        <Text style={shareStyles.footerDesc}>The Prime Clash experience</Text>
      </View>
      <View style={shareStyles.footerSpacer} />
      {subtitle ? (
        <Text style={shareStyles.footerSub} numberOfLines={1}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export const shareStyles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.base,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  watermark: {
    position: 'absolute',
    color: Colors.textTertiary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    opacity: 0.03,
    transform: [{ rotate: '-45deg' }],
  },
  brandIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
  },
  body: {
    gap: Spacing.xl,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: Colors.borderSubtle,
    opacity: 0.6,
  },
  profile: {
    width: '100%',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.lg,
  },
  hallWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hallImage: {
    width: 70,
    height: 70,
  },
  hallFallback: {
    width: 70,
    height: 70,
    borderRadius: Radius.xl,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hallFallbackText: {
    ...Typography.title1,
    color: Colors.textSecondary,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  badgeLeagueIcon: {
    width: 22,
    height: 22,
    borderRadius: 3,
  },
  bbLeagueText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  profileBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: 4,
  },
  name: {
    ...Typography.title2,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  tag: {
    ...Typography.caption,
    color: Colors.textTertiary,
    letterSpacing: 0.3,
  },
  tagLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  clanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  statText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 11,
  },
  clanBadge: {
    width: 15,
    height: 15,
    borderRadius: 3,
  },
  content: {
    gap: Spacing.lg,
    marginTop: 4,
    marginHorizontal: 8,
    marginBottom: Spacing.xl,
  },
  rows: {
    gap: Spacing.xs,
    marginTop: 0,
  },
  row: {
    gap: 6,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowBody: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  rowIcon: {
    width: 28,
    height: 28,
  },
  rowText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 12,
    flexShrink: 1,
  },
  rowPct: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
    marginLeft: Spacing.sm,
  },
  track: {
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.progressTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.textPrimary,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.base,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  footerSpacer: {
    flex: 1,
  },
  footerBrand: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: 26,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footerDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    paddingVertical: 1,
  },
  footerSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});
