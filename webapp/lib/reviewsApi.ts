import { createClient } from './supabase/client';
import { RouteReview } from './types';

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
}

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function toReview(row: ReviewRow, viewerId: string | null): RouteReview {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    userId: row.user_id,
    username: profile?.username ?? 'unknown',
    avatarUrl: profile?.avatar_url ?? null,
    routeId: row.route_id,
    completionId: row.completion_id,
    groupRunId: row.group_run_id,
    groupRunTitle: null,
    rating: row.rating,
    body: row.body,
    source: row.source,
    createdAt: new Date(row.created_at).getTime(),
    isOwnedByMe: row.user_id === viewerId,
  };
}

const REVIEW_SELECT = '*, profiles:user_id(username, avatar_url)';

/** A user may review a route once they've logged a completion for it. */
export async function canReviewRoute(routeId: string): Promise<boolean> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) return false;

  const { data } = await supabase
    .from('route_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('route_id', routeId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function getMyReview(routeId: string): Promise<RouteReview | null> {
  const supabase = createClient();
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
}

export async function upsertReview(input: UpsertReviewInput): Promise<RouteReview> {
  const supabase = createClient();
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
        source: 'solo',
      },
      { onConflict: 'user_id,route_id' },
    )
    .select(REVIEW_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return toReview(data as unknown as ReviewRow, userId);
}

export async function listRouteReviews(routeId: string, limit = 50): Promise<RouteReview[]> {
  const supabase = createClient();
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
