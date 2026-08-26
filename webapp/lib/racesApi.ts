import { createClient } from './supabase/client';

export interface RaceLivePosition {
  rsvpId: string;
  raceTitle: string;
  routeId: string;
  athleteUsername: string;
  athleteAvatarUrl: string | null;
  status: 'pending' | 'approved' | 'declined';
  lastLat: number | null;
  lastLng: number | null;
  lastDistanceMeters: number | null;
  lastPaceSecondsPerKm: number | null;
  lastUpdatedAt: number | null;
  startedAt: number | null;
  finishTimeSeconds: number | null;
}

interface RaceLivePositionRow {
  rsvp_id: string;
  race_title: string;
  route_id: string;
  athlete_username: string;
  athlete_avatar_url: string | null;
  status: 'pending' | 'approved' | 'declined';
  last_lat: number | null;
  last_lng: number | null;
  last_distance_meters: number | null;
  last_pace_seconds_per_km: number | null;
  last_updated_at: string | null;
  started_at: string | null;
  finish_time_seconds: number | null;
}

function toRaceLivePosition(row: RaceLivePositionRow): RaceLivePosition {
  return {
    rsvpId: row.rsvp_id,
    raceTitle: row.race_title,
    routeId: row.route_id,
    athleteUsername: row.athlete_username,
    athleteAvatarUrl: row.athlete_avatar_url,
    status: row.status,
    lastLat: row.last_lat,
    lastLng: row.last_lng,
    lastDistanceMeters: row.last_distance_meters,
    lastPaceSecondsPerKm: row.last_pace_seconds_per_km,
    lastUpdatedAt: row.last_updated_at ? new Date(row.last_updated_at).getTime() : null,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    finishTimeSeconds: row.finish_time_seconds,
  };
}

/** Public lookup by an unguessable share token — never a raw table select, this is the access control. */
export async function getRaceLivePosition(token: string): Promise<RaceLivePosition | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_race_live_position', { token });
  if (error) throw new Error(error.message);
  const row = (data as RaceLivePositionRow[] | null)?.[0];
  return row ? toRaceLivePosition(row) : null;
}
