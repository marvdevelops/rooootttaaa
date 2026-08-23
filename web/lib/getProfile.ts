import { supabase } from './supabase';

export interface PublicProfilePreview {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  city: string | null;
  routeCount: number;
  distanceKm: number;
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

  const { data: routeRows } = await supabase.from('routes').select('distance_km, city').eq('owner_id', id).eq('is_public', true);
  const routes = (routeRows ?? []) as RouteAggRow[];

  return {
    id: row.id,
    username: row.username,
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url,
    city: routes.find((r) => r.city)?.city ?? null,
    routeCount: routes.length,
    distanceKm: routes.reduce((s, r) => s + r.distance_km, 0),
  };
}
