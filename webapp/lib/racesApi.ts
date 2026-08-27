import { createClient } from './supabase/client';
import { RouteSegment } from './types';

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
  liveViewCount: number;
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
  live_view_count: number;
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
    liveViewCount: row.live_view_count,
  };
}

/** Fire-and-forget — increments and returns the new view count. Call once per page load, not on every Realtime update. */
export async function incrementRaceView(token: string): Promise<number | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('increment_race_view', { token });
  if (error) return null;
  return data as number;
}

export const QUICK_CHEER_MESSAGES = ["Let's go! 🔥", "Don't give up! 💪", 'You got this! 🙌', 'Congratulations! 🎉'] as const;
export type QuickCheerMessage = (typeof QUICK_CHEER_MESSAGES)[number];

/** Sends one of the fixed quick-cheer messages — the server only accepts these exact strings (see send_race_cheer's check constraint), so this is never a free-text channel to a stranger's phone. */
export async function sendRaceCheer(token: string, message: QuickCheerMessage): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc('send_race_cheer', { token, cheer_message: message });
  if (error) throw new Error(error.message);
}

/** Public lookup by an unguessable share token — never a raw table select, this is the access control. */
export async function getRaceLivePosition(token: string): Promise<RaceLivePosition | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_race_live_position', { token });
  if (error) throw new Error(error.message);
  const row = (data as RaceLivePositionRow[] | null)?.[0];
  return row ? toRaceLivePosition(row) : null;
}

export interface RaceRoute {
  routeId: string;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  segments: RouteSegment[];
}

interface RaceRouteRow {
  route_id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  segments: RouteSegment[];
}

/** Token-gated route lookup — bypasses the route's own is_public flag via a security-definer RPC, since a race's course is meant to be publicly visible to anyone with the live link regardless of how the underlying route was saved. */
export async function getRaceRoute(token: string): Promise<RaceRoute | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_race_route', { token });
  if (error) throw new Error(error.message);
  const row = (data as RaceRouteRow[] | null)?.[0];
  if (!row) return null;
  return {
    routeId: row.route_id,
    name: row.name,
    distanceKm: row.distance_km,
    elevationGainM: row.elevation_gain_m,
    segments: row.segments,
  };
}
