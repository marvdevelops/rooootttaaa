import { create } from 'zustand';
import { haversineDistance } from '../utils/distance';
import { LatLng } from '../types/route';
import { RecordingPoint } from '../types/recording';

// Live map preview only — the authoritative, full-resolution track lives in
// SQLite and is what actually gets processed/uploaded on finish. Capping
// this keeps re-renders of a long recording's polyline cheap.
const MAX_LIVE_PATH_POINTS = 5000;

interface RecordingStoreState {
  isRecording: boolean;
  isPaused: boolean;
  sessionId: string | null;
  startedAt: number | null;
  distanceMeters: number;
  elevationGainMeters: number;
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

    if (!point.isPaused && state.lastPoint && !state.lastPoint.isPaused) {
      distanceMeters += haversineDistance(
        { latitude: state.lastPoint.lat, longitude: state.lastPoint.lng },
        { latitude: point.lat, longitude: point.lng },
      );
      if (state.lastPoint.altitude !== null && point.altitude !== null && point.altitude > state.lastPoint.altitude) {
        elevationGainMeters += point.altitude - state.lastPoint.altitude;
      }
    }

    let livePath = state.livePath;
    if (!point.isPaused) {
      livePath = [...livePath, { latitude: point.lat, longitude: point.lng }];
      if (livePath.length > MAX_LIVE_PATH_POINTS) livePath = livePath.slice(livePath.length - MAX_LIVE_PATH_POINTS);
    }

    set({ distanceMeters, elevationGainMeters, lastPoint: point, pointCount: state.pointCount + 1, livePath });
  },

  setPaused: (isPaused) => set({ isPaused }),

  reset: () => set({ ...initial }),
}));

/** Non-hook accessor for the background task module, which runs outside React. */
export function updateRecordingStore(point: RecordingPoint) {
  useRecordingStore.getState().updateRecordingStore(point);
}
