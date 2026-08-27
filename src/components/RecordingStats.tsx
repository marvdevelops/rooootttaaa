import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts } from '../theme/theme';
import { ActivityType } from '../types/route';
import { formatDuration } from '../utils/completionsApi';
import { paceOrSpeedStat } from '../utils/activityStats';

interface Props {
  activityType: ActivityType;
  elapsedSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  /** Average pace over moving time (excludes auto-paused stretches) — computed by the caller so this stays a pure display component. Null until there's enough distance/time to mean anything. Used for every activity except bike. */
  paceSecondsPerKm: number | null;
  /** Average speed over moving time — used instead of pace for bike, same split Strava uses. */
  speedKmh: number | null;
}

/** Time / distance / pace-or-speed / elevation panel — the primary readout on the recording screen. Rides show average speed instead of pace, matching every other stat/moving-time screen in the app. */
export default function RecordingStats({ activityType, elapsedSeconds, distanceMeters, elevationGainMeters, paceSecondsPerKm, speedKmh }: Props) {
  const paceOrSpeed = paceOrSpeedStat(activityType, paceSecondsPerKm, speedKmh);

  return (
    <View style={styles.container}>
      <View style={styles.primaryRow}>
        <Text style={styles.elapsedValue}>{formatDuration(elapsedSeconds)}</Text>
        <Text style={styles.elapsedLabel}>ELAPSED</Text>
      </View>

      <View style={styles.secondaryRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(distanceMeters / 1000).toFixed(2)}</Text>
          <Text style={styles.statLabel}>KM</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{paceOrSpeed.value}</Text>
          <Text style={styles.statLabel}>{paceOrSpeed.label}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>+{Math.round(elevationGainMeters)}</Text>
          <Text style={styles.statLabel}>M GAIN</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 20,
    ...elevation('card'),
  },
  primaryRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  elapsedValue: {
    fontFamily: fonts.extraBold,
    fontSize: 44,
    color: colors.ink,
    letterSpacing: -1,
  },
  elapsedLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.mist,
    marginTop: 2,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.ink,
  },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.6,
    color: colors.stone,
    marginTop: 2,
  },
});
