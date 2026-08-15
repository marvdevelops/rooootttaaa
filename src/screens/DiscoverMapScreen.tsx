import { Camera, MapView, MarkerView, StyleURL } from '@rnmapbox/maps';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { CalendarIcon, CloseIcon, FilterIcon, ImportIcon, LockIcon, PlusIcon, SearchIcon, UserIcon, UsersIcon } from '../components/icons';
import Logo from '../components/Logo';
import { useUserTier } from '../hooks/useUserTier';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { CloudRoute, GroupRun, LatLng } from '../types/route';
import { clusterRoutesByStart, RouteCluster } from '../utils/clusterRoutes';
import { haversineDistance } from '../utils/distance';
import { reverseGeocodeCountryBounds } from '../utils/geocoding';
import { listRunsNearLocation } from '../utils/groupRunsApi';
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

// Cluster taps step through these fixed stops — roughly 1500km (the whole
// Philippines), 500km, 100km, 10km, then all the way to street level —
// instead of a fixed zoom delta, so a tap always lands on a predictable,
// meaningful view. Routes keep spreading apart as this goes on; the list
// fallback only kicks in once we're at the very last stop and routes are
// still grouped, meaning they truly share a start point and no further
// zoom will separate them.
const CLUSTER_ZOOM_TIERS = [4.5, 6, 8, 12, 14, 16, 18] as const;

interface Props {
  onOpenDetail: (route: CloudRoute) => void;
  onOpenProfile: () => void;
  onOpenGroupRuns: () => void;
  onOpenGroupRun: (groupRunId: string) => void;
  onOpenClubs: () => void;
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

// A single center+zoom can't guarantee the whole archipelago fits on
// screen — the Philippines is tall and narrow (~1850km N-S, much less
// E-W), so a zoom level tuned for one aspect ratio crops the other. A real
// bounding box, fit with fitBounds, always frames the whole country
// regardless of device screen size/orientation.
const PHILIPPINES_NE: [number, number] = [126.6, 21.2];
const PHILIPPINES_SW: [number, number] = [116.7, 4.5];

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

  // Zoom in on tap so nearby-but-distinct routes spread into their own pins,
  // the way most map apps handle clusters — jump straight to the next fixed
  // tier rather than an arbitrary delta, and only fall back to a list once
  // we're already at the last tier (routes truly overlapping).
  const handleClusterPress = useCallback(
    (cluster: RouteCluster) => {
      const nextTier = CLUSTER_ZOOM_TIERS.find((tier) => tier > zoom + 0.1);
      if (!nextTier) {
        setOpenCluster(cluster);
        return;
      }
      // Pins re-cluster and fade in immediately below, independent of this
      // animation, so easing the camera here no longer brings back the
      // "pins lag behind the zoom" problem — it can just look good.
      cameraRef.current?.setCamera({
        centerCoordinate: [cluster.center.longitude, cluster.center.latitude],
        zoomLevel: nextTier,
        animationDuration: 350,
        animationMode: 'easeTo',
      });
      // Re-cluster immediately instead of waiting for onMapIdle — that
      // native event only fires once the camera+tiles settle, which would
      // otherwise lag behind the animation above.
      setZoom(nextTier);
    },
    [zoom],
  );

  const activeFilterCount = useMemo(
    () => [appliedFilters.minDistanceKm, appliedFilters.maxDistanceKm, appliedFilters.maxElevationGainM, appliedFilters.city].filter(
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
    });
    setShowFilters(false);
  }, [minDistance, maxDistance, maxElevation, city]);

  const handleClearFilters = useCallback(() => {
    setMinDistance('');
    setMaxDistance('');
    setMaxElevation('');
    setCity('');
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
                        <Text style={styles.pinLabelText}>{route.distanceKm.toFixed(1)} km</Text>
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
          <Logo size={36} />
          <View style={styles.topButtons}>
            <Pressable style={styles.groupRunsButton} onPress={onOpenGroupRuns}>
              <CalendarIcon size={16} />
            </Pressable>
            <Pressable style={styles.groupRunsButton} onPress={onOpenClubs}>
              <UsersIcon size={16} />
            </Pressable>
            <Pressable style={styles.profileButton} onPress={onOpenProfile}>
              <UserIcon size={18} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <SearchIcon size={14} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search routes..."
              placeholderTextColor={colors.mutedLight}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <CloseIcon size={14} color={colors.muted} />
              </Pressable>
            )}
          </View>
        </View>

        {searchQuery.trim().length > 0 && (
          <View style={styles.searchResultsWrap}>
            {searchLoading ? (
              <ActivityIndicator color={colors.rust} style={{ marginTop: 20 }} />
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

        <Pressable style={styles.filterButton} onPress={() => setShowFilters(true)}>
          <FilterIcon size={14} />
          <Text style={styles.filterButtonText}>
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </Text>
        </Pressable>

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
              {tier === 'free' && <LockIcon size={14} color={colors.muted} />}
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
              <Text style={styles.filterLabel}>DISTANCE (KM)</Text>
              <View style={styles.filterRow}>
                <TextInput
                  value={minDistance}
                  onChangeText={setMinDistance}
                  placeholder="Min"
                  placeholderTextColor={colors.mutedLight}
                  keyboardType="numeric"
                  style={[styles.filterInput, styles.filterInputHalf]}
                />
                <TextInput
                  value={maxDistance}
                  onChangeText={setMaxDistance}
                  placeholder="Max"
                  placeholderTextColor={colors.mutedLight}
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
                placeholderTextColor={colors.mutedLight}
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
                placeholderTextColor={colors.mutedLight}
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
    backgroundColor: colors.rust,
    borderWidth: 3,
    borderColor: colors.ink,
  },
  pinLabel: {
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  pinLabelText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.ink,
  },
  pinTail: {
    width: 3,
    height: 8,
    backgroundColor: colors.ink,
    marginTop: -1,
    marginLeft: 8.5,
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
    backgroundColor: colors.rust,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterDotText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.sand,
  },
  clusterBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(34,42,42,0.45)',
    justifyContent: 'flex-end',
  },
  clusterSheet: {
    backgroundColor: colors.sand,
    borderTopWidth: 4,
    borderColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingTop: 26,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  clusterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 14,
  },
  clusterTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
  },
  clusterCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterList: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    gap: 10,
  },
  clusterRow: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    ...brutalShadow(2),
  },
  clusterRowTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.ink,
  },
  clusterRowMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
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
  topButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  groupRunsButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    marginBottom: 8,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    ...brutalShadow(3),
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.ink,
    height: '100%',
  },
  searchResultsWrap: {
    backgroundColor: colors.white,
    ...brutalShadow(3),
    borderRadius: 14,
    marginBottom: 8,
    maxHeight: 280,
  },
  searchResultsList: {
    paddingVertical: 4,
  },
  searchEmptyText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    padding: 16,
    textAlign: 'center',
  },
  searchResultCard: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.sand,
  },
  searchResultName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  searchResultMeta: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sand,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...brutalShadow(3),
  },
  filterButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
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
  loadingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sand,
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
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyLink: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.rust,
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
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 10,
    gap: 2,
    ...brutalShadow(3),
  },
  runCardWhenRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amber,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  runCardWhen: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.ink,
  },
  runCardTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.ink,
  },
  runCardRoute: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.muted,
  },
  runCardHost: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.mutedLight,
  },
  runCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  runCardMeta: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: colors.mutedLight,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 40,
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(4),
  },
  addMenu: {
    position: 'absolute',
    right: 20,
    bottom: 110,
    gap: 10,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.sand,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...brutalShadow(3),
  },
  addMenuItemLocked: {
    opacity: 0.6,
  },
  addMenuItemText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(34,42,42,0.45)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: colors.sand,
    borderTopWidth: 4,
    borderColor: colors.ink,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 40,
    gap: 14,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterTitle: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
  },
  filterCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.sand,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
  },
  filterInput: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.ink,
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
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterClearButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  filterApplyButton: {
    flex: 1.4,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.rust,
    alignItems: 'center',
    justifyContent: 'center',
    ...brutalShadow(4),
  },
  filterApplyButtonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.sand,
  },
});
