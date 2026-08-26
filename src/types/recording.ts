import { ActivityType } from './route';

export interface RecordingPoint {
  lat: number;
  lng: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
  isPaused: boolean;
}

export type RecordingStatus = 'active' | 'finished' | 'uploaded';

export interface RecordingSession {
  id: string;
  activityType: ActivityType;
  routeId: string | null;
  startedAt: number;
  status: RecordingStatus;
}
