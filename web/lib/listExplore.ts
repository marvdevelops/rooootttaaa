import { supabase } from './supabase';

export interface ExploreRoute {
  id: string;
  name: string;
  distanceKm: number;
  activityType: string;
  city: string | null;
  ownerUsername: string;
}

export interface ExploreClub {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  memberCount: number;
}

export interface ExploreRun {
  id: string;
  title: string;
  scheduledAt: string;
  city: string | null;
  routeName: string | null;
}

interface RouteRow {
  id: string;
  name: string;
  distance_km: number;
  activity_type: string;
  city: string | null;
  profiles: { username: string } | { username: string }[] | null;
}

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Newest public routes — plain reverse-chronological, for the "Latest routes" section. */
export async function listLatestRoutes(limit = 8): Promise<ExploreRoute[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('id, name, distance_km, activity_type, city, profiles!owner_id(username)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return [];
  return ((data ?? []) as unknown as RouteRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    distanceKm: row.distance_km,
    activityType: row.activity_type,
    city: row.city,
    ownerUsername: unwrap(row.profiles)?.username ?? 'a rootah runner',
  }));
}

/** Top-scored routes from the top_routes view — falls back to most-completed when a city has too few qualifying routes (mirrors mobile's fetchTopRoutesInCity fallback), and to latest routes if even that's empty (brand-new city with no completions yet). */
export async function listFeaturedRoutes(limit = 8): Promise<ExploreRoute[]> {
  const { data, error } = await supabase
    .from('top_routes')
    .select('id, name, distance_km, activity_type, city, profiles!owner_id(username)')
    .order('score', { ascending: false })
    .limit(limit);

  const rows = ((data ?? []) as unknown as RouteRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    distanceKm: row.distance_km,
    activityType: row.activity_type,
    city: row.city,
    ownerUsername: unwrap(row.profiles)?.username ?? 'a rootah runner',
  }));

  if (error || rows.length === 0) return listLatestRoutes(limit);
  return rows;
}

/** Open (non-private) clubs, biggest first. */
export async function listExploreClubs(limit = 8): Promise<ExploreClub[]> {
  const { data, error } = await supabase
    .from('run_clubs')
    .select('id, slug, name, city, member_count')
    .eq('is_private', false)
    .order('member_count', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    memberCount: row.member_count,
  }));
}

interface RunRow {
  id: string;
  title: string;
  scheduled_at: string;
  city: string | null;
  routes: { name: string } | { name: string }[] | null;
}

/** Upcoming (scheduled/active) group runs, soonest first. */
export async function listUpcomingRuns(limit = 8): Promise<ExploreRun[]> {
  const { data, error } = await supabase
    .from('group_runs')
    .select('id, title, scheduled_at, city, routes:route_id(name)')
    .in('status', ['scheduled', 'active'])
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) return [];
  return ((data ?? []) as unknown as RunRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    city: row.city,
    routeName: unwrap(row.routes)?.name ?? null,
  }));
}
