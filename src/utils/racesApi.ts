import { supabase } from '../lib/supabase';
import { RaceCategorySummary, RaceDetails, RaceEventSummary, RaceRsvp } from '../types/route';
import { secureRandomHex } from './secureToken';

interface RaceDetailsRow {
  group_run_id: string;
  race_date: string;
  race_timezone: string;
  organizer_logo_url: string | null;
  organizer_name: string | null;
  event_banner_url: string | null;
  event_logo_url: string | null;
  brand_primary_color: string;
  brand_accent_color: string;
  event_group_id: string | null;
  event_title: string | null;
}

function toRaceDetails(row: RaceDetailsRow): RaceDetails {
  return {
    groupRunId: row.group_run_id,
    raceDate: row.race_date,
    raceTimezone: row.race_timezone,
    organizerLogoUrl: row.organizer_logo_url,
    organizerName: row.organizer_name,
    eventBannerUrl: row.event_banner_url,
    eventLogoUrl: row.event_logo_url,
    brandPrimaryColor: row.brand_primary_color,
    brandAccentColor: row.brand_accent_color,
    eventGroupId: row.event_group_id,
    eventTitle: row.event_title,
  };
}

export async function getRaceDetails(groupRunId: string): Promise<RaceDetails | null> {
  const { data, error } = await supabase.from('race_details').select('*').eq('group_run_id', groupRunId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRaceDetails(data as RaceDetailsRow) : null;
}

interface RaceCategoryRow {
  group_run_id: string;
  group_runs: { title: string; scheduled_at: string; routes: { distance_km: number } | { distance_km: number }[] | null } | { title: string; scheduled_at: string; routes: { distance_km: number } | { distance_km: number }[] | null }[] | null;
}

/** Every distance category sharing this event, including the one you're currently viewing — for the "pick your distance" list. */
export async function getRaceCategories(eventGroupId: string): Promise<RaceCategorySummary[]> {
  const { data, error } = await supabase
    .from('race_details')
    .select('group_run_id, group_runs(title, scheduled_at, routes(distance_km))')
    .eq('event_group_id', eventGroupId);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RaceCategoryRow[])
    .map((row) => {
      const run = Array.isArray(row.group_runs) ? row.group_runs[0] : row.group_runs;
      if (!run) return null;
      const route = Array.isArray(run.routes) ? run.routes[0] : run.routes;
      return {
        groupRunId: row.group_run_id,
        title: run.title,
        routeDistanceKm: route?.distance_km ?? 0,
        scheduledAt: new Date(run.scheduled_at).getTime(),
      };
    })
    .filter((c): c is RaceCategorySummary => c !== null)
    .sort((a, b) => a.routeDistanceKm - b.routeDistanceKm);
}

/** True once "today" has reached race_date in the race's own timezone — not the device's. */
export function isRaceDayUnlocked(race: RaceDetails): boolean {
  const todayInRaceTz = new Intl.DateTimeFormat('en-CA', { timeZone: race.raceTimezone }).format(new Date()); // en-CA gives YYYY-MM-DD
  return todayInRaceTz >= race.raceDate;
}

interface RaceRsvpRow {
  id: string;
  group_run_id: string;
  status: RaceRsvp['status'];
  started_at: string | null;
  finished_at: string | null;
  finish_time_seconds: number | null;
  recorded_run_id: string | null;
  share_card_storage_path: string | null;
  live_share_token: string | null;
}

function toRaceRsvp(row: RaceRsvpRow): RaceRsvp {
  return {
    id: row.id,
    groupRunId: row.group_run_id,
    status: row.status,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    finishedAt: row.finished_at ? new Date(row.finished_at).getTime() : null,
    finishTimeSeconds: row.finish_time_seconds,
    recordedRunId: row.recorded_run_id,
    shareCardStoragePath: row.share_card_storage_path,
    liveShareToken: row.live_share_token,
  };
}

/** The current user's own RSVP on a race, including race-run state. Null if they haven't requested to join. */
export async function getMyRaceRsvp(groupRunId: string): Promise<RaceRsvp | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('group_run_rsvps')
    .select('id, group_run_id, status, started_at, finished_at, finish_time_seconds, recorded_run_id, share_card_storage_path, live_share_token')
    .eq('group_run_id', groupRunId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toRaceRsvp(data as RaceRsvpRow) : null;
}

function generateShareToken(): string {
  // Unguessable, URL-safe — this is the entire access control for the
  // public /live/[token] page, so it must come from a CSPRNG.
  return secureRandomHex(24);
}

/** Looks up an already-issued share token — used when a recording screen re-attaches to a crash-recovered race session instead of starting fresh. */
export async function getRaceShareToken(rsvpId: string): Promise<string | null> {
  const { data, error } = await supabase.from('group_run_rsvps').select('live_share_token').eq('id', rsvpId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.live_share_token as string | null) ?? null;
}

/** Returns the RSVP's live-tracking token, issuing one now if it doesn't have one yet — lets a joined runner grab and share their link ahead of race day, without marking the run as started (unlike startRaceRun). */
export async function ensureLiveShareToken(rsvpId: string): Promise<string> {
  const existing = await getRaceShareToken(rsvpId);
  if (existing) return existing;

  const token = generateShareToken();
  // .select().single() is load-bearing here, not decoration — without it, a
  // write RLS silently blocks (0 rows affected, no error) reports success
  // anyway, handing out a token that was never actually saved. That exact
  // gap caused every non-host participant's live link to 404 until the
  // "participants can update their own rsvp tracking fields" policy
  // (0050 migration) was added — this makes the same class of bug loud
  // instead of silent if it ever regresses.
  const { error, data } = await supabase.from('group_run_rsvps').update({ live_share_token: token }).eq('id', rsvpId).select('id').single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to issue your live tracking link.');
  return token;
}

/** Marks a race RSVP as started and issues its live-tracking share token (reusing one already shared ahead of time via ensureLiveShareToken, if any — the link a runner shared before race day should keep working during the run). */
export async function startRaceRun(rsvpId: string): Promise<string> {
  const token = await ensureLiveShareToken(rsvpId);
  const { error, data } = await supabase
    .from('group_run_rsvps')
    .update({ started_at: new Date().toISOString() })
    .eq('id', rsvpId)
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to start this race run.');
  return token;
}

export async function finishRaceRun(rsvpId: string, finishTimeSeconds: number, recordedRunId: string): Promise<void> {
  const { error, data } = await supabase
    .from('group_run_rsvps')
    .update({ finished_at: new Date().toISOString(), finish_time_seconds: finishTimeSeconds, recorded_run_id: recordedRunId })
    .eq('id', rsvpId)
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to record your finish.');
}

export async function saveShareCardPath(rsvpId: string, storagePath: string): Promise<void> {
  const { error, data } = await supabase
    .from('group_run_rsvps')
    .update({ share_card_storage_path: storagePath })
    .eq('id', rsvpId)
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to save your share card.');
}

/** Throttled live-position broadcast — called from the background location task, not per GPS point. */
export async function updateRaceLivePosition(
  rsvpId: string,
  lat: number,
  lng: number,
  distanceMeters: number,
  paceSecondsPerKm: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('group_run_rsvps')
    .update({
      last_lat: lat,
      last_lng: lng,
      last_distance_meters: distanceMeters,
      last_pace_seconds_per_km: paceSecondsPerKm,
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', rsvpId);
  if (error) console.warn('[race] live position update failed:', error.message);
}
