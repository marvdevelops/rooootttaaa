import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, MapView, MarkerView, StyleURL } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BellIcon, CalendarIcon, CloseIcon, FilterIcon, ImportIcon, LockIcon, PlusIcon, RecordIcon, SearchIcon, TrophyIcon, UserIcon, UsersIcon } from '../components/icons';
import Logo from '../components/Logo';
import ProBadge from '../components/ProBadge';
import UpcomingRacesStrip from '../components/UpcomingRacesStrip';
import { useUserTier } from '../hooks/useUserTier';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { ActivityType, CloudRoute, GroupRun, LatLng } from '../types/route';
import { clusterRoutesByStart, RouteCluster } from '../utils/clusterRoutes';
import { haversineDistance } from '../utils/distance';
import { reverseGeocodeCity, reverseGeocodeCountryBounds } from '../utils/geocoding';
import { listRunsNearLocation, listUpcomingRaces } from '../utils/groupRunsApi';
import '../utils/mapboxInit';
import { listPublicRoutes, PublicRouteFilters, searchRoutes } from '../utils/routesApi';

function formatDistanceAway(distanceKm: number): string {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)}m away`;
  return `${distanceKm.toFixed(1)}km away`;
}

function daysAway(scheduledAt: number): string {
  const diffMs = scheduledAt - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  return `${diffDays} days away`;
}

function formatRunWhen(ms: number): string {
  const d = new Date(ms);
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

interface RunsNearYouStripProps {
  onOpenGroupRun: (groupRunId: string) => void;
  /** Center of the currently visible map viewport — which events are fetched tracks whatever the user is looking at, not just their fixed GPS position. */
  mapCenter: LatLng | null;
  /** Derived from the visible viewport (roughly center-to-corner) so panning/zooming actually changes which events are shown. */
  radiusKm: number;
  /** The device's actual GPS position — used only for the "X km away" label on each card, never for what's fetched. Null (permission denied / not yet resolved) hides the label entirely rather than showing a distance from somewhere else. */
  userLocation: LatLng | null;
  refreshSignal?: number;
}

/** Horizontal strip of upcoming group runs near the current map view (real radius search, not a city-string match) — Option C from the group-run-features spec: lowest effort, doesn't disrupt the existing route map UX. RSVPing happens on the group run detail screen (tap a card), not from here. */
function RunsNearYouStrip({ onOpenGroupRun, mapCenter, radiusKm, userLocation, refreshSignal }: RunsNearYouStripProps) {
  const [runs, setRuns] = useState<GroupRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRunsNearLocation(mapCenter, radiusKm)
      .then((data) => {
        if (!cancelled) setRuns(data);
      })
      .catch(() => {
        // Non-critical — the route map still works without this strip.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapCenter?.latitude, mapCenter?.longitude, radiusKm, refreshSignal]);

  if (loading || runs.length === 0) return null;

  return (
    <View style={styles.runsStripWrap} pointerEvents="box-none">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.runsStripContent}>
        {runs.map((run) => {
          const distanceKm =
            userLocation && run.startLat !== null && run.startLng !== null
              ? haversineDistance(userLocation, { latitude: run.startLat, longitude: run.startLng }) / 1000
              : null;
          return (
          <Pressable key={run.id} style={styles.runCard} onPress={() => onOpenGroupRun(run.id)}>
            <View style={styles.runCardWhenRow}>
              <CalendarIcon size={12} />
              <Text style={styles.runCardWhen}>{formatRunWhen(run.scheduledAt)}</Text>
              {run.seriesId && <Text style={styles.runCardWhen}> · 🔁</Text>}
            </View>
            <Text style={styles.runCardTitle} numberOfLines={1}>
              {run.title}
            </Text>
            <Text style={styles.runCardRoute} numberOfLines={1}>
              {run.routeName} · {run.routeDistanceKm.toFixed(1)}km
            </Text>
            {run.hostUsername !== 'unknown' && (
              <Text style={styles.runCardHost} numberOfLines={1}>
                by @{run.hostUsername}
              </Text>
            )}
            <View style={styles.runCardFooter}>
              <Text style={styles.runCardMeta} numberOfLines={1}>
                {distanceKm !== null ? `${formatDistanceAway(distanceKm)} · ` : ''}
                {run.rsvpCount} going · {daysAway(run.scheduledAt)}
              </Text>
            </View>
          </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Below this span (in degrees, ~30m), a cluster's members are basically on
// top of each other — fitBounds on a near-zero box zooms to an absurd
// level, so treat it as "truly overlapping" and just show the list instead.
const CLUSTER_MIN_SPAN_DEG = 0.0003;

function latToMercatorY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return Math.log((1 + sin) / (1 - sin)) / 2;
}

/**
 * Standard "zoom to fit bounds" estimate (Google Maps' well-known formula,
 * adapted for Mapbox's 256px tiles) — lets a cluster tap update `zoom`
 * (and therefore re-cluster) in the same tick as the fitBounds() camera
 * call below, instead of waiting ~500ms for onMapIdle to fire once the
 * animation settles.
 */
function estimateZoomForBounds(minLat: number, minLng: number, maxLat: number, maxLng: number, paddingPx: number): number {
  const { width, height } = Dimensions.get('window');
  const mapWidth = Math.max(1, width - paddingPx * 2);
  const mapHeight = Math.max(1, height - paddingPx * 2);

  const latFraction = (latToMercatorY(maxLat) - latToMercatorY(minLat)) / Math.PI;
  let lngDiff = maxLng - minLng;
  if (lngDiff < 0) lngDiff += 360;
  const lngFraction = lngDiff / 360;

  const zoomForDim = (pxSize: number, fraction: number) => Math.log2(pxSize / 256 / Math.max(fraction, 1e-9));
  const zoom = Math.min(zoomForDim(mapHeight, latFraction), zoomForDim(mapWidth, lngFraction));
  return Math.max(1, Math.min(20, zoom));
}

interface Props {
  onOpenDetail: (route: CloudRoute) => void;
  onOpenProfile: () => void;
  onOpenGroupRuns: () => void;
  onOpenGroupRun: (groupRunId: string) => void;
  onOpenClubs: () => void;
  onOpenNotifications: () => void;
  unreadNotificationCount: number;
  onStartRecording: () => void;
  onCreateRoute: () => void;
  onImportGpx: () => void;
  onCreateEvent: () => void;
  /** Bump this to force a re-fetch (e.g. after a route is created or deleted elsewhere). */
  refreshSignal?: number;
}

/** Fades a pin in on mount so new/re-clustered markers ease in instead of popping in instantly. */
function FadeInPin({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

// Rootah launches first in the Philippines, so that's the default origin —
// actual device location (when granted) always takes over via the effect
// below; this is only what shows before/without that.
const DEFAULT_CENTER: [number, number] = [121.774, 12.8797];
const COUNTRY_ZOOM_FALLBACK = 4.5;
const SHOW_UPCOMING_RACES_KEY = 'rootah_show_upcoming_races';

// No safe-area-inset library wired into the app — this is a fixed
// approximation of the home-indicator / gesture-nav inset so the FAB
// actually sits in the bottom-right corner instead of crowding the edge.
const BOTTOM_SAFE_PAD = Platform.OS === 'ios' ? 34 : 16;

// A single center+zoom can't guarantee the whole archipelago fits on
// screen — the Philippines is tall and narrow (~1850km N-S, much less
// E-W), so a zoom level tuned for one aspect ratio crops the other. A real
// bounding box, fit with fitBounds, always frames the whole country
// regardless of device screen size/orientation.
const PHILIPPINES_NE: [number, number] = [126.6, 21.2];
const PHILIPPINES_SW: [number, number] = [116.7, 4.5];

const ACTIVITY_TYPE_FILTER_OPTIONS: { value: ActivityType | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'run', label: 'Run' },
  { value: 'trail_run', label: 'Trail Run' },
  { value: 'hike', label: 'Hike' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
];

function isWithinPhilippines(point: { latitude: number; longitude: number }): boolean {
  return (
    point.longitude >= PHILIPPINES_SW[0] &&
    point.longitude <= PHILIPPINES_NE[0] &&
    point.latitude >= PHILIPPINES_SW[1] &&
    point.latitude <= PHILIPPINES_NE[1]
  );
}

export default function DiscoverMapScreen({
  onOpenDetail,
  onOpenProfile,
  onOpenGroupRuns,
  onOpenGroupRun,
  onOpenClubs,
  onOpenNotifications,
  unreadNotificationCount,
  onStartRecording,
  onCreateRoute,
  onImportGpx,
  onCreateEvent,
  refreshSignal,
}: Props) {
  const tier = useUserTier();
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [zoom, setZoom] = useState(COUNTRY_ZOOM_FALLBACK);
  const [openCluster, setOpenCluster] = useState<RouteCluster | null>(null);

  const [minDistance, setMinDistance] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const [maxElevation, setMaxElevation] = useState('');
  const [city, setCity] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState<ActivityType | undefined>(undefined);
  const [appliedFilters, setAppliedFilters] = useState<PublicRouteFilters>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CloudRoute[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      searchRoutes(query)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const cameraRef = useRef<React.ElementRef<typeof Camera>>(null);
  const hasFitBounds = useRef(false);
  // Whether the location+country-bounds attempt has settled (success,
  // failure, or no permission) — gates the routes-bounds fallback so a fast
  // routes fetch can't win the race and zoom in before the country view had
  // a chance to apply. State (not a ref) so the gated effect re-fires once
  // this flips even if `routes` itself doesn't change again.
  const [locationInitDone, setLocationInitDone] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  // Drives the "runs near you" strip — starts at the device's GPS position,
  // then follows wherever the user pans/zooms the map so the strip always
  // reflects what's currently on screen instead of staying pinned to a
  // one-time location.
  const [mapViewport, setMapViewport] = useState<{ center: LatLng; radiusKm: number } | null>(null);
  // Upcoming races strip — replaces the old "Top in your city" routes strip.
  // Toggleable the same way the old "Popular" routes strip was, remembered
  // per-device.
  const [showUpcomingRaces, setShowUpcomingRaces] = useState(false);
  const [upcomingRaces, setUpcomingRaces] = useState<GroupRun[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(SHOW_UPCOMING_RACES_KEY).then((v) => {
      if (v === '1') setShowUpcomingRaces(true);
    });
  }, []);

  const toggleUpcomingRaces = useCallback(() => {
    setShowUpcomingRaces((prev) => {
      const next = !prev;
      AsyncStorage.setItem(SHOW_UPCOMING_RACES_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    listUpcomingRaces()
      .then((races) => {
        if (!cancelled) setUpcomingRaces(races);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  const refresh = useCallback(async (filters: PublicRouteFilters) => {
    setLoading(true);
    setError(null);
    try {
      setRoutes(await listPublicRoutes(filters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load routes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh(appliedFilters);
  }, [appliedFilters, refresh, refreshSignal]);

  useEffect(() => {
    // Open zoomed out to the user's whole country, so all their local routes
    // are visible at a glance rather than starting on a single city block.
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          // No permission — origin stays the Philippines rather than
          // silently sitting on whatever the last resolved position was.
          hasFitBounds.current = true;
          cameraRef.current?.fitBounds(PHILIPPINES_NE, PHILIPPINES_SW, 20, 0);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const point = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(point);
        // Seeds the strip before the map's first onMapIdle fires — that
        // handler takes over (viewport-based radius) as soon as it does.
        setMapViewport((prev) => prev ?? { center: point, radiusKm: 50 });

        if (isWithinPhilippines(point)) {
          // Use our own verified bounds rather than the geocoder's — its
          // country bbox for an archipelago cuts off outlying islands
          // (northern Luzon, Palawan), which is exactly the crop this was
          // fixing.
          hasFitBounds.current = true;
          cameraRef.current?.fitBounds(PHILIPPINES_NE, PHILIPPINES_SW, 20, 0);
          return;
        }

        const bounds = await reverseGeocodeCountryBounds(point);
        if (bounds) {
          hasFitBounds.current = true;
          cameraRef.current?.fitBounds(bounds.ne, bounds.sw, 20, 0);
        } else {
          // Couldn't resolve country bounds — still show a wide view around
          // the user rather than a single city block, but leave hasFitBounds
          // unset so the routes-bounds fallback below can still take over.
          cameraRef.current?.setCamera({
            centerCoordinate: [point.longitude, point.latitude],
            zoomLevel: COUNTRY_ZOOM_FALLBACK,
            animationDuration: 0,
          });
        }
      } catch {
        // Location failed entirely — fall back to the Philippines rather
        // than leaving whatever the Camera happened to be showing.
        hasFitBounds.current = true;
        cameraRef.current?.fitBounds(PHILIPPINES_NE, PHILIPPINES_SW, 20, 0);
      } finally {
        setLocationInitDone(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!locationInitDone || hasFitBounds.current || routes.length === 0) return;
    const lats = routes.map((r) => r.waypoints[0]?.latitude).filter((n): n is number => n !== undefined);
    const lngs = routes.map((r) => r.waypoints[0]?.longitude).filter((n): n is number => n !== undefined);
    if (lats.length === 0) return;
    hasFitBounds.current = true;
    if (lats.length === 1) {
      cameraRef.current?.setCamera({ centerCoordinate: [lngs[0], lats[0]], zoomLevel: 12, animationDuration: 0 });
      return;
    }
    cameraRef.current?.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      60,
      0,
    );
  }, [routes, locationInitDone]);

  const clusters = useMemo(() => clusterRoutesByStart(routes, zoom), [routes, zoom]);

  // Fits the camera to the bounding box of every route start in the
  // cluster, so a tap always brings every member into view in one go —
  // picking a zoom level centered on the old centroid (the previous
  // approach) could leave newly-split-apart pins scattered outside the
  // viewport if they were geographically far from each other, making the
  // tap look like it did nothing. onMapIdle (already wired below) re-syncs
  // `zoom` and re-clusters once the camera settles.
  const handleClusterPress = useCallback((cluster: RouteCluster) => {
    const starts = cluster.routes.map((r) => r.waypoints[0]).filter((w): w is NonNullable<typeof w> => !!w);
    if (starts.length <= 1) {
      setOpenCluster(cluster);
      return;
    }

    const lats = starts.map((s) => s.latitude);
    const lngs = starts.map((s) => s.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    if (Math.max(maxLat - minLat, maxLng - minLng) < CLUSTER_MIN_SPAN_DEG) {
      // Truly overlapping — no useful bounds to fit, further zoom won't help.
      setOpenCluster(cluster);
      return;
    }

    const PADDING_PX = 80;
    cameraRef.current?.fitBounds([maxLng, maxLat], [minLng, minLat], PADDING_PX, 500);
    // Re-cluster immediately instead of waiting for onMapIdle — that native
    // event only fires once the camera+tiles settle, which felt like a
    // ~1s delay before the split-apart pins appeared.
    setZoom(estimateZoomForBounds(minLat, minLng, maxLat, maxLng, PADDING_PX));
  }, []);

  const activeFilterCount = useMemo(
    () => [appliedFilters.minDistanceKm, appliedFilters.maxDistanceKm, appliedFilters.maxElevationGainM, appliedFilters.city, appliedFilters.activityType].filter(
      (v) => v !== undefined && v !== '',
    ).length,
    [appliedFilters],
  );

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      minDistanceKm: minDistance ? Number(minDistance) : undefined,
      maxDistanceKm: maxDistance ? Number(maxDistance) : undefined,
      maxElevationGainM: maxElevation ? Number(maxElevation) : undefined,
      city: city.trim() || undefined,
      activityType: activityTypeFilter,
    });
    setShowFilters(false);
  }, [minDistance, maxDistance, maxElevation, city, activityTypeFilter]);

  const handleClearFilters = useCallback(() => {
    setMinDistance('');
    setMaxDistance('');
    setMaxElevation('');
    setCity('');
    setActivityTypeFilter(undefined);
    setAppliedFilters({});
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleURL={StyleURL.Light}
        scaleBarEnabled={false}
        compassEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onMapIdle={(state) => {
          // Round so tiny floating-point zoom deltas from panning (not
          // actually zooming) don't retrigger clustering — every re-cluster
          // remounts MarkerViews for any group whose membership shifts,
          // which is what was causing the tap-to-open lag.
          const rounded = Math.round(state.properties.zoom * 2) / 2;
          setZoom((prev) => (prev === rounded ? prev : rounded));

          // Keeps "runs near you" in sync with whatever's actually on
          // screen. Radius is the distance to the *nearer* edge (north or
          // east), not the corner — the corner is further away than the
          // edges, so using it let events outside the visible rectangle
          // still qualify as "nearby."
          const [centerLng, centerLat] = state.properties.center;
          const [neLng, neLat] = state.properties.bounds.ne;
          const center = { latitude: centerLat, longitude: centerLng };
          const northEdgeKm = haversineDistance(center, { latitude: neLat, longitude: centerLng }) / 1000;
          const eastEdgeKm = haversineDistance(center, { latitude: centerLat, longitude: neLng }) / 1000;
          const radiusKm = Math.min(400, Math.max(2, Math.min(northEdgeKm, eastEdgeKm)));
          setMapViewport({ center, radiusKm: Math.round(radiusKm) });
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: DEFAULT_CENTER, zoomLevel: COUNTRY_ZOOM_FALLBACK }}
        />

        {clusters.map((cluster) => {
          if (cluster.routes.length === 1) {
            const route = cluster.routes[0];
            return (
              // MarkerView (view annotations) rather than PointAnnotation —
              // PointAnnotation's native host view is sized to a fixed
              // snapshot of its content and clips anything laid out outside
              // that box, which silently ate the distance label here before.
              <MarkerView
                key={route.id}
                coordinate={[cluster.center.longitude, cluster.center.latitude]}
                anchor={{ x: 0.13, y: 1 }}
              >
                <FadeInPin>
                  <Pressable onPress={() => onOpenDetail(route)} style={styles.pin}>
                    <View style={styles.pinRow}>
                      <View style={styles.pinDot} />
                      <View style={styles.pinLabel}>
                        <Text style={styles.pinLabelText}>
                          {route.isTrail ? '🥾 ' : ''}
                          {route.distanceKm.toFixed(1)} km
                        </Text>
                      </View>
                    </View>
                    <View style={styles.pinTail} />
                  </Pressable>
                </FadeInPin>
              </MarkerView>
            );
          }

          // Multiple routes start at ~the same spot — collapse them into one
          // pin with a count badge rather than letting them silently stack
          // and hide each other; tapping opens a picker for the group.
          return (
            <MarkerView
              key={cluster.routes.map((r) => r.id).join('-')}
              coordinate={[cluster.center.longitude, cluster.center.latitude]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <FadeInPin>
                <Pressable
                  onPress={() => handleClusterPress(cluster)}
                  style={({ pressed }) => [styles.clusterPin, pressed && styles.clusterPinPressed]}
                  hitSlop={6}
                >
                  <View style={styles.clusterDot}>
                    <Text style={styles.clusterDotText}>{cluster.routes.length}</Text>
                  </View>
                  <View style={styles.pinTail} />
                </Pressable>
              </FadeInPin>
            </MarkerView>
          );
        })}
      </MapView>

      <View pointerEvents="none" style={styles.tint} />

      <View style={styles.topOverlay}>
        <View style={styles.brandRow}>
          <View style={styles.brandGroup}>
            <Logo size={36} />
            {tier === 'paid' && <ProBadge />}
          </View>
          <View style={styles.topButtons}>
            <Pressable style={styles.groupRunsButton} onPress={onOpenGroupRuns}>
              <CalendarIcon size={16} />
            </Pressable>
            <Pressable style={styles.groupRunsButton} onPress={onOpenClubs}>
              <UsersIcon size={16} />
            </Pressable>
            <Pressable style={styles.groupRunsButton} onPress={onOpenNotifications}>
              <BellIcon size={16} />
              {unreadNotificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable style={styles.profileButton} onPress={onOpenProfile}>
              <UserIcon size={18} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <SearchIcon size={14} color={colors.stone} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search routes..."
              placeholderTextColor={colors.mist}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <CloseIcon size={14} color={colors.stone} />
              </Pressable>
            )}
          </View>
        </View>

        {searchQuery.trim().length > 0 && (
          <View style={styles.searchResultsWrap}>
            {searchLoading ? (
              <ActivityIndicator color={colors.coral} style={{ marginTop: 20 }} />
            ) : searchResults.length === 0 ? (
              <Text style={styles.searchEmptyText}>No routes match &quot;{searchQuery.trim()}&quot;</Text>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.searchResultsList}>
                {searchResults.map((r) => (
                  <Pressable key={r.id} style={styles.searchResultCard} onPress={() => onOpenDetail(r)}>
                    <Text style={styles.searchResultName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text style={styles.searchResultMeta} numberOfLines={1}>
                      {r.distanceKm.toFixed(1)} km · +{Math.round(r.elevationGainM)} m
                      {r.city ? ` · ${r.city}` : ''}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        <View style={styles.topFilterRow}>
          <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
            <FilterIcon size={14} />
            <Text style={styles.filterButtonText}>
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterButton, showUpcomingRaces && styles.filterButtonActive]}
            onPress={toggleUpcomingRaces}
          >
            <TrophyIcon size={14} color={showUpcomingRaces ? colors.white : colors.ink} />
            <Text style={[styles.filterButtonText, showUpcomingRaces && styles.filterButtonTextActive]}>
              Races
            </Text>
          </Pressable>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && (
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color={colors.ink} />
          </View>
        )}

        {showUpcomingRaces && <UpcomingRacesStrip races={upcomingRaces} onOpenRace={onOpenGroupRun} />}
      </View>

      {!loading && routes.length === 0 && !error && (
        <View style={styles.emptyState}>
          {activeFilterCount > 0 ? (
            <>
              <Text style={styles.emptyTitle}>No routes match these filters</Text>
              <Pressable onPress={handleClearFilters} hitSlop={8}>
                <Text style={styles.emptyLink}>Clear filters</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>No routes here yet</Text>
              <Text style={styles.emptyBody}>Be the first to create one.</Text>
              <Pressable onPress={onCreateRoute} hitSlop={8}>
                <Text style={styles.emptyLink}>Create a route</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      <RunsNearYouStrip
        onOpenGroupRun={onOpenGroupRun}
        mapCenter={mapViewport?.center ?? null}
        radiusKm={mapViewport?.radiusKm ?? 50}
        userLocation={userLocation}
        refreshSignal={refreshSignal}
      />

      {showAddMenu && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddMenu(false)} />
          <View style={styles.addMenu}>
            <Pressable
              style={styles.addMenuItem}
              onPress={() => {
                setShowAddMenu(false);
                onStartRecording();
              }}
            >
              <RecordIcon size={16} />
              <Text style={styles.addMenuItemText}>Record activity</Text>
            </Pressable>
            <Pressable
              style={styles.addMenuItem}
              onPress={() => {
                setShowAddMenu(false);
                onCreateRoute();
              }}
            >
              <PlusIcon size={16} color={colors.ink} />
              <Text style={styles.addMenuItemText}>Create route</Text>
            </Pressable>
            <Pressable
              style={[styles.addMenuItem, tier === 'free' && styles.addMenuItemLocked]}
              onPress={() => {
                setShowAddMenu(false);
                onImportGpx();
              }}
            >
              <ImportIcon size={16} color={colors.ink} />
              <Text style={styles.addMenuItemText}>Import GPX</Text>
              {tier === 'free' && <LockIcon size={14} color={colors.stone} />}
            </Pressable>
            <Pressable
              style={styles.addMenuItem}
              onPress={() => {
                setShowAddMenu(false);
                onCreateEvent();
              }}
            >
              <CalendarIcon size={16} color={colors.ink} />
              <Text style={styles.addMenuItemText}>Create event</Text>
            </Pressable>
          </View>
        </>
      )}

      <Pressable style={styles.fab} onPress={() => setShowAddMenu((v) => !v)}>
        {showAddMenu ? <CloseIcon size={22} /> : <PlusIcon size={26} />}
      </Pressable>

      {showFilters && (
        <KeyboardAvoidingView
          style={styles.filterBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFilters(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.filterHeaderRow}>
              <Text style={styles.filterTitle}>Filters</Text>
              <Pressable style={styles.filterCloseButton} onPress={() => setShowFilters(false)}>
                <CloseIcon size={16} />
              </Pressable>
            </View>

            <View>
              <Text style={styles.filterLabel}>ACTIVITY</Text>
              <View style={styles.activityFilterRow}>
                {ACTIVITY_TYPE_FILTER_OPTIONS.map((option) => {
                  const active = activityTypeFilter === option.value;
                  return (
                    <Pressable
                      key={option.value ?? 'all'}
                      style={[styles.activityFilterChip, active && styles.activityFilterChipActive]}
                      onPress={() => setActivityTypeFilter(option.value)}
                    >
                      <Text style={[styles.activityFilterChipText, active && styles.activityFilterChipTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.filterLabel}>DISTANCE (KM)</Text>
              <View style={styles.filterRow}>
                <TextInput
                  value={minDistance}
                  onChangeText={setMinDistance}
                  placeholder="Min"
                  placeholderTextColor={colors.mist}
                  keyboardType="numeric"
                  style={[styles.filterInput, styles.filterInputHalf]}
                />
                <TextInput
                  value={maxDistance}
                  onChangeText={setMaxDistance}
                  placeholder="Max"
                  placeholderTextColor={colors.mist}
                  keyboardType="numeric"
                  style={[styles.filterInput, styles.filterInputHalf]}
                />
              </View>
            </View>

            <View>
              <Text style={styles.filterLabel}>MAX ELEVATION GAIN (M)</Text>
              <TextInput
                value={maxElevation}
                onChangeText={setMaxElevation}
                placeholder="e.g. 300"
                placeholderTextColor={colors.mist}
                keyboardType="numeric"
                style={styles.filterInput}
              />
            </View>

            <View>
              <Text style={styles.filterLabel}>CITY</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Search by city"
                placeholderTextColor={colors.mist}
                autoCapitalize="words"
                style={styles.filterInput}
              />
            </View>

            <View style={styles.filterActionsRow}>
              <Pressable style={styles.filterClearButton} onPress={handleClearFilters}>
                <Text style={styles.filterClearButtonText}>CLEAR</Text>
              </Pressable>
              <Pressable style={styles.filterApplyButton} onPress={handleApplyFilters}>
                <Text style={styles.filterApplyButtonText}>APPLY</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      <Modal visible={!!openCluster} transparent animationType="slide" onRequestClose={() => setOpenCluster(null)}>
        <View style={styles.clusterBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenCluster(null)} />
          <View style={styles.clusterSheet}>
            <View style={styles.clusterHeaderRow}>
              <Text style={styles.clusterTitle}>{openCluster?.routes.length ?? 0} routes start here</Text>
              <Pressable style={styles.clusterCloseButton} onPress={() => setOpenCluster(null)}>
                <CloseIcon size={16} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.clusterList}>
              {openCluster?.routes.map((route) => (
                <Pressable
                  key={route.id}
                  style={styles.clusterRow}
                  onPress={() => {
                    setOpenCluster(null);
                    onOpenDetail(route);
                  }}
                >
                  <Text style={styles.clusterRowTitle} numberOfLines={1}>
                    {route.name}
                  </Text>
                  <Text style={styles.clusterRowMeta}>
                    {route.distanceKm.toFixed(1)} km · by {route.ownerUsername}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.cream,
    opacity: 0.14,
  },
  pin: {
    alignItems: 'flex-start',
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 8,
    backgroundColor: colors.coral,
    ...elevation('subtle'),
  },
  pinLabel: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    ...elevation('subtle'),
  },
  pinLabelText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.ink,
  },
  pinTail: {
    width: 3,
    height: 8,
    backgroundColor: colors.ink,
    marginTop: -1,
    marginLeft: 8.5,
    opacity: 0.25,
  },
  clusterPin: {
    alignItems: 'center',
  },
  clusterPinPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  clusterDot: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('smallCta'),
  },
  clusterDotText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.sheetBg,
  },
  clusterBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(34,42,42,0.45)',
    justifyContent: 'flex-end',
  },
  clusterSheet: {
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingTop: 26,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    ...elevation('sheet'),
  },
  clusterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  clusterTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  clusterCloseButton: {
    width: 34,
    height: 34,
    borderRadius: radii.icon,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  clusterList: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    gap: 10,
  },
  clusterRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    ...elevation('card'),
  },
  clusterRowTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.ink,
  },
  clusterRowMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
    marginTop: 2,
  },
  topOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    gap: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  groupRunsButton: {
    width: 36,
    height: 36,
    borderRadius: radii.icon,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notificationBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.white,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  searchRow: {
    marginBottom: 8,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radii.pill,
    paddingVertical: 11,
    paddingHorizontal: 16,
    ...elevation('subtle'),
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  searchResultsWrap: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: 8,
    maxHeight: 280,
    ...elevation('card'),
  },
  searchResultsList: {
    paddingVertical: 4,
  },
  searchEmptyText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    padding: 16,
    textAlign: 'center',
  },
  searchResultCard: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  searchResultName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  searchResultMeta: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.stone,
    marginTop: 1,
  },
  topFilterRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 16,
    ...elevation('subtle'),
  },
  filterButtonActive: {
    backgroundColor: colors.coral,
  },
  filterButtonText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.ink,
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  errorBanner: {
    backgroundColor: colors.danger,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: colors.cream,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  loadingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sheetBg,
    borderRadius: 10,
    padding: 6,
  },
  emptyState: {
    position: 'absolute',
    top: '42%',
    left: 32,
    right: 32,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyLink: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.coral,
    textAlign: 'center',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  runsStripWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 34,
  },
  runsStripContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  runCard: {
    width: 190,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 12,
    gap: 2,
    ...elevation('card'),
  },
  runCardWhenRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amber,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  runCardWhen: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.surface,
    textTransform: 'uppercase',
  },
  runCardTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.ink,
  },
  runCardRoute: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.stone,
  },
  runCardHost: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.mist,
  },
  runCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  runCardMeta: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.mist,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 40 + BOTTOM_SAFE_PAD,
    width: 52,
    height: 52,
    borderRadius: radii.fab,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('fab'),
  },
  addMenu: {
    position: 'absolute',
    right: 20,
    bottom: 110 + BOTTOM_SAFE_PAD,
    gap: 10,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...elevation('card'),
  },
  addMenuItemLocked: {
    opacity: 0.6,
  },
  addMenuItemText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(34,42,42,0.45)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: colors.sheetBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 40,
    gap: 14,
    ...elevation('sheet'),
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  filterCloseButton: {
    width: 34,
    height: 34,
    borderRadius: radii.icon,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  filterLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.stone,
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  activityFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityFilterChip: {
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  activityFilterChipActive: {
    backgroundColor: colors.coral,
  },
  activityFilterChipText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.ink,
  },
  activityFilterChipTextActive: {
    color: colors.surface,
  },
  filterInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    ...elevation('subtle'),
  },
  filterInputHalf: {
    flex: 1,
  },
  filterActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  filterClearButton: {
    flex: 1,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  filterClearButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  filterApplyButton: {
    flex: 1.4,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('primaryBtn'),
  },
  filterApplyButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.surface,
  },
});
