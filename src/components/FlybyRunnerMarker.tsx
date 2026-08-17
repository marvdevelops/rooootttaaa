import { MarkerView } from '@rnmapbox/maps';
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { brutalShadow, colors } from '../theme/theme';

export interface FlybyRunnerMarkerHandle {
  updatePosition: (coordinate: [number, number]) => void;
}

/**
 * Position lives in this component's own state, updated imperatively via a
 * ref rather than props from the parent — the flyby animation drives this at
 * ~60fps, and lifting that into FlybyScreen's own state would re-render the
 * whole screen (MapView, ShapeSource, terrain, sky layers) every frame.
 * Confining the state here means only this small marker re-renders.
 */
const FlybyRunnerMarker = forwardRef<FlybyRunnerMarkerHandle>(function FlybyRunnerMarker(_props, ref) {
  const [coordinate, setCoordinate] = useState<[number, number] | null>(null);

  useImperativeHandle(ref, () => ({
    updatePosition: (coord) => setCoordinate(coord),
  }));

  if (!coordinate) return null;

  return (
    <MarkerView coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
      <View style={styles.marker}>
        <Text style={styles.icon}>🏃</Text>
      </View>
    </MarkerView>
  );
});

export default FlybyRunnerMarker;

const styles = StyleSheet.create({
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(2),
    borderWidth: 2.5,
    borderColor: colors.sand,
  },
  icon: {
    fontSize: 16,
  },
});
