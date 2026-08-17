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

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: colors.ink,
    justifyContent: 'flex-end',
  },
  content: {
    padding: 64,
    gap: 12,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.sand,
    letterSpacing: 2,
  },
  routeName: {
    fontFamily: fonts.display,
    fontSize: 56,
    color: colors.sand,
    marginTop: 8,
  },
  city: {
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    color: colors.sand,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  stat: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.sand,
  },
  divider: {
    width: 3,
    height: 28,
    backgroundColor: colors.mutedLight,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  social: {
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    color: colors.amber,
  },
  socialDot: {
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    color: colors.mutedLight,
  },
  cta: {
    fontFamily: fonts.bodyBold,
    fontSize: 24,
    color: colors.sand,
    marginTop: 24,
  },
  url: {
    fontFamily: fonts.bodyMedium,
    fontSize: 22,
    color: colors.mutedLight,
  },
});
