import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';

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
      <View style={[styles.pill, styles.creamPill]}>
        <Text style={styles.label}>DISTANCE</Text>
        <Text style={[styles.value, showPeak && styles.valueCompact]}>{distanceKm.toFixed(2)} km</Text>
      </View>
      <View style={[styles.pill, styles.aquaPill]}>
        <Text style={[styles.label, styles.aquaLabel]}>GAIN</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, showPeak && styles.valueCompact]}>+{Math.round(elevationGainM)} m</Text>
          {isFetchingElevation && <ActivityIndicator size="small" color={colors.ink} style={styles.spinner} />}
        </View>
      </View>
      {showPeak && (
        <View style={[styles.pill, styles.amberPill]}>
          <Text style={styles.label}>PEAK</Text>
          <Text style={[styles.value, styles.valueCompact]}>{Math.round(peakElevationM)} m</Text>
        </View>
      )}
      {isRouting && (
        <View style={styles.routingBadge}>
          <ActivityIndicator size="small" color={colors.cream} />
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
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...brutalShadow(5),
  },
  creamPill: {
    backgroundColor: colors.sand,
  },
  aquaPill: {
    backgroundColor: colors.aqua,
  },
  amberPill: {
    backgroundColor: colors.amber,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
  },
  aquaLabel: {
    color: '#16302f',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
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
    backgroundColor: colors.rust,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 5,
  },
});
