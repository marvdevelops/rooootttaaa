import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { RaceEventSummary } from '../types/route';

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
  event: RaceEventSummary;
  onPress: () => void;
}

/** Compact card for the discover screen's upcoming-races strip — one card per event (not per distance category), with every distance shown as its own chip so "one race, several distances" reads as one thing instead of N unrelated cards. */
export default function RaceCard({ event, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateBadgeText}>{daysAway(event.scheduledAt)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {event.eventTitle}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {formatWhen(event.scheduledAt)}
      </Text>
      <View style={styles.distanceRow}>
        {event.categories.map((cat) => (
          <View key={cat.groupRunId} style={styles.distanceChip}>
            <Text style={styles.distanceChipText}>{cat.routeDistanceKm.toFixed(0)}K</Text>
          </View>
        ))}
      </View>
      <Text style={styles.going} numberOfLines={1}>
        {event.rsvpCount} joined
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
  distanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  distanceChip: {
    backgroundColor: colors.cream,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  distanceChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.ink,
  },
  going: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.mist,
  },
});
