import {
  Camera,
  LineLayer,
  MapView,
  RasterDemSource,
  ShapeSource,
  SkyLayer,
  Terrain,
} from '@rnmapbox/maps';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { Feature, LineString } from 'geojson';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { BackIcon, MapStyleIcon, SatelliteIcon, ShareIcon, TerrainIcon } from '../components/icons';
import FlybyRunnerMarker, { FlybyRunnerMarkerHandle } from '../components/FlybyRunnerMarker';
import FlybyStatCard from '../components/FlybyStatCard';
import { colors, elevation, fonts, radii, spacing } from '../theme/theme';
import { CloudRoute } from '../types/route';
import { animateFlybyCamera, sampleFlybyPoints } from '../utils/flybyCamera';
import { captureStatCardImage } from '../utils/flybyCapture';
import { deleteFlybyTiles, preloadFlybyTiles } from '../utils/flybyPreload';
import { defaultStyleForRoute, FLYBY_STYLES, FlybyStyleKey } from '../utils/flybyStyles';

interface Props {
  route: CloudRoute;
  onClose: () => void;
}

type Phase = 'preview' | 'preloading' | 'playing' | 'ready' | 'error';

const DEM_SOURCE_ID = 'flyby-terrain-dem';
const ANIMATION_DURATION_MS = 22_000;

const STYLE_ICON: Record<FlybyStyleKey, (props: { size?: number; color?: string }) => React.JSX.Element> = {
  satellite: SatelliteIcon,
  outdoors: TerrainIcon,
  streets: MapStyleIcon,
};

export default function FlybyScreen({ route, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('preview');
  const [selectedStyle, setSelectedStyle] = useState<FlybyStyleKey>(defaultStyleForRoute(route));
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Preparing map…');
  const [statCardUri, setStatCardUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cameraRef = useRef<React.ComponentRef<typeof Camera>>(null);
  const statCardRef = useRef<View>(null);
  const runnerMarkerRef = useRef<FlybyRunnerMarkerHandle>(null);
  const cancelledRef = useRef(false);
  const mapImageReadyRef = useRef(false);
  const mapImageWaitersRef = useRef<(() => void)[]>([]);

  const handleMapImageSettled = useCallback(() => {
    mapImageReadyRef.current = true;
    mapImageWaitersRef.current.forEach((fn) => fn());
    mapImageWaitersRef.current = [];
  }, []);

  const waitForMapImage = useCallback((timeoutMs = 3000) => {
    if (mapImageReadyRef.current) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      mapImageWaitersRef.current.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      deleteFlybyTiles(route.id).catch(() => {});
    };
  }, [route.id]);

  const fullPath = useMemo(() => {
    if (route.elevationProfile.length >= 2) return route.elevationProfile;
    if (route.waypoints.length === 0) return [];
    const points: typeof route.elevationProfile = [route.waypoints[0]];
    for (const segment of route.segments) points.push(...segment.path.slice(1));
    return points;
  }, [route.elevationProfile, route.waypoints, route.segments]);

  const routeGeoJson: Feature<LineString> = useMemo(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: fullPath.map((p) => [p.longitude, p.latitude]) },
    }),
    [fullPath],
  );

  const style = FLYBY_STYLES[selectedStyle];

  const handleStart = useCallback(async () => {
    cancelledRef.current = false;
    setPhase('preloading');
    setProgress(0);
    setProgressLabel('Preparing map…');

    try {
      await preloadFlybyTiles(route.id, route.waypoints, style.url, (pct) => setProgress(pct / 100));
      if (cancelledRef.current) return;

      setPhase('playing');
      const points = sampleFlybyPoints(fullPath, 100);
      runnerMarkerRef.current?.updatePosition([points[0].longitude, points[0].latitude]);
      await animateFlybyCamera({
        points,
        cameraRef,
        durationMs: ANIMATION_DURATION_MS,
        isCancelled: () => cancelledRef.current,
        onFrame: (coordinate) => {
          runnerMarkerRef.current?.updatePosition(coordinate);
        },
      });
      if (cancelledRef.current) return;

      await waitForMapImage();
      if (cancelledRef.current) return;

      const uri = await captureStatCardImage(statCardRef);
      await deleteFlybyTiles(route.id);
      if (cancelledRef.current) return;
      setStatCardUri(uri);
      setPhase('ready');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Something went wrong.');
      setPhase('error');
    }
  }, [route.id, route.waypoints, fullPath, style.url, waitForMapImage]);

  const handleShare = useCallback(async () => {
    if (!statCardUri) return;
    const message = [`${route.name} 🗺`, `${route.distanceKm.toFixed(1)}km · ↑${Math.round(route.elevationGainM)}m`, `Plan it on Rootah → rootah.com`].join(
      '\n',
    );
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(statCardUri, { mimeType: 'image/jpeg' });
      } else {
        await Share.share({ url: statCardUri, message, title: route.name });
      }
    } catch {
      // User cancelling the share sheet throws — not worth surfacing.
    }
  }, [statCardUri, route]);

  const handleSave = useCallback(async () => {
    if (!statCardUri) return;
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Enable photo library access in Settings to save this image.');
      return;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(statCardUri);
      Alert.alert('Saved', 'Saved to your camera roll.');
    } catch {
      Alert.alert('Error', 'Could not save the image.');
    }
  }, [statCardUri]);

  const handleClose = () => {
    cancelledRef.current = true;
    onClose();
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleURL={style.url}
        scaleBarEnabled={false}
        compassEnabled={false}
        attributionEnabled={false}
        logoEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
      >
        <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: [route.waypoints[0]?.longitude ?? 0, route.waypoints[0]?.latitude ?? 0], zoomLevel: 12 }} />

        <RasterDemSource id={DEM_SOURCE_ID} url="mapbox://mapbox.mapbox-terrain-dem-v1" tileSize={512} />
        <Terrain sourceID={DEM_SOURCE_ID} style={{ exaggeration: style.terrainExaggeration }} />
        <SkyLayer id="flyby-sky" style={{ skyType: 'atmosphere', skyAtmosphereSun: [0, 0] }} />

        {fullPath.length >= 2 && (
          <ShapeSource id="flyby-route-source" shape={routeGeoJson}>
            <LineLayer
              id="flyby-route-casing"
              style={{ lineColor: style.routeCasingColor, lineWidth: style.routeWidth + 3, lineCap: 'round', lineJoin: 'round' }}
            />
            <LineLayer
              id="flyby-route-line"
              style={{ lineColor: style.routeColor, lineWidth: style.routeWidth, lineCap: 'round', lineJoin: 'round' }}
            />
          </ShapeSource>
        )}

        <FlybyRunnerMarker ref={runnerMarkerRef} />
      </MapView>

      {/* Rendered off-screen (opacity 0, not offset far outside the window) but laid out, so it can be captured as the shareable summary image. */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={statCardRef} collapsable={false}>
          <FlybyStatCard route={route} fullPath={fullPath} onMapImageSettled={handleMapImageSettled} />
        </View>
      </View>

      {phase === 'preview' && (
        <View style={styles.previewOverlay}>
          <View style={styles.styleRow}>
            {(Object.keys(FLYBY_STYLES) as FlybyStyleKey[]).map((key) => {
              const active = selectedStyle === key;
              const StyleIcon = STYLE_ICON[key];
              return (
                <Pressable
                  key={key}
                  style={[styles.styleChip, active && styles.styleChipActive]}
                  onPress={() => setSelectedStyle(key)}
                >
                  <StyleIcon size={14} color={colors.white} />
                  <Text style={[styles.styleLabel, active && styles.styleLabelActive]}>{FLYBY_STYLES[key].label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>PLAY FLYBY</Text>
          </Pressable>
        </View>
      )}

      {phase === 'preloading' && (
        <View style={styles.progressOverlay}>
          <ActivityIndicator color={colors.white} size="large" />
          <Text style={styles.progressLabel}>{progressLabel}</Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.progressOverlay}>
          <Text style={styles.progressLabel}>{errorMessage}</Text>
          <Pressable style={styles.startButton} onPress={() => setPhase('preview')}>
            <Text style={styles.startButtonText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      )}

      {phase === 'ready' && statCardUri && (
        <View style={styles.readyOverlay}>
          <Image source={{ uri: statCardUri }} style={styles.readyImage} resizeMode="contain" />
          <View style={styles.readyActions}>
            <Pressable style={styles.startButton} onPress={handleShare}>
              <ShareIcon size={16} color={colors.white} />
              <Text style={styles.startButtonText}>SHARE SUMMARY CARD</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleSave}>
              <Text style={styles.secondaryButtonText}>Save to camera roll</Text>
            </Pressable>
            <Pressable onPress={() => setPhase('preview')} hitSlop={8}>
              <Text style={styles.regenerateText}>Replay</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Rendered last (after the phase overlays above) so it always sits on top and stays tappable/visible in every phase, including 'ready'. */}
      <Pressable style={styles.closeButton} onPress={handleClose} hitSlop={8}>
        <BackIcon color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  map: {
    flex: 1,
  },
  offscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: radii.icon,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  previewOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    paddingHorizontal: spacing.xl,
    gap: spacing.base,
  },
  styleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radii.pill,
    paddingVertical: 9,
    paddingHorizontal: 16,
    ...elevation('subtle'),
  },
  styleChipActive: {
    backgroundColor: colors.coral,
  },
  styleLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.white,
  },
  styleLabelActive: {
    color: colors.white,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    ...elevation('primaryBtn'),
  },
  startButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.white,
    letterSpacing: 0.3,
  },
  progressOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 16,
    paddingHorizontal: 40,
  },
  progressLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.white,
    textAlign: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.coral,
  },
  readyOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.ink,
  },
  readyImage: {
    flex: 1,
  },
  readyActions: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 40,
    gap: 10,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  secondaryButtonText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  regenerateText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.white,
    textAlign: 'center',
  },
});
