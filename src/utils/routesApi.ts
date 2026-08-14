import { supabase } from '../lib/supabase';
import { ActivityType, CloudRoute, PathPoint, RouteSegment, Waypoint } from '../types/route';
import { listBlockedIds } from './blocksApi';

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
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distance_km: number;
  elevation_gain_m: number;
  elevation_profile: PathPoint[] | null;
  city: string | null;
  is_public: boolean;
  created_at: string;
  profiles: OwnerProfile | OwnerProfile[] | null;
  saves: { count: number }[] | null;
  likes: { count: number }[] | null;
}

const ROUTE_SELECT = '*, profiles!owner_id(username, avatar_url), saves:route_saves(count), likes:route_likes(count)';

function ownerProfile(row: RouteRow): OwnerProfile {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return profile ?? { username: 'unknown', avatar_url: null };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function toCloudRoute(row: RouteRow, viewerId: string | null, savedAt?: string): Promise<CloudRoute> {
  let isSavedByMe = false;
  let isLikedByMe = false;

  if (viewerId) {
    const [{ data: saveRow }, { data: likeRow }] = await Promise.all([
      supabase
        .from('route_saves')
        .select('route_id')
        .eq('route_id', row.id)
        .eq('user_id', viewerId)
        .maybeSingle(),
      supabase
        .from('route_likes')
        .select('route_id')
        .eq('route_id', row.id)
        .eq('user_id', viewerId)
        .maybeSingle(),
    ]);
    isSavedByMe = !!saveRow;
    isLikedByMe = !!likeRow;
  }

  const owner = ownerProfile(row);

  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerUsername: owner.username,
    ownerAvatarUrl: owner.avatar_url,
    name: row.name,
    description: row.description,
    activityType: row.activity_type,
    createdAt: new Date(row.created_at).getTime(),
    waypoints: row.waypoints,
    segments: row.segments,
    distanceKm: row.distance_km,
    elevationGainM: row.elevation_gain_m,
    elevationProfile: row.elevation_profile ?? [],
    city: row.city,
    isPublic: row.is_public,
    savesCount: row.saves?.[0]?.count ?? 0,
    likesCount: row.likes?.[0]?.count ?? 0,
    isOwnedByMe: row.owner_id === viewerId,
    isSavedByMe,
    isLikedByMe,
    savedAt: savedAt ? new Date(savedAt).getTime() : undefined,
  };
}

export interface CreateRouteInput {
  name: string;
  description: string;
  activityType: ActivityType;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distanceKm: number;
  elevationGainM: number;
  elevationProfile: PathPoint[];
  city: string | null;
}

export async function createRoute(input: CreateRouteInput): Promise<CloudRoute> {
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
      elevation_profile: input.elevationProfile,
      city: input.city,
    })
    .select(ROUTE_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to save route.');
  return toCloudRoute(data as unknown as RouteRow, ownerId);
}

export async function updateRoute(id: string, input: CreateRouteInput): Promise<CloudRoute> {
  const viewerId = await currentUserId();

  const { data, error } = await supabase
    .from('routes')
    .update({
      name: input.name,
      description: input.description,
      activity_type: input.activityType,
      waypoints: input.waypoints,
      segments: input.segments,
      distance_km: input.distanceKm,
      elevation_gain_m: input.elevationGainM,
      elevation_profile: input.elevationProfile,
      city: input.city,
    })
    .eq('id', id)
    .select(ROUTE_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to update route.');
  return toCloudRoute(data as unknown as RouteRow, viewerId);
}

export async function listMyRoutes(): Promise<CloudRoute[]> {
  const viewerId = await currentUserId();
  if (!viewerId) return [];

  const { data, error } = await supabase
    .from('routes')
    .select(ROUTE_SELECT)
    .eq('owner_id', viewerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as RouteRow[];
  return Promise.all(rows.map((row) => toCloudRoute(row, viewerId)));
}

/** Cheap count for gate checks — avoids fetching full route rows just to know how many exist. */
export async function countMyRoutes(): Promise<number> {
  const viewerId = await currentUserId();
  if (!viewerId) return 0;

  const { count, error } = await supabase
    .from('routes')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', viewerId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Routes the current user has saved from other people (not their own creations). */
export async function listSavedRoutes(): Promise<CloudRoute[]> {
  const viewerId = await currentUserId();
  if (!viewerId) return [];

  const { data, error } = await supabase
    .from('route_saves')
    .select(`created_at, routes(${ROUTE_SELECT})`)
    .eq('user_id', viewerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as { created_at: string; routes: RouteRow | RouteRow[] | null }[];

  const routes = rows
    .map((r) => ({ savedAt: r.created_at, route: Array.isArray(r.routes) ? r.routes[0] : r.routes }))
    .filter((r): r is { savedAt: string; route: RouteRow } => !!r.route);

  return Promise.all(routes.map(({ route, savedAt }) => toCloudRoute(route, viewerId, savedAt)));
}

export type ActivityKind = 'created' | 'saved';

export interface ActivityItem {
  kind: ActivityKind;
  at: number;
  route: CloudRoute;
}

/** Chronological feed of the viewer's own activity: routes created + routes saved. */
export async function listActivity(): Promise<ActivityItem[]> {
  const [created, saved] = await Promise.all([listMyRoutes(), listSavedRoutes()]);

  const items: ActivityItem[] = [
    ...created.map((route) => ({ kind: 'created' as const, at: route.createdAt, route })),
    ...saved.map((route) => ({ kind: 'saved' as const, at: route.savedAt ?? route.createdAt, route })),
  ];

  return items.sort((a, b) => b.at - a.at);
}

/** Public routes for discovery, most recent first, excluding the viewer's own. */
export interface PublicRouteFilters {
  minDistanceKm?: number;
  maxDistanceKm?: number;
  maxElevationGainM?: number;
  city?: string;
  limit?: number;
}

/** Public routes for discovery — includes the viewer's own routes, since Discover is meant to show everything, not just other people's. */
export async function listPublicRoutes(filters: PublicRouteFilters = {}): Promise<CloudRoute[]> {
  const [viewerId, blockedIds] = await Promise.all([currentUserId(), listBlockedIds()]);

  let query = supabase
    .from('routes')
    .select(ROUTE_SELECT)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 100);

  if (filters.minDistanceKm !== undefined) query = query.gte('distance_km', filters.minDistanceKm);
  if (filters.maxDistanceKm !== undefined) query = query.lte('distance_km', filters.maxDistanceKm);
  if (filters.maxElevationGainM !== undefined) query = query.lte('elevation_gain_m', filters.maxElevationGainM);
  if (filters.city?.trim()) query = query.ilike('city', `%${filters.city.trim()}%`);
  if (blockedIds.length > 0) query = query.not('owner_id', 'in', `(${blockedIds.join(',')})`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as RouteRow[];
  return Promise.all(rows.map((row) => toCloudRoute(row, viewerId)));
}

/** A user's public routes, for their profile page. */
export async function listRoutesByOwner(ownerId: string): Promise<CloudRoute[]> {
  const viewerId = await currentUserId();

  const { data, error } = await supabase
    .from('routes')
    .select(ROUTE_SELECT)
    .eq('owner_id', ownerId)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as RouteRow[];
  return Promise.all(rows.map((row) => toCloudRoute(row, viewerId)));
}

export async function getRoute(id: string): Promise<CloudRoute> {
  const viewerId = await currentUserId();
  const { data, error } = await supabase.from('routes').select(ROUTE_SELECT).eq('id', id).single();
  if (error || !data) throw new Error(error?.message ?? 'Route not found.');
  return toCloudRoute(data as unknown as RouteRow, viewerId);
}

export async function deleteRoute(id: string): Promise<void> {
  const { error } = await supabase.from('routes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setRouteSaved(routeId: string, saved: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to save routes.');

  if (saved) {
    const { error } = await supabase.from('route_saves').insert({ route_id: routeId, user_id: userId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('route_saves')
      .delete()
      .eq('route_id', routeId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}

export async function setRouteLiked(routeId: string, liked: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to like routes.');

  if (liked) {
    const { error } = await supabase.from('route_likes').insert({ route_id: routeId, user_id: userId });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('route_likes')
      .delete()
      .eq('route_id', routeId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}
