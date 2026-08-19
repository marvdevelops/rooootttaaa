import { createClient } from './supabase/client';
import { ActivityType, CloudRoute, CreateRouteInput, RouteSegment, Waypoint } from './types';

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

export async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function toCloudRoute(row: RouteRow, viewerId: string | null): Promise<CloudRoute> {
  const owner = ownerProfile(row);
  let isSavedByMe = false;
  let isLikedByMe = false;

  if (viewerId) {
    const supabase = createClient();
    const [{ data: saveRow }, { data: likeRow }] = await Promise.all([
      supabase.from('route_saves').select('route_id').eq('route_id', row.id).eq('user_id', viewerId).maybeSingle(),
      supabase.from('route_likes').select('route_id').eq('route_id', row.id).eq('user_id', viewerId).maybeSingle(),
    ]);
    isSavedByMe = !!saveRow;
    isLikedByMe = !!likeRow;
  }

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
    isOwnedByMe: viewerId === row.owner_id,
    isSavedByMe,
    isLikedByMe,
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
  const viewerId = await currentUserId();

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
  return Promise.all((data ?? []).map((row) => toCloudRoute(row as unknown as RouteRow, viewerId)));
}

export async function getRoute(id: string): Promise<CloudRoute | null> {
  const supabase = createClient();
  const viewerId = await currentUserId();
  const { data, error } = await supabase.from('routes').select(ROUTE_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCloudRoute(data as unknown as RouteRow, viewerId) : null;
}

export async function createRoute(input: CreateRouteInput): Promise<CloudRoute> {
  const supabase = createClient();
  const ownerId = await currentUserId();
  if (!ownerId) throw new Error('You must be signed in to save a route.');

  const { data, error } = await supabase
    .from('routes')
    .insert({
      owner_id: ownerId,
      name: input.name,
      description: input.description,
      activity_type: input.activityType,
      waypoints: input.waypoints,
      segments: input.segments,
      distance_km: input.distanceKm,
      elevation_gain_m: input.elevationGainM,
      city: input.city,
    })
    .select(ROUTE_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to save route.');
  return toCloudRoute(data as unknown as RouteRow, ownerId);
}

export async function toggleLike(routeId: string, isLiked: boolean): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in.');

  if (isLiked) {
    await supabase.from('route_likes').delete().eq('route_id', routeId).eq('user_id', userId);
  } else {
    await supabase.from('route_likes').insert({ route_id: routeId, user_id: userId });
  }
}

export async function toggleSave(routeId: string, isSaved: boolean): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in.');

  if (isSaved) {
    await supabase.from('route_saves').delete().eq('route_id', routeId).eq('user_id', userId);
  } else {
    await supabase.from('route_saves').insert({ route_id: routeId, user_id: userId });
  }
}
