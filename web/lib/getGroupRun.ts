import { supabase } from './supabase';
import { PublicGroupRun, RouteSegment, Waypoint } from './types';

interface RouteEmbed {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  is_public: boolean;
  waypoints: Waypoint[];
  segments: RouteSegment[];
}

interface ProfileEmbed {
  username: string;
  avatar_url: string | null;
}

interface RsvpEmbed {
  profiles: ProfileEmbed | ProfileEmbed[] | null;
}

interface GroupRunRow {
  id: string;
  title: string;
  description: string;
  scheduled_at: string;
  city: string | null;
  status: 'scheduled' | 'active' | 'archived';
  route_id: string;
  routes: RouteEmbed | RouteEmbed[] | null;
  profiles: ProfileEmbed | ProfileEmbed[] | null;
  rsvps: RsvpEmbed[] | null;
}

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Fetches a group run for the public share page. RLS (see
 * 0025_public_group_run_pages.sql) allows anonymous reads of
 * scheduled/active/archived runs, and only approved RSVPs — this never
 * leaks pending/declined requests to an anonymous visitor.
 */
export async function getPublicGroupRun(id: string): Promise<PublicGroupRun | null> {
  const { data, error } = await supabase
    .from('group_runs')
    .select(
      `id, title, description, scheduled_at, city, status, route_id,
       routes:route_id(id, name, distance_km, elevation_gain_m, is_public, waypoints, segments),
       profiles:host_id(username, avatar_url),
       rsvps:group_run_rsvps(profiles:user_id(username, avatar_url))`,
    )
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const row = data as unknown as GroupRunRow;
  const route = unwrap(row.routes);
  const host = unwrap(row.profiles);
  const participants = (row.rsvps ?? [])
    .map((r) => unwrap(r.profiles))
    .filter((p): p is ProfileEmbed => !!p)
    .map((p) => ({ username: p.username, avatarUrl: p.avatar_url }));

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    scheduledAt: row.scheduled_at,
    city: row.city,
    status: row.status,
    hostUsername: host?.username ?? 'a rootah runner',
    routeId: row.route_id,
    routeName: route?.name ?? null,
    routeDistanceKm: route?.distance_km ?? null,
    routeElevationGainM: route?.elevation_gain_m ?? null,
    routeWaypoints: route?.waypoints ?? null,
    routeSegments: route?.segments ?? null,
    rsvpCount: participants.length,
    participants,
  };
}
