import * as Location from 'expo-location';
import { useCallback } from 'react';
import { LOCATION_TASK } from '../tasks/locationTask';
import { createSession, getActiveSession, markSessionStatus, deleteSession as dbDeleteSession, setCurrentSessionId } from '../lib/recordingDb';
import { resetAutoPauseState, startAutoPauseTracking, stopAutoPauseTracking } from '../utils/autoPause';
import { track } from '../lib/analytics';
import { useRecordingStore } from '../stores/recordingStore';
import { ActivityType } from '../types/route';
import { RecordingSession } from '../types/recording';

export class LocationPermissionError extends Error {
  constructor(public reason: 'foreground-denied' | 'background-denied') {
    super(reason);
  }
}

async function startLocationUpdates() {
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5000, // every 5 seconds
    distanceInterval: 8, // OR every 8 meters — whichever fires first
    foregroundService: {
      notificationTitle: 'Rootah · Recording',
      notificationBody: '0:00  ·  0.00 km',
      notificationColor: '#E8593A',
    },
    showsBackgroundLocationIndicator: true, // iOS blue bar — required, do not remove
    pausesUpdatesAutomatically: false, // prevent iOS throttling on long runs
    activityType: Location.ActivityType.Fitness, // iOS priority hint for workout apps
  });
}

/** Start/pause/resume/finish a recording, plus the permission flow and crash-recovery resume. */
export function useRecording() {
  const startSession = useRecordingStore((s) => s.startSession);
  const setPaused = useRecordingStore((s) => s.setPaused);
  const reset = useRecordingStore((s) => s.reset);

  const startRecording = useCallback(
    async (activityType: ActivityType, routeId?: string): Promise<RecordingSession> => {
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      if (fg !== 'granted') throw new LocationPermissionError('foreground-denied');

      const { status: bg } = await Location.requestBackgroundPermissionsAsync();
      if (bg !== 'granted') throw new LocationPermissionError('background-denied');

      const session = createSession(activityType, routeId ?? null);
      track('recording_started', { activity_type: activityType, on_route: !!routeId });
      startSession(session.id);
      resetAutoPauseState();
      startAutoPauseTracking();
      await startLocationUpdates();

      return session;
    },
    [startSession],
  );

  /** Manual pause via the UI button — independent of (and layered on top of) automatic movement-based pausing. */
  const pauseRecording = useCallback(() => {
    setPaused(true);
  }, [setPaused]);

  const resumeRecording = useCallback(() => {
    setPaused(false);
  }, [setPaused]);

  const finishRecording = useCallback(async (sessionId: string) => {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
      if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    } catch {
      // Task was never started or already stopped — nothing to clean up.
    }
    stopAutoPauseTracking();
    markSessionStatus(sessionId, 'finished');
    setCurrentSessionId(null);
    reset();
    // Post-processing and upload happen in RecordingSummaryScreen.
  }, [reset]);

  const discardSession = useCallback(
    async (sessionId: string) => {
      try {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
        if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      } catch {
        // already stopped
      }
      stopAutoPauseTracking();
      dbDeleteSession(sessionId);
      reset();
    },
    [reset],
  );

  /** Call on app launch — returns a session if the app died mid-recording, so a resume/finish prompt can be shown. Never silently discards. */
  const checkForActiveSession = useCallback((): RecordingSession | null => {
    return getActiveSession();
  }, []);

  /** Re-attaches the background task + store to a session found by checkForActiveSession. */
  const resumeActiveSession = useCallback(
    async (session: RecordingSession) => {
      setCurrentSessionId(session.id);
      startSession(session.id);
      resetAutoPauseState();
      startAutoPauseTracking();
      await startLocationUpdates();
    },
    [startSession],
  );

  return {
    startRecording,
    pauseRecording,
    resumeRecording,
    finishRecording,
    discardSession,
    checkForActiveSession,
    resumeActiveSession,
  };
}
