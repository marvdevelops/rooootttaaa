import { supabase } from './supabase';
import { ActivityType, PathPoint, PublicRoute, RouteSegment, Waypoint } from './types';

interface RouteRow {
  id: string;
  name: string;
  description: string;
  activity_type: ActivityType;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distance_km: number;
  elevation_gain_m: number;
  elevation_profile: PathPoint[] | null;
  created_at: string;
  is_public: boolean;
  profiles: { username: string } | { username: string }[] | null;
  saves: { count: number }[] | null;
  likes: { count: number }[] | null;
}

function ownerUsername(row: RouteRow): string {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return profile?.username ?? 'a rootah runner';
}

/**
 * Fetches a route for the public web preview. RLS only returns rows where
 * is_public = true for unauthenticated reads, so a private/deleted route id
 * simply resolves to null here rather than leaking its existence.
 */
export async function getPublicRoute(id: string): Promise<PublicRoute | null> {
  const { data, error } = await supabase
    .from('routes')
    .select('*, profiles!owner_id(username), saves:route_saves(count), likes:route_likes(count)')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as RouteRow;
  if (!row.is_public) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    activityType: row.activity_type,
    ownerUsername: ownerUsername(row),
    waypoints: row.waypoints,
    segments: row.segments,
    distanceKm: row.distance_km,
    elevationGainM: row.elevation_gain_m,
    elevationProfile: row.elevation_profile ?? [],
    savesCount: row.saves?.[0]?.count ?? 0,
    likesCount: row.likes?.[0]?.count ?? 0,
    createdAt: row.created_at,
  };
}
