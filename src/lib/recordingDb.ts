import * as SQLite from 'expo-sqlite';
import { ActivityType } from '../types/route';
import { RecordingPoint, RecordingSession, RecordingStatus } from '../types/recording';

// Opened once at module level — write synchronously so no point is ever
// lost to an async gap between a GPS callback firing and it landing on disk.
const db = SQLite.openDatabaseSync('rootah_recording.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS recording_session (
    id TEXT PRIMARY KEY,
    activity_type TEXT NOT NULL,
    route_id TEXT,
    started_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS recording_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    altitude REAL,
    accuracy REAL,
    speed REAL,
    timestamp INTEGER NOT NULL,
    is_paused INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_points_session
    ON recording_points (session_id, timestamp);
`);

// Local-only id, never sent to Supabase directly (the uploaded row gets its
// own server-generated UUID) — just needs to be unique on-device.
function generateSessionId(): string {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let currentSessionId: string | null = null;

/** Set once at recording start (or on crash-recovery resume) — the background task writes points against whichever session is current. */
export function setCurrentSessionId(id: string | null) {
  currentSessionId = id;
}

export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

export function createSession(activityType: ActivityType, routeId: string | null): RecordingSession {
  const id = generateSessionId();
  const startedAt = Date.now();
  db.runSync('INSERT INTO recording_session (id, activity_type, route_id, started_at, status) VALUES (?, ?, ?, ?, ?)', [
    id,
    activityType,
    routeId,
    startedAt,
    'active',
  ]);
  setCurrentSessionId(id);
  return { id, activityType, routeId, startedAt, status: 'active' };
}

export function markSessionStatus(sessionId: string, status: RecordingStatus) {
  db.runSync('UPDATE recording_session SET status = ? WHERE id = ?', [status, sessionId]);
}

export function insertRecordingPoint(point: RecordingPoint) {
  const sessionId = getCurrentSessionId();
  if (!sessionId) return; // no active session — background task fired after finish/before start, ignore

  db.runSync(
    `INSERT INTO recording_points
      (session_id, lat, lng, altitude, accuracy, speed, timestamp, is_paused)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, point.lat, point.lng, point.altitude, point.accuracy, point.speed, point.timestamp, point.isPaused ? 1 : 0],
  );
}

/** Flags the most recent stretch of points as paused/resumed — called by the auto-pause evaluator, not per-point. */
export function markRecentPointsPaused(sessionId: string, isPaused: boolean, sinceTimestamp: number) {
  db.runSync('UPDATE recording_points SET is_paused = ? WHERE session_id = ? AND timestamp >= ?', [
    isPaused ? 1 : 0,
    sessionId,
    sinceTimestamp,
  ]);
}

interface PointRow {
  lat: number;
  lng: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
  is_paused: number;
}

export function getSessionPoints(sessionId: string, includePaused = false): RecordingPoint[] {
  const rows = db.getAllSync<PointRow>(
    includePaused
      ? 'SELECT lat, lng, altitude, accuracy, speed, timestamp, is_paused FROM recording_points WHERE session_id = ? ORDER BY timestamp ASC'
      : 'SELECT lat, lng, altitude, accuracy, speed, timestamp, is_paused FROM recording_points WHERE session_id = ? AND is_paused = 0 ORDER BY timestamp ASC',
    [sessionId],
  );
  return rows.map((r) => ({
    lat: r.lat,
    lng: r.lng,
    altitude: r.altitude,
    accuracy: r.accuracy,
    speed: r.speed,
    timestamp: r.timestamp,
    isPaused: !!r.is_paused,
  }));
}

interface SessionRow {
  id: string;
  activity_type: ActivityType;
  route_id: string | null;
  started_at: number;
  status: RecordingStatus;
}

function toSession(row: SessionRow): RecordingSession {
  return { id: row.id, activityType: row.activity_type, routeId: row.route_id, startedAt: row.started_at, status: row.status };
}

/** Called on app launch — a non-null result means the app died mid-recording and the user should be offered a resume/finish prompt. */
export function getActiveSession(): RecordingSession | null {
  const row = db.getFirstSync<SessionRow>("SELECT * FROM recording_session WHERE status = 'active' LIMIT 1");
  if (row) setCurrentSessionId(row.id);
  return row ? toSession(row) : null;
}

export function deleteSession(sessionId: string) {
  db.runSync('DELETE FROM recording_points WHERE session_id = ?', [sessionId]);
  db.runSync('DELETE FROM recording_session WHERE id = ?', [sessionId]);
  if (getCurrentSessionId() === sessionId) setCurrentSessionId(null);
}
