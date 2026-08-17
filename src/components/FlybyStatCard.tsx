import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';
import { ActivityType, CloudRoute } from '../types/route';

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
}

/**
 * The flyby video's final 1.5s freeze frame. Every field beyond distance and
 * elevation is conditional — a brand-new route with zero reviews/completions
 * must still look deliberate, not like something's missing. See
 * T5-flyby-video.md's "graceful degradation" table.
 */
export default function FlybyStatCard({ route }: Props) {
  const avgRating = route.reviewCount >= 3 ? route.ratingSum / route.reviewCount : null;
  const showCompletions = route.completionCount >= 2;
  const showSocialRow = avgRating !== null || showCompletions;

  return (
    <View style={styles.card}>
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
            {showCompletions && <Text style={styles.social}>🏃 {route.completionCount} runs</Text>}
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
// itself literally 1080x1920 points was the actual bug behind the blank/
// broken share: an off-screen view that large is well past what some
// devices reliably lay out and rasterize in one pass.
const CARD_WIDTH = 360;
const CARD_HEIGHT = 640;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.ink,
    justifyContent: 'flex-end',
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
