import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { ActivityType, LatLng, RouteSegment } from '../types/route';
import { RecordingPoint } from '../types/recording';
import { getSessionPoints } from '../lib/recordingDb';
import { annotateElevation } from './elevation';
import { haversineDistance } from './distance';
import { reverseGeocodeCity } from './geocoding';

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Ride',
  walk: 'Walk',
  other: 'Activity',
};

export interface RecordedRunSplit {
  kmNumber: number;
  splitSeconds: number;
  elevationGainMeters: number;
}

export interface RecordedRunSummary {
  id: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  avgPaceSecondsPerKm: number | null;
  avgSpeedKmh: number | null;
  path: LatLng[];
  splits: RecordedRunSplit[];
}

const TRACK_STORAGE_MAX_POINTS = 200;
// Points are sampled ~5s apart during recording — a gap larger than this
// means a paused stretch was excluded between two kept points, so it's
// capped rather than counted toward moving time.
const MAX_PLAUSIBLE_GAP_MS = 10_000;

function downsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i++) result.push(points[Math.round(i * step)]);
  return result;
}

function computeSplits(points: RecordingPoint[]): RecordedRunSplit[] {
  const splits: RecordedRunSplit[] = [];
  if (points.length < 2) return splits;

  let cumulativeMeters = 0;
  let nextTargetMeters = 1000;
  let splitStartTime = points[0].timestamp;
  let splitElevationGain = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    cumulativeMeters += haversineDistance({ latitude: prev.lat, longitude: prev.lng }, { latitude: cur.lat, longitude: cur.lng });
    if (prev.altitude !== null && cur.altitude !== null && cur.altitude > prev.altitude) {
      splitElevationGain += cur.altitude - prev.altitude;
    }

    if (cumulativeMeters >= nextTargetMeters) {
      const kmNumber = Math.round(nextTargetMeters / 1000);
      splits.push({
        kmNumber,
        splitSeconds: Math.round((cur.timestamp - splitStartTime) / 1000),
        elevationGainMeters: Math.round(splitElevationGain),
      });
      splitStartTime = cur.timestamp;
      splitElevationGain = 0;
      nextTargetMeters += 1000;
    }
  }

  return splits;
}

/** Computes final stats from the on-device SQLite log — the authoritative source, not the live in-memory store. */
export function summarizeSession(sessionId: string): RecordedRunSummary {
  const points = getSessionPoints(sessionId, false); // non-paused only

  let distanceMeters = 0;
  let elevationGainMeters = 0;
  let elevationLossMeters = 0;
  let movingTimeMs = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    distanceMeters += haversineDistance({ latitude: prev.lat, longitude: prev.lng }, { latitude: cur.lat, longitude: cur.lng });
    movingTimeMs += Math.min(cur.timestamp - prev.timestamp, MAX_PLAUSIBLE_GAP_MS);

    if (prev.altitude !== null && cur.altitude !== null) {
      const delta = cur.altitude - prev.altitude;
      if (delta > 0) elevationGainMeters += delta;
      else elevationLossMeters += -delta;
    }
  }

  const allPoints = getSessionPoints(sessionId, true);
  const elapsedTimeSeconds = allPoints.length >= 2 ? Math.round((allPoints[allPoints.length - 1].timestamp - allPoints[0].timestamp) / 1000) : 0;
  const movingTimeSeconds = Math.round(movingTimeMs / 1000);
  const distanceKm = distanceMeters / 1000;

  return {
    id: sessionId,
    distanceMeters,
    movingTimeSeconds,
    elapsedTimeSeconds,
    elevationGainMeters: Math.round(elevationGainMeters),
    elevationLossMeters: Math.round(elevationLossMeters),
    avgPaceSecondsPerKm: distanceKm > 0 ? movingTimeSeconds / distanceKm : null,
    avgSpeedKmh: movingTimeSeconds > 0 ? distanceKm / (movingTimeSeconds / 3600) : null,
    path: downsample(points, TRACK_STORAGE_MAX_POINTS).map((p) => ({ latitude: p.lat, longitude: p.lng })),
    splits: computeSplits(points),
  };
}

/**
 * Android's GPS-derived altitude is unreliable (±20-30m error) — iOS's
 * barometric altitude needs no correction. Re-queries elevation from the
 * same global-DEM service the route builder already uses (see elevation.ts)
 * for a downsampled set of the session's points, and recomputes gain/loss
 * from the corrected values. Returns null on iOS or on any failure — this
 * is a nice-to-have refinement, never worth blocking a save over.
 */
export async function correctAndroidElevation(sessionId: string): Promise<{ elevationGainMeters: number; elevationLossMeters: number } | null> {
  if (Platform.OS !== 'android') return null;

  try {
    const points = getSessionPoints(sessionId, false);
    if (points.length < 2) return null;

    const { path } = await annotateElevation(points.map((p) => ({ latitude: p.lat, longitude: p.lng })));

    let gain = 0;
    let loss = 0;
    for (let i = 1; i < path.length; i++) {
      const delta = (path[i].elevation ?? 0) - (path[i - 1].elevation ?? 0);
      if (delta > 0) gain += delta;
      else loss += -delta;
    }

    return { elevationGainMeters: Math.round(gain), elevationLossMeters: Math.round(loss) };
  } catch {
    return null;
  }
}

/** Uploads a finished, summarized recording to Supabase. Raw GPS points stay in SQLite only — never sent. */
/**
 * When a recording wasn't run against an existing saved route ("on their
 * own"), the GPS track itself becomes a new route — same as the bulk GPX
 * importer's naming approach (reverse-geocoded city + activity + distance),
 * so it shows up in My maps, not just the activity feed.
 */
async function saveRouteFromRecording(userId: string, summary: RecordedRunSummary, activityType: ActivityType): Promise<string> {
  const start = summary.path[0];
  const city = start ? await reverseGeocodeCity(start) : null;
  const distanceKm = summary.distanceMeters / 1000;
  const name = `${city ? `${city} ` : ''}${ACTIVITY_LABEL[activityType]} — ${distanceKm.toFixed(1)}km`;

  const waypoints = [
    { id: 'rec-start', ...summary.path[0] },
    { id: 'rec-end', ...summary.path[summary.path.length - 1] },
  ];
  const segments: RouteSegment[] = [
    { fromId: 'rec-start', toId: 'rec-end', path: summary.path, distanceMeters: summary.distanceMeters },
  ];

  const { data, error } = await supabase
    .from('routes')
    .insert({
      owner_id: userId,
      name,
      description: `Recorded with Rootah on ${new Date().toLocaleDateString()}.`,
      activity_type: activityType,
      waypoints,
      segments,
      notes: [],
      distance_km: distanceKm,
      elevation_gain_m: summary.elevationGainMeters,
      elevation_profile: summary.path,
      city,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to save route from recording.');
  return data.id as string;
}

export async function uploadRecording(
  summary: RecordedRunSummary,
  activityType: ActivityType,
  routeId: string | null,
  startedAt: number,
): Promise<{ recordedRunId: string; routeId: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('You must be signed in to save a run.');

  const finalRouteId = routeId ?? (await saveRouteFromRecording(userId, summary, activityType));

  const { data, error } = await supabase
    .from('recorded_runs')
    .insert({
      user_id: userId,
      route_id: finalRouteId,
      activity_type: activityType,
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
      moving_time_seconds: summary.movingTimeSeconds,
      elapsed_time_seconds: summary.elapsedTimeSeconds,
      distance_meters: summary.distanceMeters,
      elevation_gain_meters: summary.elevationGainMeters,
      elevation_loss_meters: summary.elevationLossMeters,
      avg_pace_seconds_per_km: summary.avgPaceSecondsPerKm,
      avg_speed_kmh: summary.avgSpeedKmh,
      track_geojson: { type: 'LineString', coordinates: summary.path.map((p) => [p.longitude, p.latitude]) },
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to save run.');

  if (summary.splits.length > 0) {
    await supabase.from('run_splits').insert(
      summary.splits.map((s) => ({
        run_id: data.id,
        km_number: s.kmNumber,
        split_seconds: s.splitSeconds,
        elevation_gain_meters: s.elevationGainMeters,
      })),
    );
  }

  return { recordedRunId: data.id as string, routeId: finalRouteId };
}

/** run_splits cascades via its FK — no separate delete needed there. */
export async function deleteRecordedRun(runId: string): Promise<void> {
  const { error } = await supabase.from('recorded_runs').delete().eq('id', runId);
  if (error) throw new Error(error.message);
}

export interface RecordedRunFeedItem {
  id: string;
  activityType: ActivityType;
  routeId: string | null;
  distanceMeters: number;
  movingTimeSeconds: number;
  finishedAt: number;
}

/** For the profile activity feed — GPS-recorded runs, separate from manually-logged route completions. */
export async function listMyRecordedRuns(userId: string, limit = 30): Promise<RecordedRunFeedItem[]> {
  const { data, error } = await supabase
    .from('recorded_runs')
    .select('id, activity_type, route_id, distance_meters, moving_time_seconds, finished_at')
    .eq('user_id', userId)
    .order('finished_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    activityType: row.activity_type as ActivityType,
    routeId: row.route_id as string | null,
    distanceMeters: row.distance_meters as number,
    movingTimeSeconds: row.moving_time_seconds as number,
    finishedAt: new Date(row.finished_at as string).getTime(),
  }));
}
