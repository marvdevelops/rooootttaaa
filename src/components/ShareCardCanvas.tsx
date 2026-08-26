import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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
 * The fixed 1080x1350 (4:5, Instagram-portrait) branded finish layout,
 * captured as a single image via react-native-view-shot. Kept as its own
 * component (not inlined in the screen) so the exact pixel layout used for
 * the on-screen preview is identical to what gets captured — no separate
 * "export version" to drift out of sync.
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
      <View style={styles.selfieWrap}>
        {selfieUri ? (
          <Image source={{ uri: selfieUri }} style={styles.selfieImage} />
        ) : athleteAvatarUrl ? (
          <Image source={{ uri: athleteAvatarUrl }} style={styles.selfieImage} />
        ) : (
          <View style={[styles.selfiePlaceholder, { borderColor: brandPrimaryColor }]}>
            <Text style={styles.selfiePlaceholderText}>TAP TO ADD SELFIE</Text>
          </View>
        )}
      </View>

      <View style={styles.header}>
        {organizerLogoUrl && <Image source={{ uri: organizerLogoUrl }} style={styles.orgLogo} resizeMode="contain" />}
        <Text style={[styles.raceTitle, { color: brandPrimaryColor }]} numberOfLines={2}>
          {raceTitle}
        </Text>
        {organizerName && <Text style={styles.organizerName}>by {organizerName}</Text>}
        <Text style={styles.athleteName}>{athleteUsername}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{(distanceMeters / 1000).toFixed(2)}</Text>
          <Text style={styles.statLabel}>KM</Text>
        </View>
        <View style={[styles.statTile, styles.statTileMid, { borderColor: brandPrimaryColor }]}>
          <Text style={styles.statValue}>{formatDuration(finishTimeSeconds)}</Text>
          <Text style={styles.statLabel}>FINISH TIME</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{formatPace(paceSecondsPerKm)}</Text>
          <Text style={styles.statLabel}>/KM PACE</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerBrand, { color: brandPrimaryColor }]}>ROOTAH</Text>
      </View>
    </View>
  );
}

const CARD_WIDTH = 340;
const CARD_HEIGHT = 425; // 4:5 ratio, matches CARD_WIDTH

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: radii.lg,
    overflow: 'hidden',
    padding: 20,
    justifyContent: 'space-between',
  },
  selfieWrap: {
    ...StyleSheet.absoluteFill,
  },
  selfieImage: {
    width: '100%',
    height: '100%',
  },
  selfiePlaceholder: {
    flex: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
    margin: 20,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfiePlaceholderText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.white,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
  },
  orgLogo: {
    width: 48,
    height: 48,
    marginBottom: 6,
  },
  raceTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  organizerName: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  athleteName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.white,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statTileMid: {
    borderWidth: 1.5,
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.white,
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
  },
  footerBrand: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
});
