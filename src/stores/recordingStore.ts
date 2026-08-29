import { create } from 'zustand';
import { haversineDistance } from '../utils/distance';
import { LatLng } from '../types/route';
import { RecordingPoint } from '../types/recording';

// Live map preview only — the authoritative, full-resolution track lives in
// SQLite and is what actually gets processed/uploaded on finish. Capping
// this keeps re-renders of a long recording's polyline cheap.
const MAX_LIVE_PATH_POINTS = 5000;

// Raw GPS/barometric altitude jitters several metres between fixes. The live
// gain counter uses simple hysteresis — only bank a climb once you're this
// far above the last locked-in altitude, and re-baseline on an equivalent
// drop — so idle wiggle doesn't inflate the number. The final saved figure
// (recordingUpload.summarizeSession) recomputes this properly from the
// smoothed full-resolution track.
const LIVE_ELEVATION_HYSTERESIS_METERS = 4;

interface RecordingStoreState {
  isRecording: boolean;
  isPaused: boolean;
  sessionId: string | null;
  startedAt: number | null;
  distanceMeters: number;
  elevationGainMeters: number;
  /** Last altitude the live gain counter locked in — its hysteresis baseline. */
  committedAltitude: number | null;
  lastPoint: RecordingPoint | null;
  pointCount: number;
  /** Non-paused points only, for drawing the live track on the map. */
  livePath: LatLng[];

  startSession: (sessionId: string) => void;
  updateRecordingStore: (point: RecordingPoint) => void;
  setPaused: (isPaused: boolean) => void;
  reset: () => void;
}

const initial = {
  isRecording: false,
  isPaused: false,
  sessionId: null as string | null,
  startedAt: null as number | null,
  distanceMeters: 0,
  elevationGainMeters: 0,
  committedAltitude: null as number | null,
  lastPoint: null as RecordingPoint | null,
  pointCount: 0,
  livePath: [] as LatLng[],
};

/** Live stats the recording UI reads — updated straight from the background location task, independent of whether SQLite has flushed yet. */
export const useRecordingStore = create<RecordingStoreState>((set, get) => ({
  ...initial,

  startSession: (sessionId) => set({ ...initial, isRecording: true, sessionId, startedAt: Date.now() }),

  updateRecordingStore: (point) => {
    const state = get();
    if (!state.isRecording) return;

    let distanceMeters = state.distanceMeters;
    let elevationGainMeters = state.elevationGainMeters;
    let committedAltitude = state.committedAltitude;

    if (!point.isPaused && state.lastPoint && !state.lastPoint.isPaused) {
      distanceMeters += haversineDistance(
        { latitude: state.lastPoint.lat, longitude: state.lastPoint.lng },
        { latitude: point.lat, longitude: point.lng },
      );
      if (point.altitude !== null) {
        if (committedAltitude === null) {
          committedAltitude = point.altitude;
        } else if (point.altitude - committedAltitude >= LIVE_ELEVATION_HYSTERESIS_METERS) {
          elevationGainMeters += point.altitude - committedAltitude;
          committedAltitude = point.altitude;
        } else if (committedAltitude - point.altitude >= LIVE_ELEVATION_HYSTERESIS_METERS) {
          committedAltitude = point.altitude;
        }
      }
    }

    let livePath = state.livePath;
    if (!point.isPaused) {
      livePath = [...livePath, { latitude: point.lat, longitude: point.lng }];
      if (livePath.length > MAX_LIVE_PATH_POINTS) livePath = livePath.slice(livePath.length - MAX_LIVE_PATH_POINTS);
    }

    set({ distanceMeters, elevationGainMeters, committedAltitude, lastPoint: point, pointCount: state.pointCount + 1, livePath });
  },

  setPaused: (isPaused) => set({ isPaused }),

  reset: () => set({ ...initial }),
}));

/** Non-hook accessor for the background task module, which runs outside React. */
export function updateRecordingStore(point: RecordingPoint) {
  useRecordingStore.getState().updateRecordingStore(point);
}
