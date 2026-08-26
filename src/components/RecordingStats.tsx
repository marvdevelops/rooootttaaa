import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts } from '../theme/theme';
import { formatDuration } from '../utils/completionsApi';

interface Props {
  elapsedSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
}

function formatPace(elapsedSeconds: number, distanceMeters: number): string {
  if (distanceMeters < 50) return '--:--';
  const km = distanceMeters / 1000;
  const secondsPerKm = elapsedSeconds / km;
  if (!isFinite(secondsPerKm)) return '--:--';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Time / distance / pace / elevation panel — the primary readout on the recording screen. */
export default function RecordingStats({ elapsedSeconds, distanceMeters, elevationGainMeters }: Props) {
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
          <Text style={styles.statValue}>{formatPace(elapsedSeconds, distanceMeters)}</Text>
          <Text style={styles.statLabel}>/KM PACE</Text>
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
