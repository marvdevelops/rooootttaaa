import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { UpcomingClimb } from '../utils/routeProgress';

interface Props {
  remainingMeters: number;
  nextClimb: UpcomingClimb | null;
}

export default function RouteAheadPanel({ remainingMeters, nextClimb }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>REMAINING</Text>
        <Text style={styles.value}>{(remainingMeters / 1000).toFixed(1)} km</Text>
      </View>
      {nextClimb && (
        <View style={styles.row}>
          <Text style={styles.label}>NEXT CLIMB</Text>
          <Text style={styles.value}>
            in {(nextClimb.distanceToClimbMeters / 1000).toFixed(1)}km · +{nextClimb.climbGainMeters}m over {(nextClimb.climbLengthMeters / 1000).toFixed(1)}km
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(26,22,20,0.85)',
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 4,
    ...elevation('subtle'),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.6)',
  },
  value: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.surface,
  },
});
