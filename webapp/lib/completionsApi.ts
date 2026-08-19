import { createClient } from './supabase/client';
import { CompletionParticipant, RouteCompletion } from './types';

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

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function hasCompletedRoute(routeId: string): Promise<boolean> {
  const supabase = createClient();
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

/** Logs a completion for right now. A same-day duplicate is a DB-level unique-index conflict, treated as success. */
export async function logRouteCompletion(routeId: string): Promise<RouteCompletion> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to log a run.');

  const { data, error } = await supabase
    .from('route_completions')
    .insert({ user_id: userId, route_id: routeId, source: 'manual', completed_at: new Date().toISOString() })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      const todayUtc = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase
        .from('route_completions')
        .select('*')
        .eq('user_id', userId)
        .eq('route_id', routeId)
        .gte('completed_at', `${todayUtc}T00:00:00Z`)
        .maybeSingle();
      if (existing) return toCompletion(existing as CompletionRow);
    }
    throw new Error(error.message);
  }
  return toCompletion(data as CompletionRow);
}

/** Everyone who's logged this route, most recent first. */
export async function listRouteCompletions(routeId: string, limit = 30): Promise<CompletionParticipant[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('route_completions')
    .select('id, completed_at, duration_seconds, profiles(username, avatar_url)')
    .eq('route_id', routeId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
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
