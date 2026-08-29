import { supabase } from '../lib/supabase';
import { ActivityType } from '../types/route';
import { secureRandomHex } from './secureToken';

/**
 * Live-location sharing for any recorded activity (races have their own path
 * through racesApi). A session holds an unguessable token that is the entire
 * access control for the public `app.rootah.com/live/[token]` page; position
 * is overwritten in place on the row and spectators subscribe via Realtime.
 */

function generateShareToken(): string {
  // Unguessable, URL-safe. This token is the only thing gating the public
  // page, so it must come from a CSPRNG, not Math.random.
  return secureRandomHex(24);
}

const LIVE_BASE_URL = 'https://app.rootah.com/live';

/** Public spectator URL. The username segment is cosmetic — the token is still
 * the whole access control — but it makes a shared link recognisable
 * ("app.rootah.com/live/marvin/…"). The web route also accepts the plain
 * `/live/<token>` form so older links keep working. */
export function liveTrackingUrl(shareToken: string, username?: string | null): string {
  return username
    ? `${LIVE_BASE_URL}/${encodeURIComponent(username)}/${shareToken}`
    : `${LIVE_BASE_URL}/${shareToken}`;
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

/** How many people have opened the runner's live link. Best-effort; 0 on any error. */
export async function getLiveSessionViewCount(sessionId: string): Promise<number> {
  const { data } = await supabase.from('live_sessions').select('view_count').eq('id', sessionId).maybeSingle();
  return (data?.view_count as number | undefined) ?? 0;
}

/** Ends the session — the public page stops resolving the token from here on. */
export async function endLiveSession(sessionId: string): Promise<void> {
  await supabase
    .from('live_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', sessionId);
}
