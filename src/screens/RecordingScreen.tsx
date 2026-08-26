import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import AutoPauseBanner from '../components/AutoPauseBanner';
import DeviationBanner from '../components/DeviationBanner';
import { CloseIcon, LockIcon, PauseIcon, PlayIcon, ShareIcon } from '../components/icons';
import Logo from '../components/Logo';
import RecordingMap from '../components/RecordingMap';
import RecordingStats from '../components/RecordingStats';
import RouteAheadPanel from '../components/RouteAheadPanel';
import { useRecording, LocationPermissionError } from '../hooks/useRecording';
import { useRecordingStore } from '../stores/recordingStore';
import { colors, elevation, fonts, radii } from '../theme/theme';
import { ActivityType, RouteSegment } from '../types/route';
import { RecordingSession } from '../types/recording';
import { buildRouteProgressIndex, findNextClimb, getRouteProgress, UpcomingClimb } from '../utils/routeProgress';
import { getRaceShareToken, startRaceRun, updateRaceLivePosition } from '../utils/racesApi';
import { haversineDistance } from '../utils/distance';

const LIVE_TRACKING_BASE_URL = 'https://app.rootah.com/live';

const RACE_LIVE_UPDATE_MS = 5_000;

const DEVIATION_TRIGGER_METERS = 60;
const DEVIATION_CLEAR_METERS = 40;
const DEVIATION_CONFIRM_COUNT = 3;
const ROUTE_AHEAD_UPDATE_MS = 30_000;
const COUNTDOWN_TICK_MS = 900;
/** How far off a planned route someone can be and still start a route-aware recording — loose enough to cover parking/meet-point drift, tight enough that "record this route" from across town still gets blocked. */
const ROUTE_START_MAX_DISTANCE_METERS = 150;
/** Rolling window for the on-screen "current pace" stat — short enough to react within seconds of a pace change (not "wait for a full km"), long enough that per-point GPS noise doesn't make the number jump around. */
const CURRENT_PACE_WINDOW_MS = 20_000;
const CURRENT_PACE_MIN_WINDOW_SECONDS = 4;
const CURRENT_PACE_MIN_WINDOW_METERS = 5;

type Phase = 'ready' | 'countdown' | 'recording';

interface Props {
  activityType: ActivityType;
  routeId?: string;
  /** Route-aware mode — pass the saved route's segments to enable deviation alerts and the what's-ahead panel. */
  plannedSegments?: RouteSegment[];
  /** Set when the store/background task were already re-attached to a crash-recovered session (see App.tsx) — skips calling startRecording() again, which would otherwise create a second, duplicate session. */
  alreadyStarted?: boolean;
  /** Set when recording against a race — issues the live-tracking share token on start, and throttle-broadcasts position every 30s for the public spectator page. */
  raceRsvpId?: string;
  onFinish: (session: RecordingSession) => void;
  onDiscard: () => void;
}

export default function RecordingScreen({ activityType, routeId, plannedSegments, alreadyStarted, raceRsvpId, onFinish, onDiscard }: Props) {
  useKeepAwake();
  const { startRecording, pauseRecording, resumeRecording, finishRecording, discardSession } = useRecording();

  const isPaused = useRecordingStore((s) => s.isPaused);
  const sessionId = useRecordingStore((s) => s.sessionId);
  const startedAt = useRecordingStore((s) => s.startedAt);
  const distanceMeters = useRecordingStore((s) => s.distanceMeters);
  const elevationGainMeters = useRecordingStore((s) => s.elevationGainMeters);
  const livePath = useRecordingStore((s) => s.livePath);
  const lastPoint = useRecordingStore((s) => s.lastPoint);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [locked, setLocked] = useState(false);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isOffRoute, setIsOffRoute] = useState(false);
  const [remainingMeters, setRemainingMeters] = useState<number | null>(null);
  const [nextClimb, setNextClimb] = useState<UpcomingClimb | null>(null);
  const [phase, setPhase] = useState<Phase>(alreadyStarted ? 'recording' : 'ready');
  const [countdownLabel, setCountdownLabel] = useState('3');
  const [checkingProximity, setCheckingProximity] = useState(false);
  const [liveShareToken, setLiveShareToken] = useState<string | null>(null);

  const routeIndex = useMemo(() => (plannedSegments ? buildRouteProgressIndex(plannedSegments) : null), [plannedSegments]);
  const plannedPath = useMemo(() => plannedSegments?.flatMap((s) => s.path), [plannedSegments]);
  const offRouteStreak = useRef(0);
  // Last-matched flat path index — passed back into getRouteProgress as a
  // continuity hint so a u-turn or repeated loop doesn't snap onto the
  // wrong pass (see routeProgress.ts). Shared between the deviation effect
  // and finish-detection effect below since both track the same moving
  // position over time.
  const lastMatchedIndexRef = useRef<number | null>(null);
  const lastAheadUpdate = useRef(0);

  // Seed continuity at the route's start rather than leaving it unset — on
  // a looping route the start and finish coordinates are the same (or
  // nearly so), so an unseeded first GPS fix falls back to the global
  // nearest-point search, which can ambiguously snap onto the route's LAST
  // point instead of its first at the exact moment the runner is standing
  // on the start line. That's what made "finished" fire immediately on
  // starting a loop race. Anchoring here means even the very first fix
  // uses the windowed search, which correctly prefers the nearby start
  // over the far-away-in-path-order end.
  useEffect(() => {
    lastMatchedIndexRef.current = routeIndex ? 0 : null;
  }, [routeIndex]);

  // A crash-recovered race session skips beginRecording entirely (phase
  // starts at 'recording' via alreadyStarted) — pick up its already-issued
  // token instead of never having one to share.
  useEffect(() => {
    if (raceRsvpId && alreadyStarted) {
      getRaceShareToken(raceRsvpId).then(setLiveShareToken).catch(() => {});
    }
  }, [raceRsvpId, alreadyStarted]);

  const beginRecording = useCallback(() => {
    setStarting(true);
    startRecording(activityType, routeId)
      .then(() => {
        setPhase('recording');
        if (raceRsvpId) {
          startRaceRun(raceRsvpId)
            .then(setLiveShareToken)
            .catch(() => {}); // non-fatal — live tracking just won't have a token yet
        }
      })
      .catch((e) => {
        const message =
          e instanceof LocationPermissionError
            ? e.reason === 'foreground-denied'
              ? 'Rootah needs location access to record.'
              : "To track your run with the screen off, Rootah needs 'Always' location access."
            : e instanceof Error
              ? e.message
              : 'Failed to start recording.';
        Alert.alert('Cannot start recording', message, [{ text: 'OK', onPress: onDiscard }]);
      })
      .finally(() => setStarting(false));
  }, [activityType, routeId, startRecording, onDiscard, raceRsvpId]);

  const startCountdown = useCallback(() => {
    setPhase('countdown');
    const steps = ['3', '2', '1', 'GO'];
    let i = 0;
    setCountdownLabel(steps[0]);
    const timer = setInterval(() => {
      i += 1;
      if (i >= steps.length) {
        clearInterval(timer);
        beginRecording();
        return;
      }
      setCountdownLabel(steps[i]);
    }, COUNTDOWN_TICK_MS);
  }, [beginRecording]);

  // Explicit user input required before anything starts — tapping "Start"
  // on the ready screen kicks off a 3-2-1 countdown, and GPS recording only
  // actually begins once it reaches zero, not the instant the screen mounts.
  // For route-aware recordings, first confirm the runner is actually near
  // the route — otherwise "record this route" from across town would start
  // a session that immediately fires the deviation banner.
  const handleTapStart = useCallback(async () => {
    if (!routeIndex || !plannedSegments) {
      startCountdown();
      return;
    }

    setCheckingProximity(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Rootah needs location access to check you\'re on this route before recording.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const progress = getRouteProgress(routeIndex, plannedSegments, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (progress && progress.deviationMeters > ROUTE_START_MAX_DISTANCE_METERS) {
        Alert.alert(
          "You're not on this route",
          `Get within ${ROUTE_START_MAX_DISTANCE_METERS}m of the route to start recording, or record a free-form activity instead.`,
        );
        return;
      }
      startCountdown();
    } catch {
      Alert.alert('Error', "Couldn't check your location. Make sure location services are on and try again.");
    } finally {
      setCheckingProximity(false);
    }
  }, [routeIndex, plannedSegments, startCountdown]);

  // Moving time (excludes auto-paused stretches) — elapsedSeconds is raw
  // wall-clock and inflates pace after any pause (or a slow initial GPS
  // fix before startedAt's first point), which is what made the live-
  // tracking pace broadcast (and, before this, the on-screen pace stat —
  // RecordingStats used to compute its own pace from elapsedSeconds) read
  // much slower than actual pace. movingSeconds is state (not just the
  // ref) so the on-screen stat actually re-renders each tick.
  const movingSecondsRef = useRef(0);
  const [movingSeconds, setMovingSeconds] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      if (!useRecordingStore.getState().isPaused) {
        movingSecondsRef.current += 1;
        setMovingSeconds(movingSecondsRef.current);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  // On-screen "current pace" — a short rolling window of recent GPS
  // points, not a lifetime average since start. An average dragged down by
  // the whole run so far reads as "not displaying" for a while (needs
  // ~50m/a minute of history before it settles) and doesn't reflect a
  // pace change until it's diluted across everything run so far; this
  // updates within a few seconds of actual pace changing, same as a
  // running watch's "current pace" field.
  const recentPointsRef = useRef<{ t: number; lat: number; lng: number }[]>([]);
  const [displayPaceSecondsPerKm, setDisplayPaceSecondsPerKm] = useState<number | null>(null);
  useEffect(() => {
    if (!lastPoint || lastPoint.isPaused) return;
    const now = lastPoint.timestamp;
    recentPointsRef.current.push({ t: now, lat: lastPoint.lat, lng: lastPoint.lng });
    recentPointsRef.current = recentPointsRef.current.filter((p) => now - p.t <= CURRENT_PACE_WINDOW_MS);

    const pts = recentPointsRef.current;
    if (pts.length < 2) {
      setDisplayPaceSecondsPerKm(null);
      return;
    }

    let windowMeters = 0;
    for (let i = 1; i < pts.length; i++) {
      windowMeters += haversineDistance({ latitude: pts[i - 1].lat, longitude: pts[i - 1].lng }, { latitude: pts[i].lat, longitude: pts[i].lng });
    }
    const windowSeconds = (pts[pts.length - 1].t - pts[0].t) / 1000;

    if (windowSeconds < CURRENT_PACE_MIN_WINDOW_SECONDS || windowMeters < CURRENT_PACE_MIN_WINDOW_METERS) {
      setDisplayPaceSecondsPerKm(null);
      return;
    }
    setDisplayPaceSecondsPerKm(windowSeconds / (windowMeters / 1000));
  }, [lastPoint]);

  // Route-aware mode: on each incoming (non-paused) GPS point, check
  // deviation from the planned route. Remaining distance and the next-climb
  // scan are heavier, so those only refresh every 30s per the spec.
  useEffect(() => {
    if (!routeIndex || !plannedSegments || !lastPoint || lastPoint.isPaused) return;

    const progress = getRouteProgress(routeIndex, plannedSegments, { latitude: lastPoint.lat, longitude: lastPoint.lng }, lastMatchedIndexRef.current);
    if (!progress) return;
    lastMatchedIndexRef.current = progress.nearestPointIndex;

    if (progress.deviationMeters > DEVIATION_TRIGGER_METERS) {
      offRouteStreak.current += 1;
      if (offRouteStreak.current === DEVIATION_CONFIRM_COUNT) {
        setIsOffRoute(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    } else {
      offRouteStreak.current = 0;
      if (progress.deviationMeters < DEVIATION_CLEAR_METERS) setIsOffRoute(false);
    }

    const now = Date.now();
    if (now - lastAheadUpdate.current >= ROUTE_AHEAD_UPDATE_MS || lastAheadUpdate.current === 0) {
      lastAheadUpdate.current = now;
      setRemainingMeters(progress.remainingMeters);
      setNextClimb(findNextClimb(routeIndex, progress.nearestPointIndex));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPoint]);

  // Race live-tracking broadcast — same 30s throttle as the route-ahead
  // panel above, kept independent since it applies to every race run
  // regardless of whether route-aware mode is active.
  const lastRaceUpdate = useRef(0);
  useEffect(() => {
    if (!raceRsvpId || !lastPoint || lastPoint.isPaused) return;
    const now = Date.now();
    if (now - lastRaceUpdate.current < RACE_LIVE_UPDATE_MS && lastRaceUpdate.current !== 0) return;
    lastRaceUpdate.current = now;

    const paceSecondsPerKm = distanceMeters > 50 ? movingSecondsRef.current / (distanceMeters / 1000) : null;
    updateRaceLivePosition(raceRsvpId, lastPoint.lat, lastPoint.lng, distanceMeters, paceSecondsPerKm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPoint]);

  const handleShareLiveLink = useCallback(() => {
    if (!liveShareToken) return;
    const url = `${LIVE_TRACKING_BASE_URL}/${liveShareToken}`;
    Share.share({ message: `Follow me live on Rootah: ${url}`, url }).catch(() => {});
  }, [liveShareToken]);

  const handleManualPauseToggle = useCallback(() => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  }, [isPaused, pauseRecording, resumeRecording]);

  const performFinish = useCallback(async () => {
    if (!sessionId) return;
    setFinishing(true);
    const finishedSessionId = sessionId;
    const startedAtValue = startedAt ?? Date.now();
    await finishRecording(finishedSessionId);
    onFinish({ id: finishedSessionId, activityType, routeId: routeId ?? null, startedAt: startedAtValue, status: 'finished' });
  }, [sessionId, startedAt, finishRecording, onFinish, activityType, routeId]);

  const handleFinish = useCallback(() => {
    if (!sessionId) return;
    Alert.alert('Finish recording?', 'This will end and save your run.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Finish', style: 'default', onPress: performFinish },
    ]);
  }, [sessionId, performFinish]);

  // Race finish detection: near the route's final point, and far enough
  // along that this isn't just an early loop back near the start. Prompted,
  // not auto-stopped — GPS noise near a finish chute is common enough that
  // a silent auto-stop would be worse than asking.
  const hasPromptedFinish = useRef(false);
  useEffect(() => {
    if (!raceRsvpId || !routeIndex || !plannedSegments || !lastPoint || lastPoint.isPaused || hasPromptedFinish.current) return;

    const progress = getRouteProgress(routeIndex, plannedSegments, { latitude: lastPoint.lat, longitude: lastPoint.lng }, lastMatchedIndexRef.current);
    if (!progress) return;

    const traveledFraction = routeIndex.totalMeters > 0 ? progress.traveledMeters / routeIndex.totalMeters : 0;
    if (progress.remainingMeters <= 30 && traveledFraction >= 0.9) {
      hasPromptedFinish.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Looks like you've finished!", 'End your race?', [
        { text: 'Not yet', style: 'cancel', onPress: () => { hasPromptedFinish.current = false; } },
        { text: 'Finish', style: 'default', onPress: performFinish },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPoint]);

  const handleDiscard = useCallback(() => {
    Alert.alert('Discard this run?', 'All recorded data will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          if (sessionId) await discardSession(sessionId);
          onDiscard();
        },
      },
    ]);
  }, [sessionId, discardSession, onDiscard]);

  if (phase !== 'recording') {
    return (
      <View style={styles.container}>
        <RecordingMap livePath={livePath} plannedPath={plannedPath} />
        <View style={styles.readyOverlay}>
          <Pressable style={styles.readyCloseButton} onPress={onDiscard}>
            <CloseIcon size={16} />
          </Pressable>

          {phase === 'ready' ? (
            <>
              <Text style={styles.readyTitle}>Ready when you are</Text>
              <Pressable style={styles.startButton} onPress={handleTapStart} disabled={starting || checkingProximity}>
                {checkingProximity ? <ActivityIndicator color={colors.white} /> : <Text style={styles.startButtonText}>START</Text>}
              </Pressable>
            </>
          ) : (
            <Text style={styles.countdownText}>{countdownLabel}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RecordingMap livePath={livePath} plannedPath={plannedPath} />

      {locked && (
        <Pressable style={styles.lockOverlay} onPress={() => setLocked(false)}>
          <View style={styles.lockPill}>
            <LockIcon size={16} color={colors.surface} />
            <Text style={styles.lockText}>Locked · Tap to unlock</Text>
          </View>
        </Pressable>
      )}

      <View style={styles.topOverlay} pointerEvents={locked ? 'none' : 'auto'}>
        <View style={styles.brandRow}>
          <Logo size={36} />
          <View style={styles.topButtons}>
            {raceRsvpId && liveShareToken && (
              <Pressable style={styles.iconButton} onPress={handleShareLiveLink}>
                <ShareIcon size={16} />
              </Pressable>
            )}
            <Pressable style={styles.iconButton} onPress={() => setLocked(true)}>
              <LockIcon size={16} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={handleDiscard}>
              <CloseIcon size={16} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.bottomOverlay} pointerEvents={locked ? 'none' : 'auto'}>
        {routeIndex && remainingMeters !== null && <RouteAheadPanel remainingMeters={remainingMeters} nextClimb={nextClimb} />}

        {isOffRoute && <DeviationBanner onPress={() => setIsOffRoute(false)} />}
        {isPaused && <AutoPauseBanner onResume={resumeRecording} />}

        <RecordingStats
          elapsedSeconds={elapsedSeconds}
          distanceMeters={distanceMeters}
          elevationGainMeters={elevationGainMeters}
          paceSecondsPerKm={displayPaceSecondsPerKm}
        />

        <View style={styles.controlsRow}>
          <Pressable style={[styles.controlButton, styles.pauseButton]} onPress={handleManualPauseToggle} disabled={starting || finishing}>
            {isPaused ? <PlayIcon size={22} color={colors.ink} /> : <PauseIcon size={22} color={colors.ink} />}
          </Pressable>
          <Pressable style={[styles.controlButton, styles.finishButton]} onPress={handleFinish} disabled={starting || finishing || !sessionId}>
            <Text style={styles.finishButtonText}>{finishing ? 'Saving…' : 'FINISH'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  topOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
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
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radii.icon,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 40,
    gap: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    height: 60,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('primaryBtn'),
  },
  pauseButton: {
    width: 60,
    backgroundColor: colors.surface,
  },
  finishButton: {
    flex: 1,
    backgroundColor: colors.coral,
  },
  finishButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    letterSpacing: 0.4,
  },
  readyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(26,22,20,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  readyCloseButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: radii.icon,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  readyTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.surface,
  },
  startButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('primaryBtn'),
  },
  startButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.white,
    letterSpacing: 0.6,
  },
  countdownText: {
    fontFamily: fonts.extraBold,
    fontSize: 96,
    color: colors.surface,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 60,
  },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(26,22,20,0.85)',
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  lockText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.surface,
  },
});
