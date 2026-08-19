import { createClient } from './supabase/client';
import { ActivityType, CloudRoute, RouteSegment, Waypoint } from './types';

interface OwnerProfile {
  username: string;
  avatar_url: string | null;
}

interface RouteRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  activity_type: ActivityType;
  is_trail: boolean;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distance_km: number;
  elevation_gain_m: number;
  city: string | null;
  created_at: string;
  completion_count: number;
  profiles: OwnerProfile | OwnerProfile[] | null;
  saves: { count: number }[] | null;
  likes: { count: number }[] | null;
}

const ROUTE_SELECT =
  'id, owner_id, name, description, activity_type, is_trail, waypoints, segments, distance_km, elevation_gain_m, city, created_at, completion_count, profiles!owner_id(username, avatar_url), saves:route_saves(count), likes:route_likes(count)';

function ownerProfile(row: RouteRow): OwnerProfile {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return profile ?? { username: 'unknown', avatar_url: null };
}

function toCloudRoute(row: RouteRow): CloudRoute {
  const owner = ownerProfile(row);
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerUsername: owner.username,
    ownerAvatarUrl: owner.avatar_url,
    name: row.name,
    description: row.description,
    activityType: row.activity_type,
    isTrail: row.is_trail,
    createdAt: new Date(row.created_at).getTime(),
    waypoints: row.waypoints,
    segments: row.segments,
    distanceKm: row.distance_km,
    elevationGainM: row.elevation_gain_m,
    city: row.city,
    savesCount: row.saves?.[0]?.count ?? 0,
    likesCount: row.likes?.[0]?.count ?? 0,
    completionCount: row.completion_count,
  };
}

export interface PublicRouteFilters {
  city?: string;
  activityType?: ActivityType;
  minDistanceKm?: number;
  maxDistanceKm?: number;
  limit?: number;
}

/** Public routes for the Discover map — anonymous-readable via RLS, same shape as mobile's listPublicRoutes. */
export async function listPublicRoutes(filters: PublicRouteFilters = {}): Promise<CloudRoute[]> {
  const supabase = createClient();

  let query = supabase
    .from('routes')
    .select(ROUTE_SELECT)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.minDistanceKm !== undefined) query = query.gte('distance_km', filters.minDistanceKm);
  if (filters.maxDistanceKm !== undefined) query = query.lte('distance_km', filters.maxDistanceKm);
  if (filters.city?.trim()) query = query.ilike('city', `%${filters.city.trim()}%`);
  if (filters.activityType) query = query.eq('activity_type', filters.activityType);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toCloudRoute(row as unknown as RouteRow));
}

export async function getRoute(id: string): Promise<CloudRoute | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from('routes').select(ROUTE_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCloudRoute(data as unknown as RouteRow) : null;
}
