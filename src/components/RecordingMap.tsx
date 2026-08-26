import { Camera, LineLayer, MapView, ShapeSource, StyleURL, UserLocation } from '@rnmapbox/maps';
import type { Feature, LineString } from 'geojson';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LatLng } from '../types/route';
import '../utils/mapboxInit';

interface Props {
  /** The recorded track so far — non-paused points, drawn live. */
  livePath: LatLng[];
  /** The planned route, when recording in route-aware mode. */
  plannedPath?: LatLng[];
}

function toLineFeature(path: LatLng[]): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: path.map((p) => [p.longitude, p.latitude]) },
  };
}

/** Full-bleed live tracking map — follows the user, draws the recorded track (and the planned route, if any) as it grows. */
export default function RecordingMap({ livePath, plannedPath }: Props) {
  return (
    <View style={styles.map}>
      <MapView style={styles.map} styleURL={StyleURL.Light} scaleBarEnabled={false} compassEnabled={false} attributionEnabled={false} logoEnabled={false}>
        <Camera followUserLocation followZoomLevel={17} followPitch={0} animationDuration={500} />

        <UserLocation visible showsUserHeadingIndicator />

        {plannedPath && plannedPath.length > 1 && (
          <ShapeSource id="planned-route" shape={toLineFeature(plannedPath)}>
            <LineLayer id="planned-route-line" style={{ lineColor: '#8C8078', lineWidth: 4, lineDasharray: [2, 2], lineCap: 'round', lineJoin: 'round' }} />
          </ShapeSource>
        )}

        {livePath.length > 1 && (
          <ShapeSource id="live-track" shape={toLineFeature(livePath)}>
            <LineLayer id="live-track-line" style={{ lineColor: '#E84B2A', lineWidth: 5, lineCap: 'round', lineJoin: 'round' }} />
          </ShapeSource>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: '100%',
  },
});
