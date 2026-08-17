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
import { File } from 'expo-file-system';
import type { Feature, LineString } from 'geojson';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BackIcon, ShareIcon } from '../components/icons';
import FlybyStatCard from '../components/FlybyStatCard';
import { brutalShadow, colors, fonts } from '../theme/theme';
import { CloudRoute } from '../types/route';
import { appendFrozenFrames, captureFramesForDuration, cleanupFramesDir, makeFramesDir, stitchFramesToVideo } from '../utils/flybyCapture';
import { animateFlybyCamera, sampleFlybyPoints } from '../utils/flybyCamera';
import { deleteFlybyTiles, preloadFlybyTiles } from '../utils/flybyPreload';
import { defaultStyleForRoute, FLYBY_STYLES, FlybyStyleKey } from '../utils/flybyStyles';

interface Props {
  route: CloudRoute;
  onClose: () => void;
}

type Phase = 'preview' | 'preloading' | 'rendering' | 'ready' | 'error';

const DEM_SOURCE_ID = 'flyby-terrain-dem';
const ANIMATION_DURATION_MS = 14_000;
const STAT_CARD_HOLD_MS = 1500;

export default function FlybyScreen({ route, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('preview');
  const [selectedStyle, setSelectedStyle] = useState<FlybyStyleKey>(defaultStyleForRoute(route));
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Preparing map…');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mapViewRef = useRef<React.ComponentRef<typeof View>>(null);
  const cameraRef = useRef<React.ComponentRef<typeof Camera>>(null);
  const statCardRef = useRef<View>(null);
  const cancelledRef = useRef(false);
  const videoPlayer = useVideoPlayer(null, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!videoUri) return;
    videoPlayer.replace(videoUri);
    videoPlayer.play();
  }, [videoUri, videoPlayer]);

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

      setPhase('rendering');
      setProgress(0);
      setProgressLabel('Recording flyby…');

      const framesDir = makeFramesDir(route.id);
      const points = sampleFlybyPoints(fullPath, 100);

      const animationPromise = animateFlybyCamera({
        points,
        cameraRef,
        durationMs: ANIMATION_DURATION_MS,
        isCancelled: () => cancelledRef.current,
      });
      const capturePromise = captureFramesForDuration(mapViewRef, framesDir, ANIMATION_DURATION_MS, (fraction) =>
        setProgress(fraction * 0.8),
      );

      const [, frameCount] = await Promise.all([animationPromise, capturePromise]);
      if (cancelledRef.current) return;

      setProgressLabel('Adding summary card…');
      const totalFrames = await appendFrozenFrames(statCardRef, framesDir, frameCount, STAT_CARD_HOLD_MS);
      void totalFrames;

      setProgressLabel('Encoding video…');
      setProgress(0.9);
      const outputFile = new File(framesDir.parentDirectory, `flyby_${route.id}_${Date.now()}.mp4`);
      await stitchFramesToVideo(framesDir, outputFile);
      cleanupFramesDir(framesDir);
      await deleteFlybyTiles(route.id);

      if (cancelledRef.current) return;
      setVideoUri(outputFile.uri);
      setProgress(1);
      setPhase('ready');
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Something went wrong generating the video.');
      setPhase('error');
    }
  }, [route.id, route.waypoints, fullPath, style.url]);

  const handleShare = useCallback(async () => {
    if (!videoUri) return;
    const message = [
      `${route.name} 🗺`,
      `${route.distanceKm.toFixed(1)}km · ↑${Math.round(route.elevationGainM)}m`,
      `Plan it on Rootah → rootah.com`,
    ].join('\n');
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(videoUri, { mimeType: 'video/mp4' });
      } else {
        await Share.share({ url: videoUri, message, title: route.name });
      }
    } catch {
      // User cancelling the share sheet throws — not an error worth surfacing.
    }
  }, [videoUri, route]);

  const handleSave = useCallback(async () => {
    if (!videoUri) return;
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Enable photo library access in Settings to save this video.');
      return;
    }
    try {
      await MediaLibrary.saveToLibraryAsync(videoUri);
      Alert.alert('Saved', 'Flyby video saved to your camera roll.');
    } catch {
      Alert.alert('Error', 'Could not save the video.');
    }
  }, [videoUri]);

  const handleClose = () => {
    cancelledRef.current = true;
    onClose();
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapViewRef as never}
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
      </MapView>

      {/* Rendered off-screen but laid out, so it can be captured for the stat-card freeze frames. */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={statCardRef} collapsable={false}>
          <FlybyStatCard route={route} />
        </View>
      </View>

      <Pressable style={styles.closeButton} onPress={handleClose}>
        <BackIcon color={colors.sand} />
      </Pressable>

      {phase === 'preview' && (
        <View style={styles.previewOverlay}>
          <View style={styles.styleRow}>
            {(Object.keys(FLYBY_STYLES) as FlybyStyleKey[]).map((key) => {
              const active = selectedStyle === key;
              return (
                <Pressable
                  key={key}
                  style={[styles.styleChip, active && styles.styleChipActive]}
                  onPress={() => setSelectedStyle(key)}
                >
                  <Text style={styles.styleIcon}>{FLYBY_STYLES[key].icon}</Text>
                  <Text style={[styles.styleLabel, active && styles.styleLabelActive]}>{FLYBY_STYLES[key].label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>CREATE FLYBY VIDEO</Text>
          </Pressable>
        </View>
      )}

      {(phase === 'preloading' || phase === 'rendering') && (
        <View style={styles.progressOverlay}>
          <ActivityIndicator color={colors.sand} size="large" />
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

      {phase === 'ready' && videoUri && (
        <View style={styles.readyOverlay}>
          <VideoView player={videoPlayer} style={styles.videoPreview} contentFit="cover" nativeControls={false} />
          <View style={styles.readyActions}>
            <Pressable style={styles.startButton} onPress={handleShare}>
              <ShareIcon size={16} color={colors.sand} />
              <Text style={styles.startButtonText}>SHARE VIDEO</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={handleSave}>
              <Text style={styles.secondaryButtonText}>Save to camera roll</Text>
            </Pressable>
            <Pressable onPress={() => setPhase('preview')} hitSlop={8}>
              <Text style={styles.regenerateText}>Regenerate</Text>
            </Pressable>
          </View>
        </View>
      )}
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
    top: -4000,
    left: 0,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 40,
    paddingHorizontal: 20,
    gap: 14,
  },
  styleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 2,
    borderColor: colors.sand,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  styleChipActive: {
    backgroundColor: colors.rust,
  },
  styleIcon: {
    fontSize: 14,
  },
  styleLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.sand,
  },
  styleLabelActive: {
    color: colors.sand,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.rust,
    ...brutalShadow(4),
  },
  startButtonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: colors.sand,
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
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.sand,
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
    backgroundColor: colors.rust,
  },
  readyOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.ink,
  },
  videoPreview: {
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
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.sand,
  },
  regenerateText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.mutedLight,
    textAlign: 'center',
  },
});
