import { createClient } from './supabase/client';
import { createClient as createServerClient } from './supabase/server';

export interface LiveSession {
  sessionId: string;
  athleteUsername: string;
  athleteAvatarUrl: string | null;
  activityType: string;
  routeId: string | null;
  status: 'active' | 'paused' | 'ended';
  lastLat: number | null;
  lastLng: number | null;
  lastDistanceMeters: number | null;
  lastElapsedSeconds: number | null;
  lastPaceSecondsPerKm: number | null;
  lastUpdatedAt: number | null;
  startedAt: number | null;
  expiresAt: number | null;
}

interface LiveSessionRow {
  session_id: string;
  athlete_username: string;
  athlete_avatar_url: string | null;
  activity_type: string;
  route_id: string | null;
  status: LiveSession['status'];
  last_lat: number | null;
  last_lng: number | null;
  last_distance_meters: number | null;
  last_elapsed_seconds: number | null;
  last_pace_seconds_per_km: number | null;
  last_updated_at: string | null;
  started_at: string | null;
  expires_at: string | null;
}

function toLiveSession(row: LiveSessionRow): LiveSession {
  return {
    sessionId: row.session_id,
    athleteUsername: row.athlete_username,
    athleteAvatarUrl: row.athlete_avatar_url,
    activityType: row.activity_type,
    routeId: row.route_id,
    status: row.status,
    lastLat: row.last_lat,
    lastLng: row.last_lng,
    lastDistanceMeters: row.last_distance_meters,
    lastElapsedSeconds: row.last_elapsed_seconds,
    lastPaceSecondsPerKm: row.last_pace_seconds_per_km,
    lastUpdatedAt: row.last_updated_at ? new Date(row.last_updated_at).getTime() : null,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
  };
}

/** Token-gated lookup for a non-race live session. Server variant for the page/metadata. */
export async function getLiveSessionServer(token: string): Promise<LiveSession | null> {
  const supabase = await createServerClient();
  const { data } = await supabase.rpc('get_live_session', { token });
  const row = (data as LiveSessionRow[] | null)?.[0];
  return row ? toLiveSession(row) : null;
}

/** Client variant — used to re-read after a Realtime UPDATE. */
export async function getLiveSession(token: string): Promise<LiveSession | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_live_session', { token });
  if (error) throw new Error(error.message);
  const row = (data as LiveSessionRow[] | null)?.[0];
  return row ? toLiveSession(row) : null;
}

const ACTIVITY_LABELS: Record<string, string> = {
  run: 'run',
  trail_run: 'trail run',
  hike: 'hike',
  bike: 'ride',
  walk: 'walk',
  other: 'activity',
};

export function activityLabel(activityType: string): string {
  return ACTIVITY_LABELS[activityType] ?? 'activity';
}
