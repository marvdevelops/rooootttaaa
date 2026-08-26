import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { GroupRun } from '../types/route';

function daysAway(scheduledAt: number): string {
  const diffDays = Math.round((scheduledAt - Date.now()) / 86_400_000);
  if (diffDays <= 0) return 'TODAY';
  if (diffDays === 1) return 'TOMORROW';
  return `IN ${diffDays} DAYS`;
}

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  race: GroupRun;
  onPress: () => void;
}

/** Compact card for the discover screen's upcoming-races strip — date badge, title, route distance, and a going count, mirroring TopRouteCard's shape. */
export default function RaceCard({ race, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateBadgeText}>{daysAway(race.scheduledAt)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {race.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {formatWhen(race.scheduledAt)} · {race.routeDistanceKm.toFixed(1)} km
      </Text>
      <Text style={styles.going} numberOfLines={1}>
        {race.rsvpCount} joined
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 170,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 6,
    ...elevation('card'),
  },
  dateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.coral,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dateBadgeText: {
    fontFamily: fonts.extraBold,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.white,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  meta: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.stone,
  },
  going: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.mist,
  },
});
