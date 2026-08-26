import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { evaluateAutoPause } from '../utils/autoPause';
import { getCurrentSessionId, insertRecordingPoint, markRecentPointsPaused } from '../lib/recordingDb';
import { updateRecordingStore, useRecordingStore } from '../stores/recordingStore';

export const LOCATION_TASK = 'rootah-recording';

// Defined at module level, outside any component — imported once from the
// app root (App.tsx) so it's registered before any navigation renders.
// expo-task-manager requires this file to run its top-level code on every
// app launch (including background re-launches by iOS), not just when the
// recording screen is mounted.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[recording] task error:', error.message);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  const sessionId = getCurrentSessionId();
  if (!sessionId) return;

  for (const loc of locations) {
    // Reject low-accuracy points (GPS drift in tunnels / urban canyons)
    if (loc.coords.accuracy !== null && loc.coords.accuracy > 25) continue;

    // Reject impossible speed jumps — GPS satellite glitch.
    // 8 m/s ≈ 29 km/h (generous for a runner); 30 m/s covers fast cyclists.
    if (loc.coords.speed !== null && loc.coords.speed > 30) continue;

    const pauseTransition = evaluateAutoPause(loc.coords.speed);
    if (pauseTransition) {
      useRecordingStore.getState().setPaused(pauseTransition === 'pause');
      // Retroactively flag the low-speed stretch that led to this pause —
      // the confirm window means those points were already written as
      // not-paused before we crossed the threshold.
      if (pauseTransition === 'pause') markRecentPointsPaused(sessionId, true, loc.timestamp - 8000);
    }

    const point = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      altitude: loc.coords.altitude ?? null,
      accuracy: loc.coords.accuracy ?? null,
      speed: loc.coords.speed ?? null,
      timestamp: loc.timestamp,
      isPaused: useRecordingStore.getState().isPaused,
    };

    // Write to SQLite immediately — this is the zero-data-loss guarantee.
    insertRecordingPoint(point);

    // Update in-memory store so the UI (if visible) stays live.
    updateRecordingStore(point);
  }
});
