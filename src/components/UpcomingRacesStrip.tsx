import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';
import { RaceEventSummary } from '../types/route';
import RaceCard from './RaceCard';
import { RaceFlagIcon } from './icons';

interface Props {
  events: RaceEventSummary[];
  /** Opens the primary (soonest) distance category's own detail page — that page's distance-chip row is where the user actually picks their race. */
  onOpenRace: (groupRunId: string) => void;
}

/** Replaces the discover screen's old "Popular routes" strip — races are Rootah's event calendar, worth surfacing over a routes leaderboard. One card per event, not per distance category — a 5K/10K/21K event is one race with options, not three unrelated races. */
export default function UpcomingRacesStrip({ events, onOpenRace }: Props) {
  if (events.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <RaceFlagIcon size={14} color={colors.coral} />
        <Text style={styles.title}>Upcoming races</Text>
      </View>
      <FlatList
        horizontal
        data={events}
        keyExtractor={(e) => e.eventGroupId}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <RaceCard event={item} onPress={() => onOpenRace(item.primaryGroupRunId)} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  list: {
    gap: 10,
  },
});
