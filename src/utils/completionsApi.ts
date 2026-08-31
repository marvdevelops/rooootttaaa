import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { RouteCompletion, RouteCompletionActivityItem } from '../types/route';

interface CompletionRow {
  id: string;
  user_id: string;
  route_id: string;
  group_run_id: string | null;
  completed_at: string;
  duration_seconds: number | null;
  notes: string | null;
  source: RouteCompletion['source'];
}

function toCompletion(row: CompletionRow): RouteCompletion {
  return {
    id: row.id,
    userId: row.user_id,
    routeId: row.route_id,
    groupRunId: row.group_run_id,
    completedAt: new Date(row.completed_at).getTime(),
    durationSeconds: row.duration_seconds,
    notes: row.notes,
    source: row.source,
  };
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Today's completion for this route, in the same UTC-day bucket the DB's unique index uses — null if not logged today. */
export async function getTodayCompletion(routeId: string): Promise<RouteCompletion | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const todayUtc = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('route_completions')
    .select('*')
    .eq('user_id', userId)
    .eq('route_id', routeId)
    .gte('completed_at', `${todayUtc}T00:00:00Z`)
    .lt('completed_at', `${todayUtc}T23:59:59.999Z`)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toCompletion(data as CompletionRow) : null;
}

/** Whether the current user has ever logged a completion for this route — gates the photo-upload entry points to people who've actually run it. */
export async function hasCompletedRoute(routeId: string): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;

  const { count, error } = await supabase
    .from('route_completions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('route_id', routeId);

  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * Logs a completion for right now. If one already exists today (race with
 * another tap, or a stale UI), the DB's unique index rejects the insert —
 * that's treated as success and the existing row is returned instead of
 * surfacing an error, matching the "always feels like it worked" design goal.
 */
export async function logRouteCompletion(
  routeId: string,
  opts: { groupRunId?: string; source?: RouteCompletion['source']; completedAt?: Date; durationSeconds?: number } = {},
): Promise<RouteCompletion> {
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to log a run.');

  const { data, error } = await supabase
    .from('route_completions')
    .insert({
      user_id: userId,
      route_id: routeId,
      group_run_id: opts.groupRunId ?? null,
      source: opts.source ?? 'manual',
      completed_at: (opts.completedAt ?? new Date()).toISOString(),
      duration_seconds: opts.durationSeconds ?? null,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      const existing = await getTodayCompletion(routeId);
      if (existing) {
        // Same-day completion already existed (e.g. a manual "I ran it" tap
        // earlier) — a GPS recording finishing afterward should still
        // attach its actual duration rather than silently losing it.
        if (opts.durationSeconds != null && existing.durationSeconds == null) {
          await updateCompletion(existing.id, { durationSeconds: opts.durationSeconds });
          return { ...existing, durationSeconds: opts.durationSeconds };
        }
        return existing;
      }
    }
    throw new Error(error.message);
  }
  track('completion_logged', {
    route_id: routeId,
    source: opts.source ?? 'manual',
    has_duration: opts.durationSeconds != null,
  });
  return toCompletion(data as CompletionRow);
}

export async function updateCompletion(
  id: string,
  updates: { durationSeconds?: number | null; notes?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from('route_completions')
    .update({ duration_seconds: updates.durationSeconds, notes: updates.notes })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

interface ParticipantCompletionRow {
  id: string;
  completed_at: string;
  duration_seconds: number | null;
  profiles: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
}

export interface CompletionParticipant {
  id: string;
  username: string;
  avatarUrl: string | null;
  completedAt: number;
  durationSeconds: number | null;
}

/** Everyone who's logged this route, most recent first — for the "ran by N people" expandable list. */
export async function listRouteCompletions(routeId: string, limit = 30): Promise<CompletionParticipant[]> {
  const { data, error } = await supabase
    .from('route_completions')
    .select('id, completed_at, duration_seconds, profiles:user_id(username, avatar_url)')
    .eq('route_id', routeId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ParticipantCompletionRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      username: profile?.username ?? 'unknown',
      avatarUrl: profile?.avatar_url ?? null,
      completedAt: new Date(row.completed_at).getTime(),
      durationSeconds: row.duration_seconds,
    };
  });
}

/** Fastest two timed completions for this user on this route — a personal best needs at least 2 to mean anything (otherwise every first run is trivially "the best"). */
export async function getPersonalBest(routeId: string): Promise<{ durationSeconds: number } | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('route_completions')
    .select('duration_seconds')
    .eq('user_id', userId)
    .eq('route_id', routeId)
    .not('duration_seconds', 'is', null)
    .order('duration_seconds', { ascending: true })
    .limit(2);

  if (error) throw new Error(error.message);
  if (!data || data.length < 2) return null;
  return { durationSeconds: data[0].duration_seconds as number };
}

interface ActivityRow {
  id: string;
  user_id: string;
  route_id: string;
  group_run_id: string | null;
  completed_at: string;
  duration_seconds: number | null;
  notes: string | null;
  source: RouteCompletion['source'];
  routes: { name: string; distance_km: number; city: string | null } | { name: string; distance_km: number; city: string | null }[] | null;
  group_runs: { title: string } | { title: string }[] | null;
}

/** Chronological feed of a user's logged runs, for the profile Activity tab. */
export async function listCompletionActivity(userId: string, limit = 50): Promise<RouteCompletionActivityItem[]> {
  const { data, error } = await supabase
    .from('route_completions')
    .select('*, routes:route_id(name, distance_km, city), group_runs:group_run_id(title)')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ActivityRow[]).map((row) => {
    const route = Array.isArray(row.routes) ? row.routes[0] : row.routes;
    const groupRun = Array.isArray(row.group_runs) ? row.group_runs[0] : row.group_runs;
    return {
      id: row.id,
      userId: row.user_id,
      routeId: row.route_id,
      groupRunId: row.group_run_id,
      completedAt: new Date(row.completed_at).getTime(),
      durationSeconds: row.duration_seconds,
      notes: row.notes,
      source: row.source,
      routeName: route?.name ?? 'Untitled route',
      routeDistanceKm: route?.distance_km ?? 0,
      routeCity: route?.city ?? null,
      groupRunTitle: groupRun?.title ?? null,
    };
  });
}
