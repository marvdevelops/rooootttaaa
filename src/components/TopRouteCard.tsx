import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';
import { ActivityType, CloudRoute, PathPoint } from '../types/route';
import { buildStaticMapUrl } from '../utils/staticMap';

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: 'RUN',
  bike: 'BIKE',
  walk: 'WALK',
  other: 'OTHER',
};

interface Props {
  route: CloudRoute;
  rank?: number;
  isTop?: boolean;
  onPress: () => void;
}

export default function TopRouteCard({ route, rank, isTop, onPress }: Props) {
  const fullPath = useMemo<PathPoint[]>(() => {
    if (route.waypoints.length === 0) return [];
    const points: PathPoint[] = [route.waypoints[0]];
    for (const segment of route.segments) points.push(...segment.path.slice(1));
    return points;
  }, [route.waypoints, route.segments]);

  const mapUrl = useMemo(() => buildStaticMapUrl(fullPath, route.waypoints, { width: 300, height: 180 }), [fullPath, route.waypoints]);

  const showRating = route.reviewCount >= 3;
  const showCompletions = route.completionCount >= 2;
  const avgRating = showRating ? route.ratingSum / route.reviewCount : null;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.thumbWrap}>
        {mapUrl ? (
          <Image source={{ uri: mapUrl }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        {rank !== undefined && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
        )}
        {isTop && (
          <View style={styles.topBadge}>
            <Text style={styles.topBadgeText}>🏆</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {route.name}
        </Text>

        <View style={styles.statsRow}>
          <Text style={styles.stat}>{route.distanceKm.toFixed(1)} km</Text>
          {route.elevationGainM > 0 && <Text style={styles.stat}>↑{Math.round(route.elevationGainM)}m</Text>}
          <View style={styles.activityPill}>
            <Text style={styles.activityPillText}>{ACTIVITY_LABEL[route.activityType]}</Text>
          </View>
        </View>

        {(showRating || showCompletions) && (
          <View style={styles.socialRow}>
            {showRating && avgRating !== null && <Text style={styles.social}>★{avgRating.toFixed(1)}</Text>}
            {showCompletions && <Text style={styles.social}>🏃 {route.completionCount}</Text>}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 2.5,
    borderColor: colors.ink,
    overflow: 'hidden',
  },
  thumbWrap: {
    width: '100%',
    height: 90,
    backgroundColor: colors.sand,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    backgroundColor: colors.sand,
  },
  rankBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.cream,
  },
  topBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: colors.amber,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBadgeText: {
    fontSize: 11,
  },
  body: {
    padding: 8,
    gap: 4,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stat: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.muted,
  },
  activityPill: {
    backgroundColor: colors.sand,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  activityPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.ink,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 8,
  },
  social: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.rust,
  },
});
