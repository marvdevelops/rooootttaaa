import { supabase } from '../lib/supabase';
import { ActivityType, CloudRoute } from '../types/route';
import { getRoutesByIds, listMostCompletedInCity, listPublicRoutes } from './routesApi';

export interface TopRoutesResult {
  routes: CloudRoute[];
  /** True when this used the most-completed fallback because the city doesn't yet have 3+ routes with review_count >= 3. */
  isFallback: boolean;
}

interface TopRouteScoreRow {
  id: string;
  score: number;
}

/**
 * "Top in your city" — ranked by the top_routes view (completions/reviews/
 * rating/saves weighted score). Falls back to most-completed routes when the
 * city doesn't have at least 3 qualifying routes yet, so the strip still
 * shows something meaningful during early growth.
 */
export async function fetchTopRoutesInCity(city: string | null, limit = 5): Promise<TopRoutesResult> {
  let query = supabase.from('top_routes').select('id, score').order('score', { ascending: false }).limit(limit);
  query = city ? query.eq('city', city) : query.is('city', null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const scored = (data ?? []) as TopRouteScoreRow[];

  if (scored.length >= 3) {
    const routes = await getRoutesByIds(scored.map((r) => r.id));
    const order = new Map(scored.map((r, i) => [r.id, i]));
    routes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return { routes, isFallback: false };
  }

  const routes = await listMostCompletedInCity(city, limit);
  return { routes, isFallback: true };
}

/** Full ranked list for the Top Routes screen, optionally filtered by activity type. */
export async function fetchTopRoutesRanked(
  city: string | null,
  activityType: ActivityType | 'all' = 'all',
  limit = 50,
): Promise<CloudRoute[]> {
  let query = supabase.from('top_routes').select('id, score').order('score', { ascending: false }).limit(limit);
  if (city) query = query.eq('city', city);
  if (activityType !== 'all') query = query.eq('activity_type', activityType);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const scored = (data ?? []) as TopRouteScoreRow[];

  if (scored.length > 0) {
    const routes = await getRoutesByIds(scored.map((r) => r.id));
    const order = new Map(scored.map((r, i) => [r.id, i]));
    routes.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return activityType === 'all' ? routes : routes.filter((r) => r.activityType === activityType);
  }

  // Not enough routes have qualified for the scored view yet (needs 3+
  // reviews and 2+ completions) — same early-growth problem the Discover
  // strip already solves via isFallback. Mirror that fallback here so "See
  // all" doesn't show empty while the strip it was opened from has routes.
  const mostCompleted = await listMostCompletedInCity(city, limit);
  const filtered = activityType === 'all' ? mostCompleted : mostCompleted.filter((r) => r.activityType === activityType);
  if (filtered.length > 0) return filtered;

  const fallback = await listPublicRoutes({ city: city ?? undefined, activityType: activityType === 'all' ? undefined : activityType, limit });
  return fallback;
}

/**
 * "Routes you haven't tried" — top-scored routes in the user's city that
 * they haven't logged a completion for yet. Simple exclusion query per the
 * spec's "start with the simpler version" guidance; no ML ranking.
 */
export async function fetchRecommendedRoutes(city: string | null, userId: string | null, limit = 10): Promise<CloudRoute[]> {
  if (!userId) return [];

  const [{ data: completed, error: completedError }, topScored] = await Promise.all([
    supabase.from('route_completions').select('route_id').eq('user_id', userId),
    fetchTopRoutesRanked(city, 'all', 50),
  ]);
  if (completedError) throw new Error(completedError.message);

  const completedIds = new Set((completed ?? []).map((r) => r.route_id as string));
  return topScored.filter((r) => !completedIds.has(r.id)).slice(0, limit);
}
