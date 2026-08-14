import Mapbox, {
  Camera,
  LineLayer,
  MapView,
  MarkerView,
  PointAnnotation,
  RasterDemSource,
  ShapeSource,
  StyleURL,
  Terrain,
  UserLocation,
} from '@rnmapbox/maps';
import type { Feature, LineString, Point } from 'geojson';
import React, { forwardRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { LatLng, Waypoint } from '../types/route';
import { KilometerMarker } from '../utils/distance';
import '../utils/mapboxInit';
import { ColoredSegment } from '../utils/routeColor';
import { NoteFlagIcon } from './icons';
import WaypointMarker from './WaypointMarker';

export type MapStyleMode = 'standard' | 'satellite';

const DEM_SOURCE_ID = 'rootah-terrain-dem';
const TILT_PITCH = 60;

interface Props {
  initialCenter: LatLng;
  waypoints: Waypoint[];
  colorSegments: ColoredSegment[];
  kmMarkers: KilometerMarker[];
  mapStyleMode: MapStyleMode;
  is3D: boolean;
  waypointsDraggable?: boolean;
  showWaypointMarkers?: boolean;
  /** Shows a tappable flag + callout for any waypoint with a note. View-mode only — not used while building/editing. */
  showNoteMarkers?: boolean;
  onMapPress?: (coord: LatLng) => void;
  onMarkerDragEnd?: (id: string, coord: LatLng) => void;
  onMarkerPress?: (id: string) => void;
}

const DEFAULT_ZOOM = 15;

const RouteMap = forwardRef<React.ElementRef<typeof Camera>, Props>(function RouteMap(
  {
    initialCenter,
    waypoints,
    colorSegments,
    kmMarkers,
    mapStyleMode,
    is3D,
    waypointsDraggable = true,
    showWaypointMarkers = true,
    showNoteMarkers = false,
    onMapPress,
    onMarkerDragEnd,
    onMarkerPress,
  },
  ref,
) {
  // Marker drag-release on some platforms also fires the underlying MapView's
  // onPress with the drop coordinate, which would add a stray extra waypoint
  // on top of the repositioned one. Suppress presses that land right after a drag.
  const isDraggingRef = useRef(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const notedWaypoints = showNoteMarkers ? waypoints.filter((wp) => !!wp.note?.trim()) : [];

  return (
    <View style={styles.map}>
      <MapView
        style={styles.map}
        styleURL={mapStyleMode === 'satellite' ? StyleURL.SatelliteStreet : StyleURL.Light}
        scaleBarEnabled={false}
        compassEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
        pitchEnabled
        onPress={(feature: Feature<Point>) => {
          if (isDraggingRef.current || !onMapPress) return;
          const [longitude, latitude] = feature.geometry.coordinates;
          onMapPress({ latitude, longitude });
        }}
      >
        <Camera
          ref={ref}
          defaultSettings={{
            centerCoordinate: [initialCenter.longitude, initialCenter.latitude],
            zoomLevel: DEFAULT_ZOOM,
          }}
          pitch={is3D ? TILT_PITCH : 0}
          animationDuration={500}
        />

        {is3D && (
          <>
            <RasterDemSource id={DEM_SOURCE_ID} url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} />
            <Terrain sourceID={DEM_SOURCE_ID} style={{ exaggeration: 1.5 }} />
          </>
        )}

        <UserLocation visible />

        {colorSegments.map((segment, i) => {
          const shape: Feature<LineString> = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: segment.coordinates.map((p) => [p.longitude, p.latitude]),
            },
          };
          return (
            <ShapeSource key={`segment-${i}`} id={`route-segment-${i}`} shape={shape}>
              <LineLayer
                id={`route-segment-line-${i}`}
                // Each grade-colored run is its own LineLayer sharing exact
                // boundary coordinates with its neighbors — a round cap would
                // draw a small circular bump at every color transition, so
                // use a flat cap; the shared endpoints already join cleanly.
                style={{ lineWidth: 4, lineColor: segment.color, lineCap: 'butt', lineJoin: 'round' }}
              />
            </ShapeSource>
          );
        })}

        {kmMarkers.map((marker) => (
          <PointAnnotation
            key={`km-${marker.km}`}
            id={`km-${marker.km}`}
            coordinate={[marker.coordinate.longitude, marker.coordinate.latitude]}
            // Anchor the badge's bottom edge to the point so it floats above
            // the line instead of straddling the stroke.
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.kmMarkerWrap}>
              <View style={styles.kmBadge}>
                <Text style={styles.kmBadgeText}>{marker.km}</Text>
              </View>
              <View style={styles.kmBadgeTail} />
            </View>
          </PointAnnotation>
        ))}

        {showWaypointMarkers && waypoints.map((wp) => (
          <PointAnnotation
            key={wp.id}
            id={wp.id}
            coordinate={[wp.longitude, wp.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
            draggable={waypointsDraggable}
            onSelected={() => onMarkerPress?.(wp.id)}
            onDragStart={() => {
              isDraggingRef.current = true;
            }}
            onDragEnd={(feature) => {
              const [longitude, latitude] = feature.geometry.coordinates;
              onMarkerDragEnd?.(wp.id, { latitude, longitude });
              setTimeout(() => {
                isDraggingRef.current = false;
              }, 300);
            }}
          >
            <WaypointMarker />
          </PointAnnotation>
        ))}

        {notedWaypoints.map((wp) => (
          // MarkerView, not PointAnnotation — PointAnnotation's touch handling
          // for interactive content has been unreliable (see waypoint-delete
          // history); MarkerView is a real RN view and doesn't have that issue.
          <MarkerView key={`note-${wp.id}`} coordinate={[wp.longitude, wp.latitude]} anchor={{ x: 0.5, y: 1 }}>
            <Pressable
              hitSlop={10}
              onPress={() => setActiveNoteId((prev) => (prev === wp.id ? null : wp.id))}
              style={styles.noteMarkerWrap}
            >
              {activeNoteId === wp.id && (
                <View style={styles.noteCallout}>
                  <Text style={styles.noteCalloutText}>{wp.note}</Text>
                </View>
              )}
              <View style={styles.noteFlag}>
                <NoteFlagIcon size={13} color={colors.ink} />
              </View>
            </Pressable>
          </MarkerView>
        ))}
      </MapView>

      {mapStyleMode === 'standard' && <View pointerEvents="none" style={styles.tint} />}
    </View>
  );
});

export default RouteMap;

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.cream,
    opacity: 0.14,
  },
  kmMarkerWrap: {
    alignItems: 'center',
  },
  kmBadge: {
    backgroundColor: colors.sand,
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
  },
  kmBadgeTail: {
    width: 2,
    height: 5,
    backgroundColor: colors.ink,
    marginTop: -1,
  },
  kmBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.ink,
  },
  noteMarkerWrap: {
    alignItems: 'center',
  },
  noteFlag: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: colors.amber,
    borderWidth: 2.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCallout: {
    maxWidth: 180,
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
    ...brutalShadow(2),
  },
  noteCalloutText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.ink,
  },
});
