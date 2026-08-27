import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Logo from './Logo';
import { colors, fonts, radii } from '../theme/theme';
import { ActivityType } from '../types/route';
import { formatDuration } from '../utils/completionsApi';
import { paceOrSpeedStat } from '../utils/activityStats';

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: 'RUN',
  trail_run: 'TRAIL RUN',
  hike: 'HIKE',
  bike: 'RIDE',
  walk: 'WALK',
  other: 'ACTIVITY',
};

interface Props {
  activityType: ActivityType;
  distanceMeters: number;
  movingTimeSeconds: number;
  paceSecondsPerKm: number | null;
  speedKmh: number | null;
  athleteAvatarUrl: string | null;
  /** Local file URI of the selfie, once captured. Shown as a placeholder cutout until then. */
  selfieUri: string | null;
}

/**
 * Same 9:16 selfie-plus-stats layout as ShareCardCanvas (the race finish
 * card), but with every race/organizer element stripped out — no finisher
 * pill, no organizer branding, just the photo, the activity type, and the
 * numbers, with Rootah's own mark in the corner. For a normal (non-race)
 * recorded activity.
 */
export default function ActivityShareCardCanvas({
  activityType,
  distanceMeters,
  movingTimeSeconds,
  paceSecondsPerKm,
  speedKmh,
  athleteAvatarUrl,
  selfieUri,
}: Props) {
  const paceOrSpeed = paceOrSpeedStat(activityType, paceSecondsPerKm, speedKmh);
  return (
    <View style={styles.card}>
      <View style={styles.photoWrap}>
        {selfieUri ? (
          <Image source={{ uri: selfieUri }} style={styles.photoImage} />
        ) : athleteAvatarUrl ? (
          <Image source={{ uri: athleteAvatarUrl }} style={styles.photoImage} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>TAP TO ADD SELFIE</Text>
          </View>
        )}
      </View>

      <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={styles.topScrim} pointerEvents="none" />
      <View style={styles.topRow}>
        <View style={styles.activityPill}>
          <Text style={styles.activityPillText}>{ACTIVITY_LABEL[activityType] ?? 'ACTIVITY'}</Text>
        </View>
      </View>

      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']} style={styles.bottomScrim} pointerEvents="none" />
      <View style={styles.bottomBlock}>
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{(distanceMeters / 1000).toFixed(2)}</Text>
            <Text style={styles.statLabel}>KM</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{formatDuration(movingTimeSeconds)}</Text>
            <Text style={styles.statLabel}>TIME</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{paceOrSpeed.value}</Text>
            <Text style={styles.statLabel}>{paceOrSpeed.label}</Text>
          </View>
        </View>

        <View style={styles.footerBrandRow}>
          <Logo bare showWordmark={false} size={16} />
          <Text style={styles.footerBrand}>ROOTAH</Text>
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
    backgroundColor: colors.ink,
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
    borderColor: colors.coral,
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
  },
  activityPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.coral,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
  },
  activityPillText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.white,
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
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
    color: colors.coral,
  },
});
