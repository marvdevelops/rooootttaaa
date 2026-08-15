import { Camera } from '@rnmapbox/maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import BuilderTutorial, { TutorialStep } from '../components/BuilderTutorial';
import ExportSheet from '../components/ExportSheet';
import { CloseIcon, ExportIcon, LoopIcon, SaveIcon, UndoIcon } from '../components/icons';
import Logo from '../components/Logo';
import RouteMap, { MapStyleMode } from '../components/RouteMap';
import RouteStatsBar from '../components/RouteStatsBar';
import SaveRouteModal from '../components/SaveRouteModal';
import WaypointListModal from '../components/WaypointListModal';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { ROUTE_LIMITS } from '../constants/routeLimits';
import { useUserTier } from '../hooks/useUserTier';
import { ActivityType, CloudRoute, LatLng, PathPoint, RouteSegment, Waypoint } from '../types/route';
import { haversineDistance, kilometerMarkers, metersToKm, totalRouteDistance } from '../utils/distance';
import { annotateElevation } from '../utils/elevation';
import { buildGpx } from '../utils/gpx';
import { RoutedSegment, routeBetween, straightLineFallback } from '../utils/routing';
import { colorSegmentsByGrade } from '../utils/routeColor';
import { downsampleForStorage } from '../utils/elevationProfile';
import { reverseGeocodeCity } from '../utils/geocoding';
import { countMyRoutes, createRoute, updateRoute } from '../utils/routesApi';

const ELEVATION_DEBOUNCE_MS = 1200;
const CAMERA_ZOOM = 15;
const TUTORIAL_STORAGE_KEY = 'rootah_seen_builder_tutorial_v1';
const LAST_ACTIVITY_TYPE_KEY = 'rootah_last_activity_type';

// Rootah launches first in the Philippines — used before GPS location
// resolves (or if permission is denied), same fallback as DiscoverMapScreen.
const DEFAULT_CENTER: LatLng = {
  latitude: 12.8797,
  longitude: 121.774,
};

let nextId = 1;
function makeId() {
  return `wp-${nextId++}`;
}

interface Props {
  routeToLoad?: CloudRoute | null;
  onRouteConsumed?: () => void;
  onClose: () => void;
  onRouteCreated?: (route: CloudRoute) => void;
  onRouteUpdated?: (route: CloudRoute) => void;
  /** Free tier hit the saved-route cap trying to create a new route — MapScreen has no paywall UI of its own. */
  onRequirePaywall?: () => void;
}

export default function MapScreen({
  routeToLoad,
  onRouteConsumed,
  onClose,
  onRouteCreated,
  onRouteUpdated,
  onRequirePaywall,
}: Props) {
  const tier = useUserTier();
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [isFetchingElevation, setIsFetchingElevation] = useState(false);
  const [elevationGainM, setElevationGainM] = useState(0);
  const [pathWithElevation, setPathWithElevation] = useState<PathPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [checkingRouteLimit, setCheckingRouteLimit] = useState(false);
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>('standard');
  const [is3D, setIs3D] = useState(false);
  const [showPointsModal, setShowPointsModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CloudRoute | null>(null);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep | null>(null);
  // Snapshot-based undo: each entry is the full {waypoints, segments} state
  // right before a mutation, so undo is a direct restore — no need to
  // re-fetch routing or reverse individual operations (add/drag/delete all
  // push the same way). Capped at 20 states.
  const [history, setHistory] = useState<{ waypoints: Waypoint[]; segments: RouteSegment[] }[]>([]);
  // Reverse-geocoded ahead of time (debounced off the start point) so it's
  // usually already resolved by the time the save modal opens, for the
  // auto-generated route name.
  const [saveCity, setSaveCity] = useState<string | null>(null);
  const [lastActivityType, setLastActivityType] = useState<ActivityType | null>(null);
  const cityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LAST_ACTIVITY_TYPE_KEY).then((v) => {
      if (v === 'run' || v === 'bike' || v === 'walk' || v === 'other') setLastActivityType(v);
    });
  }, []);

  useEffect(() => {
    const start = waypoints[0];
    if (!start) {
      setSaveCity(null);
      return;
    }
    if (cityTimer.current) clearTimeout(cityTimer.current);
    cityTimer.current = setTimeout(() => {
      reverseGeocodeCity(start).then(setSaveCity).catch(() => {});
    }, ELEVATION_DEBOUNCE_MS);
    return () => {
      if (cityTimer.current) clearTimeout(cityTimer.current);
    };
    // Only the origin point matters for city detection, not every drag of later waypoints.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints[0]?.latitude, waypoints[0]?.longitude]);

  const elevationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elevationRequestId = useRef(0);
  const cameraRef = useRef<React.ElementRef<typeof Camera>>(null);
  // Kept in sync every render so pushHistory() always snapshots the latest
  // committed state, regardless of which callback's closure calls it.
  const currentStateRef = useRef({ waypoints, segments });
  currentStateRef.current = { waypoints, segments };

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-19), currentStateRef.current]);
  }, []);

  const locateUser = useCallback(async (animate = true, silent = false) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      // Building a route never requires location — denial here (including
      // the initial silent mount-time prompt) just means the map stays on
      // its default center, no error shown. The explicit "locate me" button
      // still surfaces a message so the user knows why nothing happened.
      if (!silent) setError('Location permission denied — enable it in Settings to center the map on you.');
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const nextCenter: LatLng = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCenter(nextCenter);
      // An animated fly-to competes with the native map's gesture recognizer
      // for the first second or two after load — if the very first tap lands
      // mid-animation it can feel delayed. Snap instantly on initial mount;
      // only animate for the explicit "locate me" button afterwards.
      cameraRef.current?.setCamera({
        centerCoordinate: [nextCenter.longitude, nextCenter.latitude],
        zoomLevel: CAMERA_ZOOM,
        animationDuration: animate ? 500 : 0,
      });
    } catch {
      if (!silent) setError('Could not determine your current location.');
    }
  }, []);

  useEffect(() => {
    // Still prompts for location on open (for the "center on me" convenience)
    // but never blocks or nags — denial is silent and route building works
    // identically either way. Skipped when opening an existing route — the
    // location lookup is async and would otherwise race the route-loading
    // effect below, recentering the map on the user after it already framed
    // the route.
    if (routeToLoad) return;
    locateUser(false, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateUser]);

  useEffect(() => {
    // Only greenfield route-building gets the first-route tutorial — not
    // when opening an existing route to view/edit it.
    if (routeToLoad) return;
    (async () => {
      const seen = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (!seen) setTutorialStep(1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishTutorial = useCallback(() => {
    setTutorialStep(null);
    AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, '1').catch(() => {});
  }, []);

  useEffect(() => {
    if (tutorialStep === null) return;
    if (waypoints.length === 1 && tutorialStep < 2) setTutorialStep(2);
    else if (waypoints.length >= 2 && tutorialStep < 3) setTutorialStep(3);
  }, [waypoints.length, tutorialStep]);

  useEffect(() => {
    // Step 3 (drag to reshape) advances on an actual drag, but not everyone
    // will try one unprompted — fall back to advancing after a few seconds
    // so the tutorial never gets stuck waiting.
    if (tutorialStep !== 3) return;
    const t = setTimeout(() => setTutorialStep(4), 6000);
    return () => clearTimeout(t);
  }, [tutorialStep]);

  useEffect(() => {
    if (!routeToLoad) return;
    setWaypoints(routeToLoad.waypoints);
    setSegments(routeToLoad.segments);
    setHistory([]);
    // Only treat this as an edit-in-place if it's the viewer's own route —
    // opening someone else's route on the map is for viewing/exporting, and
    // saving from there should never silently overwrite their route.
    setEditingRoute(routeToLoad.isOwnedByMe ? routeToLoad : null);
    // Seed the already-known gain immediately — the live re-fetch below is
    // debounced (and then hits the network), so without this, saving right
    // after opening a route for editing (before that resolves) would
    // overwrite the correct stored gain with a stale/zero value.
    setElevationGainM(routeToLoad.elevationGainM);
    const last = routeToLoad.waypoints[routeToLoad.waypoints.length - 1];
    if (last) {
      const nextCenter: LatLng = { latitude: last.latitude, longitude: last.longitude };
      setCenter(nextCenter);
      cameraRef.current?.setCamera({
        centerCoordinate: [nextCenter.longitude, nextCenter.latitude],
        zoomLevel: CAMERA_ZOOM,
        animationDuration: 500,
      });
    }
    onRouteConsumed?.();
  }, [routeToLoad, onRouteConsumed]);

  const rawFullPath = useMemo<PathPoint[]>(() => {
    if (waypoints.length === 0) return [];
    const points: PathPoint[] = [waypoints[0]];
    for (const segment of segments) {
      points.push(...segment.path.slice(1));
    }
    return points;
  }, [waypoints, segments]);

  const distanceKm = useMemo(() => metersToKm(totalRouteDistance(segments)), [segments]);

  // Real routed distance of an existing segment, if one exists between
  // these two waypoint ids — used to back a leg out of the running total
  // when checking a hypothetical drag before it's committed.
  const segmentDistanceKm = useCallback(
    (fromId: string, toId: string) => {
      const segment = segments.find((s) => s.fromId === fromId && s.toId === toId);
      return segment ? metersToKm(segment.distanceMeters) : 0;
    },
    [segments],
  );

  // Straight-line pre-check run before any Mapbox call — cheap and instant,
  // and conservative enough (a routed distance is never shorter than the
  // straight line) that passing this never lets an actually-too-long leg
  // through. `hypotheticalTotalKm` is the running total *excluding* the leg
  // being validated, so this checks "would adding this leg push us over."
  const validateLeg = useCallback(
    (from: LatLng, to: LatLng, hypotheticalTotalKm: number): string | null => {
      const legKm = haversineDistance(from, to) / 1000;
      const legLimitKm = ROUTE_LIMITS.legKm[tier];
      if (legKm > legLimitKm) {
        return tier === 'free'
          ? `That point is too far away — free accounts are limited to ${legLimitKm}km between points.`
          : `That point is too far away — keep points within ${legLimitKm}km of each other.`;
      }
      if (hypotheticalTotalKm + legKm > ROUTE_LIMITS.totalKm) {
        return `You've reached the ${ROUTE_LIMITS.totalKm}km route limit.`;
      }
      return null;
    },
    [tier],
  );

  const renderPath = useMemo(
    () => (pathWithElevation.length === rawFullPath.length ? pathWithElevation : rawFullPath),
    [pathWithElevation, rawFullPath],
  );

  const colorSegments = useMemo(() => colorSegmentsByGrade(renderPath), [renderPath]);
  const peakElevationM = useMemo(() => {
    const elevations = renderPath.map((p) => p.elevation).filter((e): e is number => typeof e === 'number');
    return elevations.length > 0 ? Math.max(...elevations) : null;
  }, [renderPath]);
  const kmMarkers = useMemo(() => kilometerMarkers(rawFullPath), [rawFullPath]);

  const scheduleElevationFetch = useCallback((path: PathPoint[]) => {
    if (elevationTimer.current) clearTimeout(elevationTimer.current);
    if (path.length < 2) {
      setElevationGainM(0);
      setPathWithElevation(path);
      return;
    }
    elevationTimer.current = setTimeout(async () => {
      const requestId = ++elevationRequestId.current;
      setIsFetchingElevation(true);
      try {
        const { path: annotated, gainMeters } = await annotateElevation(path);
        if (requestId !== elevationRequestId.current) return; // superseded by a newer edit
        setPathWithElevation(annotated);
        setElevationGainM(gainMeters);
      } catch (e) {
        if (requestId !== elevationRequestId.current) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch elevation.');
        setPathWithElevation(path);
      } finally {
        if (requestId === elevationRequestId.current) setIsFetchingElevation(false);
      }
    }, ELEVATION_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    scheduleElevationFetch(rawFullPath);
  }, [rawFullPath, scheduleElevationFetch]);

  const routeSegment = useCallback(
    async (from: LatLng, to: LatLng): Promise<RoutedSegment> => {
      try {
        return await routeBetween(from, to);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Routing failed — using a straight line instead.');
        return straightLineFallback(from, to);
      }
    },
    [],
  );

  const snapWaypoint = useCallback((id: string, point: LatLng) => {
    setWaypoints((prev) => prev.map((wp) => (wp.id === id ? { ...wp, ...point } : wp)));
  }, []);

  const handleMapPress = useCallback(
    async (coord: LatLng) => {
      const previous = waypoints[waypoints.length - 1];

      if (previous) {
        // Checked before anything else — no waypoint is added and no
        // Mapbox call is fired if this leg (or the route total) is over cap.
        const capMessage = validateLeg(previous, coord, distanceKm);
        if (capMessage) {
          setError(capMessage);
          return;
        }
      }

      pushHistory();
      const newWaypoint: Waypoint = { id: makeId(), ...coord };
      setWaypoints((prev) => [...prev, newWaypoint]);

      if (previous) {
        // Draw a straight line immediately so the tap feels instant, then
        // swap it for the real routed path once Directions responds.
        const optimistic = straightLineFallback(previous, newWaypoint);
        setSegments((prev) => [
          ...prev,
          { fromId: previous.id, toId: newWaypoint.id, ...optimistic },
        ]);

        setIsRouting(true);
        try {
          const routed = await routeSegment(previous, newWaypoint);
          setSegments((prev) =>
            prev.map((s) =>
              s.fromId === previous.id && s.toId === newWaypoint.id
                ? { fromId: previous.id, toId: newWaypoint.id, ...routed }
                : s,
            ),
          );
          // The routed line snaps to the road even if the tap missed it slightly —
          // pull the pins along with it so they don't sit off the line.
          snapWaypoint(previous.id, routed.snappedFrom);
          snapWaypoint(newWaypoint.id, routed.snappedTo);
        } finally {
          setIsRouting(false);
        }
      }
    },
    [waypoints, routeSegment, snapWaypoint, validateLeg, distanceKm, pushHistory],
  );

  const handleMarkerDragEnd = useCallback(
    async (id: string, coord: LatLng) => {
      const index = waypoints.findIndex((wp) => wp.id === id);
      if (index === -1) return;

      const prevNeighbor = waypoints[index - 1];
      const nextNeighbor = waypoints[index + 1];

      // Back the two legs touching this point out of the running total
      // before checking the hypothetical new position — otherwise the
      // point's own existing legs would double-count against the cap.
      let hypotheticalTotalKm = distanceKm;
      if (prevNeighbor) hypotheticalTotalKm -= segmentDistanceKm(prevNeighbor.id, waypoints[index].id);
      if (nextNeighbor) hypotheticalTotalKm -= segmentDistanceKm(waypoints[index].id, nextNeighbor.id);

      const capMessage =
        (prevNeighbor && validateLeg(prevNeighbor, coord, hypotheticalTotalKm)) ||
        (nextNeighbor && validateLeg(coord, nextNeighbor, hypotheticalTotalKm)) ||
        null;
      if (capMessage) {
        // Reject silently as far as state goes — not updating waypoints
        // leaves the marker's controlled `coordinate` prop unchanged, which
        // snaps it back to its last committed position on the next render.
        setError(capMessage);
        return;
      }

      pushHistory();
      setTutorialStep((prev) => (prev === 3 ? 4 : prev));

      const updatedWaypoints = waypoints.map((wp) => (wp.id === id ? { ...wp, ...coord } : wp));
      setWaypoints(updatedWaypoints);

      const replaceSegment = (from: Waypoint, to: Waypoint, routed: { path: PathPoint[]; distanceMeters: number }) => {
        setSegments((prev) =>
          prev.map((s) => (s.fromId === from.id && s.toId === to.id ? { fromId: from.id, toId: to.id, ...routed } : s)),
        );
      };

      const jobs: Promise<void>[] = [];

      if (index > 0) {
        const from = updatedWaypoints[index - 1];
        const to = updatedWaypoints[index];
        replaceSegment(from, to, straightLineFallback(from, to));
        jobs.push(
          routeSegment(from, to).then((routed) => {
            replaceSegment(from, to, routed);
            // `to` is the dragged point — snap it to the road the line actually landed on.
            snapWaypoint(to.id, routed.snappedTo);
          }),
        );
      }

      if (index < updatedWaypoints.length - 1) {
        const from = updatedWaypoints[index];
        const to = updatedWaypoints[index + 1];
        replaceSegment(from, to, straightLineFallback(from, to));
        jobs.push(
          routeSegment(from, to).then((routed) => {
            replaceSegment(from, to, routed);
            snapWaypoint(from.id, routed.snappedFrom);
          }),
        );
      }

      if (jobs.length === 0) return;

      setIsRouting(true);
      try {
        await Promise.all(jobs);
      } finally {
        setIsRouting(false);
      }
    },
    [waypoints, routeSegment, snapWaypoint, validateLeg, distanceKm, segmentDistanceKm, pushHistory],
  );

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      setWaypoints(previous.waypoints);
      setSegments(previous.segments);
      return h.slice(0, -1);
    });
  }, []);

  const handleDeleteWaypoint = useCallback(
    (id: string) => {
      const index = waypoints.findIndex((wp) => wp.id === id);
      if (index === -1) return;

      Alert.alert('Delete point', 'Remove this waypoint from the route?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            pushHistory();
            const prevWp = waypoints[index - 1];
            const nextWp = waypoints[index + 1];

            setWaypoints((prev) => prev.filter((_, i) => i !== index));

            if (prevWp && nextWp) {
              // Bridge the gap left behind with a straight line immediately, then
              // swap it for a routed segment — same pattern as adding a point.
              const optimistic = straightLineFallback(prevWp, nextWp);
              const bridgeSegment: RouteSegment = { fromId: prevWp.id, toId: nextWp.id, ...optimistic };
              setSegments((prev) => [...prev.slice(0, index - 1), bridgeSegment, ...prev.slice(index + 1)]);

              setIsRouting(true);
              try {
                const routed = await routeSegment(prevWp, nextWp);
                setSegments((prev) =>
                  prev.map((s) =>
                    s.fromId === prevWp.id && s.toId === nextWp.id ? { fromId: prevWp.id, toId: nextWp.id, ...routed } : s,
                  ),
                );
              } finally {
                setIsRouting(false);
              }
            } else if (index === 0) {
              setSegments((prev) => prev.slice(1));
            } else {
              setSegments((prev) => prev.slice(0, -1));
            }
          },
        },
      ]);
    },
    [waypoints, routeSegment, pushHistory],
  );

  const handleEditWaypointNote = useCallback((id: string, note: string) => {
    setWaypoints((prev) => prev.map((wp) => (wp.id === id ? { ...wp, note } : wp)));
  }, []);

  const handleRequestClose = useCallback(() => {
    if (waypoints.length === 0) {
      onClose();
      return;
    }
    Alert.alert('Discard route?', "You have unsaved changes — exiting now will lose your progress.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  }, [waypoints.length, onClose]);

  const handleClear = useCallback(() => {
    setWaypoints([]);
    setSegments([]);
    setElevationGainM(0);
    setPathWithElevation([]);
    setEditingRoute(null);
    setHistory([]);
  }, []);

  // Most running routes start and end in the same place — this saves
  // manually retracing the whole route back to the start (double the taps,
  // double the Mapbox calls). Hidden once the endpoints are already close,
  // or once the route can't take another leg under the free-tier cap.
  const canCloseLoop = useMemo(() => {
    if (waypoints.length < 2) return false;
    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];
    return haversineDistance(start, end) / 1000 >= 0.05;
  }, [waypoints]);

  const handleCloseLoop = useCallback(async () => {
    if (waypoints.length < 2) return;
    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];

    const capMessage = validateLeg(end, start, distanceKm);
    if (capMessage) {
      setError(capMessage);
      return;
    }

    pushHistory();
    const closingPoint: Waypoint = { id: makeId(), latitude: start.latitude, longitude: start.longitude };
    setWaypoints((prev) => [...prev, closingPoint]);

    const optimistic = straightLineFallback(end, closingPoint);
    setSegments((prev) => [...prev, { fromId: end.id, toId: closingPoint.id, ...optimistic }]);

    setIsRouting(true);
    try {
      const routed = await routeSegment(end, closingPoint);
      setSegments((prev) =>
        prev.map((s) =>
          s.fromId === end.id && s.toId === closingPoint.id ? { fromId: end.id, toId: closingPoint.id, ...routed } : s,
        ),
      );
    } finally {
      setIsRouting(false);
    }
  }, [waypoints, validateLeg, distanceKm, routeSegment, pushHistory]);

  const fileName = useMemo(() => `rootah_route_${Date.now()}.gpx`, [showExportSheet]);

  const handleOpenExport = useCallback(() => {
    if (rawFullPath.length < 2) {
      Alert.alert('Nothing to export', 'Place at least two points to build a route first.');
      return;
    }
    setShowExportSheet(true);
  }, [rawFullPath]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const gpx = buildGpx(renderPath);
      const file = new File(Paths.cache, fileName);
      file.create({ overwrite: true });
      file.write(gpx);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx' });
        setShowExportSheet(false);
      } else {
        Alert.alert('Sharing unavailable', `Route saved to ${file.uri}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export GPX.');
    } finally {
      setIsSharing(false);
    }
  }, [renderPath, fileName]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handlePressSave = useCallback(async () => {
    // Editing an already-saved route never adds to the count, so it's exempt from the cap.
    if (tier === 'free' && !editingRoute) {
      setCheckingRouteLimit(true);
      try {
        const count = await countMyRoutes();
        if (count >= ROUTE_LIMITS.maxSavedRoutesFree) {
          onRequirePaywall?.();
          return;
        }
      } catch {
        // If the count check fails, don't block the save on a network hiccup — the
        // server-side data itself has no hard limit, this is a soft UX gate only.
      } finally {
        setCheckingRouteLimit(false);
      }
    }
    setShowSaveModal(true);
  }, [tier, editingRoute, onRequirePaywall]);

  const handleSaveRoute = useCallback(
    async (name: string, description: string, activityType: ActivityType) => {
      setIsSavingRoute(true);
      try {
        const city = saveCity ?? (waypoints[0] ? await reverseGeocodeCity(waypoints[0]) : null);
        AsyncStorage.setItem(LAST_ACTIVITY_TYPE_KEY, activityType).catch(() => {});
        const payload = {
          name,
          description,
          activityType,
          waypoints,
          segments,
          distanceKm,
          elevationGainM,
          elevationProfile: downsampleForStorage(renderPath),
          city,
        };

        if (tutorialStep !== null) finishTutorial();

        if (editingRoute) {
          const updated = await updateRoute(editingRoute.id, payload);
          setShowSaveModal(false);
          handleClear();
          onRouteUpdated?.(updated);
        } else {
          const created = await createRoute(payload);
          setShowSaveModal(false);
          handleClear();
          onRouteCreated?.(created);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save route.');
      } finally {
        setIsSavingRoute(false);
      }
    },
    [
      waypoints,
      segments,
      distanceKm,
      elevationGainM,
      renderPath,
      handleClear,
      onRouteCreated,
      onRouteUpdated,
      editingRoute,
      tutorialStep,
      finishTutorial,
      saveCity,
    ],
  );

  const hasRoute = waypoints.length > 0;

  return (
    <View style={styles.container}>
      <RouteMap
        ref={cameraRef}
        initialCenter={center}
        waypoints={waypoints}
        colorSegments={colorSegments}
        kmMarkers={kmMarkers}
        mapStyleMode={mapStyleMode}
        is3D={is3D}
        onMapPress={handleMapPress}
        onMarkerDragEnd={handleMarkerDragEnd}
        onMarkerPress={handleDeleteWaypoint}
      />

      {!hasRoute && (
        <View pointerEvents="none" style={styles.centerPinHint} />
      )}

      <Pressable
        style={[
          styles.textToggleButton,
          { bottom: 228 },
          mapStyleMode === 'satellite' && styles.textToggleButtonActive,
        ]}
        onPress={() => setMapStyleMode((prev) => (prev === 'satellite' ? 'standard' : 'satellite'))}
      >
        <Text
          style={[
            styles.textToggleButtonText,
            mapStyleMode === 'satellite' && styles.textToggleButtonTextActive,
          ]}
        >
          SAT
        </Text>
      </Pressable>

      <Pressable
        style={[styles.textToggleButton, { bottom: 172 }, is3D && styles.textToggleButtonActive]}
        onPress={() => setIs3D((prev) => !prev)}
      >
        <Text style={[styles.textToggleButtonText, is3D && styles.textToggleButtonTextActive]}>3D</Text>
      </Pressable>

      <Pressable style={styles.locateButton} onPress={() => locateUser(true)}>
        <Text style={styles.locateButtonText}>◎</Text>
      </Pressable>

      <View style={styles.topOverlay}>
        <View style={styles.brandRow}>
          <Logo size={36} />
          <Pressable style={styles.closeButton} onPress={handleRequestClose}>
            <CloseIcon />
          </Pressable>
        </View>

        {hasRoute && (
          <View style={styles.statsWrap}>
            <RouteStatsBar
              distanceKm={distanceKm}
              elevationGainM={elevationGainM}
              peakElevationM={peakElevationM}
              isRouting={isRouting}
              isFetchingElevation={isFetchingElevation}
            />
            <Pressable style={styles.pointsPill} onPress={() => setShowPointsModal(true)}>
              <Text style={styles.pointsPillText}>
                {waypoints.length} point{waypoints.length === 1 ? '' : 's'} · edit or delete ›
              </Text>
            </Pressable>
          </View>
        )}

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {toast && (
          <View style={styles.toastBanner}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </View>

      {!hasRoute && tutorialStep === null && (
        <View style={styles.hintSheet}>
          <Text style={styles.hintTitle}>Tap the map to start</Text>
          <Text style={styles.hintBody}>
            Your first tap sets the start point. Keep tapping to add stops — Rootah routes along
            real streets automatically.
          </Text>
        </View>
      )}

      {tutorialStep !== null && (
        <BuilderTutorial
          step={tutorialStep}
          variant={hasRoute ? 'card' : 'sheet'}
          onSkip={finishTutorial}
          onFinish={finishTutorial}
        />
      )}

      {hasRoute && (
        <View style={styles.bottomOverlay}>
          <Pressable
            style={[styles.iconButton, styles.amberButton]}
            onPress={handleUndo}
            disabled={history.length === 0}
          >
            <UndoIcon />
          </Pressable>
          {canCloseLoop && (
            <Pressable style={[styles.iconButton, styles.aquaButton]} onPress={handleCloseLoop} disabled={isRouting}>
              <LoopIcon />
            </Pressable>
          )}
          <Pressable
            style={[styles.iconButton, styles.sandButton]}
            onPress={handleClear}
            disabled={waypoints.length === 0}
          >
            <CloseIcon />
          </Pressable>
          <Pressable
            style={[styles.iconButton, styles.aquaButton]}
            onPress={handlePressSave}
            disabled={rawFullPath.length < 2 || checkingRouteLimit}
          >
            {checkingRouteLimit ? <ActivityIndicator color={colors.ink} size="small" /> : <SaveIcon />}
          </Pressable>
          <Pressable
            style={styles.exportButton}
            onPress={handleOpenExport}
            disabled={rawFullPath.length < 2}
          >
            <ExportIcon />
            <Text style={styles.exportButtonText}>EXPORT GPX</Text>
          </Pressable>
        </View>
      )}

      <ExportSheet
        visible={showExportSheet}
        distanceKm={distanceKm}
        elevationGainM={elevationGainM}
        pointCount={waypoints.length}
        fileName={fileName}
        isSharing={isSharing}
        onClose={() => setShowExportSheet(false)}
        onShare={handleShare}
      />

      <SaveRouteModal
        visible={showSaveModal}
        distanceKm={distanceKm}
        elevationGainM={elevationGainM}
        elevationPath={renderPath}
        isSaving={isSavingRoute}
        isEditing={!!editingRoute}
        initialName={editingRoute?.name}
        initialDescription={editingRoute?.description}
        initialActivityType={editingRoute?.activityType}
        suggestedCity={saveCity}
        defaultActivityType={lastActivityType ?? undefined}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveRoute}
      />

      <WaypointListModal
        visible={showPointsModal}
        waypoints={waypoints}
        onClose={() => setShowPointsModal(false)}
        onDelete={handleDeleteWaypoint}
        onEditNote={handleEditWaypointNote}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsWrap: {
    marginTop: 2,
    gap: 8,
  },
  pointsPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  pointsPillText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
  },
  errorBanner: {
    backgroundColor: colors.rustDark,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: colors.cream,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  toastBanner: {
    backgroundColor: colors.ink,
    borderRadius: 8,
    padding: 10,
  },
  toastText: {
    color: colors.sand,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },
  centerPinHint: {
    position: 'absolute',
    top: '44%',
    left: '50%',
    marginLeft: -17,
    marginTop: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    borderStyle: 'dashed',
  },
  textToggleButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(3),
  },
  textToggleButtonActive: {
    backgroundColor: colors.rust,
  },
  textToggleButtonText: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.ink,
  },
  textToggleButtonTextActive: {
    color: colors.sand,
  },
  locateButton: {
    position: 'absolute',
    right: 16,
    bottom: 116,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(3),
  },
  locateButtonText: {
    fontSize: 18,
    color: colors.ink,
  },
  hintSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.sand,
    borderTopWidth: 4,
    borderColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 46,
    gap: 6,
  },
  hintTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
  },
  hintBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 21,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(3),
  },
  amberButton: {
    backgroundColor: colors.amber,
  },
  sandButton: {
    backgroundColor: colors.sand,
  },
  aquaButton: {
    backgroundColor: colors.aqua,
  },
  exportButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.rust,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...brutalShadow(4),
  },
  exportButtonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.sand,
  },
});
