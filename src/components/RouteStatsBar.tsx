import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, fonts, radii } from '../theme/theme';

interface Props {
  distanceKm: number;
  elevationGainM: number;
  peakElevationM?: number | null;
  isRouting: boolean;
  isFetchingElevation: boolean;
}

export default function RouteStatsBar({
  distanceKm,
  elevationGainM,
  peakElevationM,
  isRouting,
  isFetchingElevation,
}: Props) {
  const showPeak = peakElevationM !== null && peakElevationM !== undefined;

  return (
    <View style={styles.row}>
      <View style={[styles.pill, styles.distancePill]}>
        <Text style={styles.label}>DISTANCE</Text>
        <Text style={[styles.value, styles.valueInk, showPeak && styles.valueCompact]}>
          {distanceKm.toFixed(2)} km
        </Text>
      </View>
      <View style={[styles.pill, styles.gainPill]}>
        <Text style={[styles.label, styles.labelLight]}>GAIN</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, styles.valueWhite, showPeak && styles.valueCompact]}>
            +{Math.round(elevationGainM)} m
          </Text>
          {isFetchingElevation && <ActivityIndicator size="small" color={colors.surface} style={styles.spinner} />}
        </View>
      </View>
      {showPeak && (
        <View style={[styles.pill, styles.peakPill]}>
          <Text style={[styles.label, styles.labelLight]}>PEAK</Text>
          <Text style={[styles.value, styles.valueWhite, styles.valueCompact]}>{Math.round(peakElevationM)} m</Text>
        </View>
      )}
      {isRouting && (
        <View style={styles.routingBadge}>
          <ActivityIndicator size="small" color={colors.surface} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  pill: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    ...elevation('card'),
  },
  distancePill: {
    backgroundColor: '#EDE8DF',
  },
  gainPill: {
    backgroundColor: colors.teal,
  },
  peakPill: {
    backgroundColor: colors.amber,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.stone,
    textTransform: 'uppercase',
  },
  labelLight: {
    color: 'rgba(255,255,255,0.7)',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    marginTop: 2,
  },
  valueInk: {
    color: colors.ink,
  },
  valueWhite: {
    color: colors.surface,
  },
  valueCompact: {
    fontSize: 17,
  },
  spinner: {
    marginLeft: 6,
  },
  routingBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.coral,
    borderRadius: radii.pill,
    padding: 5,
    ...elevation('subtle'),
  },
});
