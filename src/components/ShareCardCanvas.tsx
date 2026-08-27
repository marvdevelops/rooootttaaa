import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Logo from './Logo';
import { RaceFlagIcon } from './icons';
import { colors, fonts, radii } from '../theme/theme';
import { formatDuration } from '../utils/completionsApi';

interface Props {
  raceTitle: string;
  brandPrimaryColor: string;
  brandAccentColor: string;
  organizerLogoUrl: string | null;
  organizerName: string | null;
  athleteUsername: string;
  athleteAvatarUrl: string | null;
  distanceMeters: number;
  finishTimeSeconds: number;
  paceSecondsPerKm: number | null;
  /** Local file URI of the selfie, once captured. Shown as a placeholder cutout until then. */
  selfieUri: string | null;
}

function formatPace(secondsPerKm: number | null): string {
  if (!secondsPerKm) return '--:--';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The fixed 1080x1920 (9:16, full-screen story format — Instagram/TikTok
 * Stories, matching how Strava/Coros finish cards are built) branded finish
 * layout, captured as a single image via react-native-view-shot. Kept as
 * its own component (not inlined in the screen) so the exact pixel layout
 * used for the on-screen preview is identical to what gets captured — no
 * separate "export version" to drift out of sync.
 *
 * Layout: full-bleed selfie as the background, a bottom gradient for text
 * legibility, race branding pinned top, and a big stat block pinned bottom
 * — same visual language as a Strava/Coros finish share: the photo is the
 * hero, the numbers are the payoff, everything else stays out of the way.
 */
export default function ShareCardCanvas({
  raceTitle,
  brandPrimaryColor,
  brandAccentColor,
  organizerLogoUrl,
  organizerName,
  athleteUsername,
  athleteAvatarUrl,
  distanceMeters,
  finishTimeSeconds,
  paceSecondsPerKm,
  selfieUri,
}: Props) {
  return (
    <View style={[styles.card, { backgroundColor: brandAccentColor }]}>
      <View style={styles.photoWrap}>
        {selfieUri ? (
          <Image source={{ uri: selfieUri }} style={styles.photoImage} />
        ) : athleteAvatarUrl ? (
          <Image source={{ uri: athleteAvatarUrl }} style={styles.photoImage} />
        ) : (
          <View style={[styles.photoPlaceholder, { borderColor: brandPrimaryColor }]}>
            <Text style={styles.photoPlaceholderText}>TAP TO ADD SELFIE</Text>
          </View>
        )}
      </View>

      {/* Top-anchored scrim — keeps the finisher pill/organizer logo readable over a bright sky without darkening the whole photo. */}
      <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={styles.topScrim} pointerEvents="none" />

      <View style={styles.topRow}>
        <View style={[styles.finisherPill, { backgroundColor: brandPrimaryColor }]}>
          <RaceFlagIcon size={11} color={colors.white} />
          <Text style={styles.finisherPillText}>FINISHER</Text>
        </View>
        {organizerLogoUrl && <Image source={{ uri: organizerLogoUrl }} style={styles.orgLogo} resizeMode="contain" />}
      </View>

      {/* Bottom scrim — the deep gradient that carries the whole stat block, same device Strava/Coros use so a bright background photo never fights the numbers. */}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']} style={styles.bottomScrim} pointerEvents="none" />

      <View style={styles.bottomBlock}>
        <Text style={[styles.raceTitle, { color: brandPrimaryColor }]} numberOfLines={2}>
          {raceTitle}
        </Text>
        <Text style={styles.athleteName}>{athleteUsername}</Text>
        {organizerName && <Text style={styles.organizerName}>Organized by {organizerName}</Text>}

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{(distanceMeters / 1000).toFixed(2)}</Text>
            <Text style={styles.statLabel}>KM</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{formatDuration(finishTimeSeconds)}</Text>
            <Text style={styles.statLabel}>TIME</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{formatPace(paceSecondsPerKm)}</Text>
            <Text style={styles.statLabel}>/KM PACE</Text>
          </View>
        </View>

        <View style={styles.footerBrandRow}>
          <Logo bare showWordmark={false} size={16} />
          <Text style={[styles.footerBrand, { color: brandPrimaryColor }]}>ROOTAH</Text>
        </View>
      </View>
    </View>
  );
}

const CARD_WIDTH = 337.5;
const CARD_HEIGHT = 600; // 9:16 — matches Instagram/TikTok Stories

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  photoWrap: {
    ...StyleSheet.absoluteFill,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
    margin: 24,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.white,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  topRow: {
    position: 'absolute',
    top: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  finisherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
  },
  finisherPillText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.white,
  },
  orgLogo: {
    width: 36,
    height: 36,
    borderRadius: radii.xs,
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 320,
  },
  bottomBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingBottom: 22,
    paddingTop: 16,
    alignItems: 'center',
  },
  raceTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    textAlign: 'center',
  },
  athleteName: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: colors.white,
    marginTop: 4,
    textAlign: 'center',
  },
  organizerName: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 3,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 18,
    width: '100%',
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.white,
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  footerBrand: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    letterSpacing: 4,
  },
});
