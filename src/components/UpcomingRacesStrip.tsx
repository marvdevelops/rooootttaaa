import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/theme';
import { GroupRun } from '../types/route';
import RaceCard from './RaceCard';

interface Props {
  races: GroupRun[];
  onOpenRace: (groupRunId: string) => void;
}

/** Replaces the discover screen's old "Popular routes" strip — races are Rootah's event calendar, worth surfacing over a routes leaderboard. */
export default function UpcomingRacesStrip({ races, onOpenRace }: Props) {
  if (races.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>🏁 Upcoming races</Text>
      </View>
      <FlatList
        horizontal
        data={races}
        keyExtractor={(r) => r.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <RaceCard race={item} onPress={() => onOpenRace(item.id)} />}
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
    justifyContent: 'space-between',
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
