import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RunnerIcon } from './icons';
import { colors, fonts } from '../theme/theme';
import { ActivityType, CloudRoute, PathPoint } from '../types/route';
import { buildStaticMapUrl } from '../utils/staticMap';

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail Run',
  hike: 'Hike',
  bike: 'Ride',
  walk: 'Walk',
  other: 'Route',
};

interface Props {
  route: CloudRoute;
  fullPath: PathPoint[];
  /** Fires once the background map image has either loaded or failed to load, so a capture doesn't race an image still in flight. */
  onMapImageSettled?: () => void;
}

/**
 * The flyby's shareable summary card. Video export was dropped from this
 * build (see flybyCapture.ts), so this static card is the whole shareable
 * artifact — it shows the actual route on a static map image (the same
 * Mapbox Static Images helper used elsewhere in the app) rather than just a
 * text card, since there's no video to fall back on. Every field beyond
 * distance and elevation is conditional — a brand-new route with zero
 * reviews/completions must still look deliberate, not like something's
 * missing. See T5-flyby-video.md's "graceful degradation" table.
 */
export default function FlybyStatCard({ route, fullPath, onMapImageSettled }: Props) {
  const avgRating = route.reviewCount >= 3 ? route.ratingSum / route.reviewCount : null;
  const showCompletions = route.completionCount >= 2;
  const showSocialRow = avgRating !== null || showCompletions;

  const mapUrl = useMemo(
    () => buildStaticMapUrl(fullPath, route.waypoints, { width: 720, height: 1280 }),
    [fullPath, route.waypoints],
  );

  // No map image to wait on (missing token / too few points) — settle immediately.
  useEffect(() => {
    if (!mapUrl) onMapImageSettled?.();
  }, [mapUrl, onMapImageSettled]);

  return (
    <View style={styles.card}>
      {mapUrl ? (
        <Image
          source={{ uri: mapUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoadEnd={onMapImageSettled}
        />
      ) : null}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />

      <View style={styles.content}>
        <Text style={styles.brand}>ROOTAH</Text>

        <Text style={styles.routeName} numberOfLines={2}>
          {route.name}
        </Text>
        {!!route.city && <Text style={styles.city}>📍 {route.city}</Text>}

        <View style={styles.statsRow}>
          <Text style={styles.stat}>{route.distanceKm.toFixed(1)}km</Text>
          <View style={styles.divider} />
          <Text style={styles.stat}>↑{Math.round(route.elevationGainM)}m</Text>
          <View style={styles.divider} />
          <Text style={styles.stat}>{ACTIVITY_LABEL[route.activityType]}</Text>
        </View>

        {showSocialRow && (
          <View style={styles.socialRow}>
            {avgRating !== null && <Text style={styles.social}>★ {avgRating.toFixed(1)}</Text>}
            {avgRating !== null && showCompletions && <Text style={styles.socialDot}>·</Text>}
            {showCompletions && (
              <View style={styles.socialRuns}>
                <RunnerIcon size={11} color={colors.amber} />
                <Text style={styles.social}>{route.completionCount} runs</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.cta}>Map it. Run it. Own it.</Text>
        <Text style={styles.url}>rootah.com</Text>
      </View>
    </View>
  );
}

// Design-point size, not pixels — react-native-view-shot captures at the
// device's native pixel ratio automatically (e.g. ~3x on most iPhones), so a
// 360x640 layout already exports at roughly 1080x1920. Making the RN layout
// itself literally 1080x1920 points was part of the earlier blank/broken
// share bug: an off-screen view that large is well past what some devices
// reliably lay out and rasterize in one pass.
const CARD_WIDTH = 360;
const CARD_HEIGHT = 640;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.ink,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  content: {
    padding: 22,
    gap: 5,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.sand,
    letterSpacing: 1.5,
  },
  routeName: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.sand,
    marginTop: 4,
  },
  city: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.sand,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  stat: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.sand,
  },
  divider: {
    width: 2,
    height: 12,
    backgroundColor: colors.mutedLight,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  socialRuns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  social: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.amber,
  },
  socialDot: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.mutedLight,
  },
  cta: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.sand,
    marginTop: 10,
  },
  url: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.mutedLight,
  },
});
