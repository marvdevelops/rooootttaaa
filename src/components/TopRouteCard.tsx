import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { ActivityType, CloudRoute } from '../types/route';

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: 'RUN',
  trail_run: 'TRAIL RUN',
  hike: 'HIKE',
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

/** Compact — name, distance, and activity type only, no map thumbnail. */
export default function TopRouteCard({ route, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.name} numberOfLines={1}>
        {route.name}
      </Text>
      <View style={styles.statsRow}>
        <Text style={styles.stat} numberOfLines={1}>
          {route.distanceKm.toFixed(1)} km
        </Text>
        <View style={styles.activityPill}>
          <Text style={styles.activityPillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {ACTIVITY_LABEL[route.activityType]}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 6,
    ...elevation('card'),
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stat: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.stone,
    flexShrink: 0,
  },
  activityPill: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    maxWidth: 90,
  },
  activityPillText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.ink,
  },
});
