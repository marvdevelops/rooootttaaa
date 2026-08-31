import { supabase } from './supabase';

export interface PublicProfilePreview {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  city: string | null;
  routeCount: number;
  /** Total distance of the member's public routes (planning artifact). */
  routeDistanceKm: number;
  /** Number of recorded activities (runs, rides, walks, hikes). */
  activityCount: number;
  /** Total distance actually moved across recorded activities. */
  activityKm: number;
}

interface ProfileRow {
  id: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
}

interface RouteAggRow {
  distance_km: number;
  city: string | null;
}

/** RLS returns any public profile row for anonymous reads; only public routes count toward the stats. */
export async function getPublicProfile(id: string): Promise<PublicProfilePreview | null> {
  const { data, error } = await supabase.from('profiles').select('id, username, bio, avatar_url').eq('id', id).single();
  if (error || !data) return null;

  const row = data as ProfileRow;

  const [{ data: routeRows }, { data: totals }] = await Promise.all([
    supabase.from('routes').select('distance_km, city').eq('owner_id', id).eq('is_public', true),
    supabase.rpc('get_public_activity_totals', { p_user_id: id }),
  ]);
  const routes = (routeRows ?? []) as RouteAggRow[];
  const t = (Array.isArray(totals) ? totals[0] : totals) as { activity_count: number; total_meters: number } | null;

  return {
    id: row.id,
    username: row.username,
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url,
    city: routes.find((r) => r.city)?.city ?? null,
    routeCount: routes.length,
    routeDistanceKm: routes.reduce((s, r) => s + r.distance_km, 0),
    activityCount: t?.activity_count ?? 0,
    activityKm: (t?.total_meters ?? 0) / 1000,
  };
}
