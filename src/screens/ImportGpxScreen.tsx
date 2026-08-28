import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon } from '../components/icons';
import RouteMap from '../components/RouteMap';
import SaveRouteModal from '../components/SaveRouteModal';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { ActivityType, CloudRoute, PathPoint, Waypoint } from '../types/route';
import { pathDistance } from '../utils/distance';
import { annotateElevation } from '../utils/elevation';
import { downsampleForStorage } from '../utils/elevationProfile';
import { reverseGeocodeCity } from '../utils/geocoding';
import { computeGpxGain, GpxParseError, parseGpx } from '../utils/gpxImport';
import { createRoute } from '../utils/routesApi';
import { colorSegmentsByGrade } from '../utils/routeColor';
import { simplifyPath } from '../utils/simplifyPath';

interface Props {
  onClose: () => void;
  onImported: (route: CloudRoute) => void;
}

type Stage = 'picking' | 'parsing' | 'elevation' | 'preview' | 'saving';

// A recorded GPX track can have thousands of points (a two-hour run logged
// every couple of seconds); every other route in the app — built via tap +
// Directions API — tops out at a few hundred. Cap the geometry we actually
// render/store at import time so an imported route behaves like any other
// one everywhere it's fetched afterward, not just here.
const DISPLAY_MAX_POINTS = 600;

// Corner-preserving simplification tolerance — a point only gets dropped if
// it's within this many meters of the straight line its neighbors would
// draw instead. Small enough to keep real turns/intersections, big enough
// to thin out GPS jitter on straight stretches.
const SIMPLIFY_TOLERANCE_METERS = 3;

// A recorded track logged every 1-2 seconds over a multi-hour run/ride can
// have tens of thousands of raw points. Parsing was fine, but every step
// after it — the elevation annotation, distance sum, and grade coloring —
// ran over the *full* raw array, all synchronously on the JS thread with
// nothing to yield to, so a big file made GPX import look hung with no
// spinner progress for a long stretch. Downsampling right after parsing (well
// above DISPLAY_MAX_POINTS, so distance/elevation accuracy barely moves) caps
// that worst case without changing anything for the vast majority of files,
// which are already under this.
const RAW_PARSE_MAX_POINTS = 4000;

export default function ImportGpxScreen({ onClose, onImported }: Props) {
  const [stage, setStage] = useState<Stage>('picking');
  const [points, setPoints] = useState<PathPoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elevationGainM, setElevationGainM] = useState(0);
  const [parsedName, setParsedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFile = useCallback(async () => {
    setStage('picking');
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // GPX files are frequently mis-registered as generic/octet-stream on
        // device — filtering by MIME type alone misses real GPX files, so
        // allow anything and rely on the parser + filename to catch mistakes.
        type: ['application/gpx+xml', 'application/xml', 'text/xml', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) {
        onClose();
        return;
      }

      const asset = result.assets[0];
      if (asset.name && !asset.name.toLowerCase().endsWith('.gpx')) {
        Alert.alert('Not a GPX file', `"${asset.name}" doesn't look like a .gpx file.`, [
          { text: 'Choose another', onPress: pickFile },
          { text: 'Cancel', style: 'cancel', onPress: onClose },
        ]);
        return;
      }

      setStage('parsing');
      // Let the "Reading route…" spinner actually paint before the
      // synchronous regex parse below blocks the JS thread — without this,
      // the state update and the parse happen in the same tick and the
      // screen looks frozen with no feedback until parsing finishes.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const xml = await new File(asset.uri).text();
      const { name, points: rawPoints } = parseGpx(xml);
      const parsedPoints = downsampleForStorage(rawPoints, RAW_PARSE_MAX_POINTS);

      // Only hit the elevation service if the file didn't already carry
      // elevation data — recorded tracks often have real GPS/barometric
      // elevation that's worth keeping over a DEM approximation.
      const hasElevation = parsedPoints.some((p) => p.elevation !== undefined);
      if (!hasElevation) setStage('elevation');
      const fullResPoints = hasElevation ? parsedPoints : (await annotateElevation(parsedPoints)).path;

      // Distance/gain computed from the full-resolution track before
      // downsampling — cutting corners on a curvy path would otherwise
      // quietly under-measure it.
      setDistanceKm(pathDistance(fullResPoints) / 1000);
      setElevationGainM(computeGpxGain(fullResPoints));
      // Shape-preserving simplification instead of fixed-interval decimation
      // — corners survive even when they fall between two points that a
      // naive "keep every Nth point" pass would have dropped. Still capped
      // at DISPLAY_MAX_POINTS as a hard ceiling for pathologically complex
      // tracks (e.g. a long trail with constant switchbacks).
      const simplified = simplifyPath(fullResPoints, SIMPLIFY_TOLERANCE_METERS);
      setPoints(simplified.length > DISPLAY_MAX_POINTS ? downsampleForStorage(simplified, DISPLAY_MAX_POINTS) : simplified);
      setParsedName(name);
      setStage('preview');
    } catch (e) {
      const message = e instanceof GpxParseError ? e.message : 'Failed to read that GPX file.';
      Alert.alert('Import failed', message, [{ text: 'OK', onPress: onClose }]);
    }
  }, [onClose]);

  useEffect(() => {
    pickFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colorSegments = useMemo(() => colorSegmentsByGrade(points), [points]);
  const center = points[0] ?? { latitude: 0, longitude: 0 };

  const handleSave = useCallback(
    async (name: string, description: string, activityType: ActivityType) => {
      setStage('saving');
      setError(null);
      try {
        const city = points[0] ? await reverseGeocodeCity(points[0]) : null;
        const waypoints: Waypoint[] = [
          { id: 'gpx-start', latitude: points[0].latitude, longitude: points[0].longitude },
          { id: 'gpx-end', latitude: points[points.length - 1].latitude, longitude: points[points.length - 1].longitude },
        ];
        const created = await createRoute({
          name,
          description,
          activityType,
          waypoints,
          segments: [
            {
              fromId: 'gpx-start',
              toId: 'gpx-end',
              path: points,
              distanceMeters: distanceKm * 1000,
            },
          ],
          notes: [],
          distanceKm,
          elevationGainM,
          elevationProfile: downsampleForStorage(points),
          city,
        });
        onImported(created);
      } catch (e) {
        setStage('preview');
        setError(e instanceof Error ? e.message : 'Failed to save the imported route.');
      }
    },
    [points, distanceKm, elevationGainM, onImported],
  );

  if (stage === 'picking' || stage === 'parsing' || stage === 'elevation') {
    const label =
      stage === 'picking' ? 'Choose a GPX file…' : stage === 'elevation' ? 'Fetching elevation…' : 'Reading route…';
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.coral} size="large" />
        <Text style={styles.loadingText}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RouteMap
        initialCenter={center}
        waypoints={[]}
        colorSegments={colorSegments}
        kmMarkers={[]}
        mapStyleMode="standard"
        is3D={false}
        waypointsDraggable={false}
        showWaypointMarkers={false}
      />

      <Pressable style={styles.backButton} onPress={onClose}>
        <BackIcon />
      </Pressable>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <SaveRouteModal
        visible
        distanceKm={distanceKm}
        elevationGainM={elevationGainM}
        elevationPath={points}
        isSaving={stage === 'saving'}
        initialName={parsedName ?? ''}
        onClose={onClose}
        onSave={handleSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
  },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  errorBanner: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: colors.ink,
    borderRadius: radii.sm,
    padding: 12,
  },
  errorText: {
    color: colors.cream,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
});
