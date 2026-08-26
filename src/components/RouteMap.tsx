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
import { colors, elevation, fonts, radii } from '../theme/theme';
import { LatLng, RouteNote, Waypoint } from '../types/route';
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
  /** Notes are their own entity, independent of waypoints — pass whatever should render as tappable flags. */
  notes?: RouteNote[];
  /** Coordinates where the route's direction of travel sharply reverses (see utils/uturns.ts) — marked so a runner can see the turnaround before they hit it. */
  uTurnPoints?: LatLng[];
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
    notes = [],
    uTurnPoints = [],
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

        {uTurnPoints.map((point, i) => (
          <PointAnnotation
            key={`uturn-${i}`}
            id={`uturn-${i}`}
            coordinate={[point.longitude, point.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.uTurnMarker}>
              <Text style={styles.uTurnMarkerText}>U</Text>
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

        {notes.map((note) => (
          // MarkerView, not PointAnnotation — PointAnnotation's touch handling
          // for interactive content has been unreliable (see waypoint-delete
          // history); MarkerView is a real RN view and doesn't have that issue.
          <MarkerView key={`note-${note.id}`} coordinate={[note.longitude, note.latitude]} anchor={{ x: 0.5, y: 1 }}>
            <Pressable
              hitSlop={10}
              onPress={() => setActiveNoteId((prev) => (prev === note.id ? null : note.id))}
              style={styles.noteMarkerWrap}
            >
              {activeNoteId === note.id && !!note.text.trim() && (
                <View style={styles.noteCallout}>
                  <Text style={styles.noteCalloutText}>{note.text}</Text>
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
    backgroundColor: colors.surface,
    borderRadius: radii.icon,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  kmBadgeTail: {
    width: 2,
    height: 5,
    backgroundColor: colors.ink,
    marginTop: -1,
  },
  uTurnMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  uTurnMarkerText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: colors.white,
  },
  kmBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.ink,
  },
  noteMarkerWrap: {
    alignItems: 'center',
  },
  noteFlag: {
    width: 26,
    height: 26,
    borderRadius: radii.icon,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  noteCallout: {
    maxWidth: 180,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 8,
    marginBottom: 6,
    ...elevation('card'),
  },
  noteCalloutText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.ink,
  },
});
