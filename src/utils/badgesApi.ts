import { supabase } from '../lib/supabase';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'standard' | 'rare' | 'legendary';
}

export interface UserBadge {
  id: string;
  badge: Badge;
  grantedAt: number;
  contextRouteId: string | null;
}

interface UserBadgeRow {
  id: string;
  badge_id: string;
  granted_at: string;
  context_route_id: string | null;
  badges: Badge | Badge[] | null;
}

function toUserBadge(row: UserBadgeRow): UserBadge | null {
  const badge = Array.isArray(row.badges) ? row.badges[0] : row.badges;
  if (!badge) return null;
  return {
    id: row.id,
    badge,
    grantedAt: new Date(row.granted_at).getTime(),
    contextRouteId: row.context_route_id,
  };
}

/** Badges a user has earned, most recently granted first — never shown as an empty strip by the caller. */
export async function listUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase
    .from('user_badges')
    .select('id, badge_id, granted_at, context_route_id, badges:badge_id(*)')
    .eq('user_id', userId)
    .order('granted_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as UserBadgeRow[])
    .map(toUserBadge)
    .filter((b): b is UserBadge => b !== null);
}

/** Badges granted in the last few seconds — used right after logging a completion to power the follow-up sheet's celebration header. */
export async function listRecentlyGrantedBadges(userId: string, sinceMs = 15_000): Promise<UserBadge[]> {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { data, error } = await supabase
    .from('user_badges')
    .select('id, badge_id, granted_at, context_route_id, badges:badge_id(*)')
    .eq('user_id', userId)
    .gte('granted_at', since);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as UserBadgeRow[])
    .map(toUserBadge)
    .filter((b): b is UserBadge => b !== null);
}

export interface RouteLeader {
  userId: string;
  username: string;
  avatarUrl: string | null;
  completionCount: number;
}

/** "Local Legend" — the top completer on this route (min 3 completions), computed live rather than stored. */
export async function getRouteLeader(routeId: string): Promise<RouteLeader | null> {
  const { data, error } = await supabase.rpc('get_route_leader', { p_route_id: routeId });
  if (error) throw new Error(error.message);
  const leader = (data ?? [])[0] as { user_id: string; completion_count: number } | undefined;
  if (!leader) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, avatar_url')
    .eq('id', leader.user_id)
    .maybeSingle();

  return {
    userId: leader.user_id,
    username: profile?.username ?? 'unknown',
    avatarUrl: profile?.avatar_url ?? null,
    completionCount: leader.completion_count,
  };
}
