import { supabase } from '../lib/supabase';
import { ActivityType } from '../types/route';

/**
 * Live-location sharing for any recorded activity (races have their own path
 * through racesApi). A session holds an unguessable token that is the entire
 * access control for the public `app.rootah.com/live/[token]` page; position
 * is overwritten in place on the row and spectators subscribe via Realtime.
 */

function generateShareToken(): string {
  // Unguessable, URL-safe. Length matters more than readability — this token
  // is the only thing gating the public page.
  const bytes = new Uint8Array(24);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface LiveSession {
  id: string;
  shareToken: string;
}

/** Opens a live session for the current user and returns its id + share token. */
export async function startLiveSession(
  activityType: ActivityType,
  routeId?: string | null,
): Promise<LiveSession> {
  const { data: auth } = await supabase.auth.getUser();
  const athleteId = auth.user?.id;
  if (!athleteId) throw new Error('Sign in to share your live location.');

  const shareToken = generateShareToken();
  const { data, error } = await supabase
    .from('live_sessions')
    .insert({
      athlete_id: athleteId,
      share_token: shareToken,
      route_id: routeId ?? null,
      activity_type: activityType,
      status: 'active',
    })
    // .select().single() is load-bearing — a silently-blocked insert (0 rows,
    // no error) would otherwise hand back a token that was never saved.
    .select('id, share_token')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to start live sharing.');
  return { id: data.id as string, shareToken: data.share_token as string };
}

/** Overwrites the session's denormalised position. Fire-and-forget from the recording loop. */
export async function updateLivePosition(
  sessionId: string,
  lat: number,
  lng: number,
  distanceMeters: number,
  elapsedSeconds: number,
  paceSecondsPerKm: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('live_sessions')
    .update({
      last_lat: lat,
      last_lng: lng,
      last_distance_meters: distanceMeters,
      last_elapsed_seconds: Math.round(elapsedSeconds),
      last_pace_seconds_per_km: paceSecondsPerKm,
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (error) throw new Error(error.message);
}

/** Keeps the session's activity type / followed route current when the runner
 * tweaks them after sharing the link but before starting — same token, so any
 * link already sent keeps working. */
export async function updateLiveSessionMeta(
  sessionId: string,
  activityType: ActivityType,
  routeId?: string | null,
): Promise<void> {
  await supabase
    .from('live_sessions')
    .update({ activity_type: activityType, route_id: routeId ?? null })
    .eq('id', sessionId);
}

/** Ends the session — the public page stops resolving the token from here on. */
export async function endLiveSession(sessionId: string): Promise<void> {
  await supabase
    .from('live_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId);
}
