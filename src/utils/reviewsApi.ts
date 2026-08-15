import { supabase } from '../lib/supabase';
import { RouteReview } from '../types/route';

interface ReviewRow {
  id: string;
  user_id: string;
  route_id: string;
  completion_id: string | null;
  group_run_id: string | null;
  rating: number;
  body: string | null;
  source: RouteReview['source'];
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
  group_runs: { title: string } | { title: string }[] | null;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function toReview(row: ReviewRow, viewerId: string | null): RouteReview {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const groupRun = Array.isArray(row.group_runs) ? row.group_runs[0] : row.group_runs;
  return {
    id: row.id,
    userId: row.user_id,
    username: profile?.username ?? 'unknown',
    avatarUrl: profile?.avatar_url ?? null,
    routeId: row.route_id,
    completionId: row.completion_id,
    groupRunId: row.group_run_id,
    groupRunTitle: groupRun?.title ?? null,
    rating: row.rating,
    body: row.body,
    source: row.source,
    createdAt: new Date(row.created_at).getTime(),
    isOwnedByMe: row.user_id === viewerId,
  };
}

const REVIEW_SELECT = '*, profiles:user_id(username, avatar_url), group_runs:group_run_id(title)';

/**
 * A user may review a route if they've logged a completion for it, or
 * attended (hosted or RSVP'd, approved) an archived group run built on it —
 * keeps ratings credible by gating behind actually having run it.
 */
export async function canReviewRoute(routeId: string): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;

  const { data: completion } = await supabase
    .from('route_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('route_id', routeId)
    .limit(1)
    .maybeSingle();
  if (completion) return true;

  const { data: rsvp } = await supabase
    .from('group_run_rsvps')
    .select('group_runs!inner(route_id, status)')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .eq('group_runs.route_id', routeId)
    .eq('group_runs.status', 'archived')
    .limit(1)
    .maybeSingle();

  return !!rsvp;
}

export async function getMyReview(routeId: string): Promise<RouteReview | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('route_reviews')
    .select(REVIEW_SELECT)
    .eq('user_id', userId)
    .eq('route_id', routeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toReview(data as unknown as ReviewRow, userId) : null;
}

export interface UpsertReviewInput {
  routeId: string;
  rating: number;
  body?: string | null;
  completionId?: string | null;
  groupRunId?: string | null;
  source: 'solo' | 'group_run';
}

/** Upserts on (user_id, route_id) — one review per user per route, editable in place. */
export async function upsertReview(input: UpsertReviewInput): Promise<RouteReview> {
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to leave a review.');

  const { data, error } = await supabase
    .from('route_reviews')
    .upsert(
      {
        user_id: userId,
        route_id: input.routeId,
        rating: input.rating,
        body: input.body?.trim() || null,
        completion_id: input.completionId ?? null,
        group_run_id: input.groupRunId ?? null,
        source: input.source,
      },
      { onConflict: 'user_id,route_id' },
    )
    .select(REVIEW_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return toReview(data as unknown as ReviewRow, userId);
}

/** Reviews with text only, newest first — reviews without a body still count toward the rating but aren't listed. */
export async function listRouteReviews(routeId: string, limit = 50): Promise<RouteReview[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('route_reviews')
    .select(REVIEW_SELECT)
    .eq('route_id', routeId)
    .not('body', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ReviewRow[]).map((row) => toReview(row, userId));
}
