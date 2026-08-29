import { Camera, LineLayer, MapView, ShapeSource, StyleURL, UserLocation, UserTrackingMode } from '@rnmapbox/maps';
import type { Feature, LineString } from 'geojson';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LatLng } from '../types/route';
import '../utils/mapboxInit';

interface Props {
  /** The recorded track so far — non-paused points, drawn live. */
  livePath: LatLng[];
  /** The planned route, when recording in route-aware mode. */
  plannedPath?: LatLng[];
  /** True during an active recording — locks the map to the user's position (see scrollEnabled below). False for the post-run summary review, where panning around the finished track is the point. */
  isLive?: boolean;
}

function toLineFeature(path: LatLng[]): Feature<LineString> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: path.map((p) => [p.longitude, p.latitude]) },
  };
}

function boundsFor(path: LatLng[]): { ne: [number, number]; sw: [number, number] } | null {
  if (path.length === 0) return null;
  let minLat = path[0].latitude;
  let maxLat = path[0].latitude;
  let minLng = path[0].longitude;
  let maxLng = path[0].longitude;
  for (const p of path) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}

/** Full-bleed tracking map. Live (isLive, default): camera follows the user's current GPS position as it moves. Review (isLive=false, the post-run summary): followUserLocation would show wherever the phone happens to be NOW, not the finished route — so this fits the camera to the recorded track's bounds instead, once. */
export default function RecordingMap({ livePath, plannedPath, isLive = true }: Props) {
  // Bounds only need recomputing when the path identity changes (a finished
  // review path is static; a live path grows every point, but we only use
  // this value at all when !isLive).
  const reviewBounds = useMemo(() => (isLive ? null : boundsFor(livePath)), [isLive, livePath]);

  return (
    <View style={styles.map}>
      <MapView
        style={styles.map}
        styleURL={StyleURL.Light}
        scaleBarEnabled={false}
        compassEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
        // A manual pan/rotate permanently cancels @rnmapbox/maps' Camera
        // followUserLocation — there's no "resume following" event to hook,
        // so the only reliable fix during an active recording is to not let
        // the gesture happen at all. Pinch-zoom still works; the center
        // point just can't be dragged away from the live position, same
        // lock Strava/Nike Run Club use. Not applied to the post-run
        // summary review, where panning around the finished track is the point.
        scrollEnabled={!isLive}
        rotateEnabled={!isLive}
        pitchEnabled={!isLive}
      >
        {isLive ? (
          // "course" keeps the map rotated so the direction you're heading is
          // always up — like Strava / Google Maps navigation.
          <Camera
            followUserLocation
            followUserMode={UserTrackingMode.FollowWithCourse}
            followZoomLevel={17}
            followPitch={0}
            animationDuration={500}
          />
        ) : (
          reviewBounds && (
            <Camera
              bounds={{ ne: reviewBounds.ne, sw: reviewBounds.sw, paddingTop: 60, paddingBottom: 60, paddingLeft: 40, paddingRight: 40 }}
              animationDuration={0}
            />
          )
        )}

        {isLive && <UserLocation visible showsUserHeadingIndicator />}

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
