import { createClient } from './supabase/client';
import { ClubMember, ClubMembershipStatus, ClubRole, ClubRouteSummary, CreateClubInput, RunClub } from './types';

interface ClubRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_private: boolean;
  member_count: number;
  share_count: number;
  created_by: string;
  created_at: string;
}

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function buildRunClub(row: ClubRow, myRole: ClubRole | null, myStatus: ClubMembershipStatus | null): RunClub {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    city: row.city,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    isPrivate: row.is_private,
    memberCount: row.member_count,
    shareCount: row.share_count ?? 0,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).getTime(),
    myRole,
    myStatus,
  };
}

async function toRunClub(row: ClubRow, viewerId: string | null): Promise<RunClub> {
  if (!viewerId) return buildRunClub(row, null, null);
  const supabase = createClient();
  const { data } = await supabase
    .from('club_memberships')
    .select('role, status')
    .eq('club_id', row.id)
    .eq('user_id', viewerId)
    .maybeSingle();
  if (data && data.status !== 'removed') {
    return buildRunClub(row, data.role as ClubRole, data.status as ClubMembershipStatus);
  }
  return buildRunClub(row, null, null);
}

async function toRunClubBatch(rows: ClubRow[], viewerId: string | null): Promise<RunClub[]> {
  if (rows.length === 0) return [];
  if (!viewerId) return rows.map((row) => buildRunClub(row, null, null));

  const supabase = createClient();
  const { data } = await supabase
    .from('club_memberships')
    .select('club_id, role, status')
    .eq('user_id', viewerId)
    .in('club_id', rows.map((r) => r.id));

  const byClubId = new Map((data ?? []).map((m) => [m.club_id as string, m]));
  return rows.map((row) => {
    const membership = byClubId.get(row.id);
    if (!membership || membership.status === 'removed') return buildRunClub(row, null, null);
    return buildRunClub(row, membership.role as ClubRole, membership.status as ClubMembershipStatus);
  });
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 50);
}

async function resolveUniqueSlug(base: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.from('run_clubs').select('slug').like('slug', `${base}%`);
  const taken = new Set((data ?? []).map((c) => c.slug as string));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export class ClubFullError extends Error {}

export async function createClub(input: CreateClubInput): Promise<RunClub> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to create a club.');

  const slug = await resolveUniqueSlug(slugify(input.name) || 'club');

  const { data, error } = await supabase
    .from('run_clubs')
    .insert({
      name: input.name.trim(),
      slug,
      description: input.description.trim() || null,
      city: input.city.trim() || null,
      is_private: input.isPrivate,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create club.');

  const { error: membershipError } = await supabase
    .from('club_memberships')
    .insert({ club_id: data.id, user_id: userId, role: 'owner', status: 'active' });
  if (membershipError) throw new Error(membershipError.message);

  return toRunClub(data as ClubRow, userId);
}

export interface UpdateClubInput {
  name?: string;
  description?: string;
  city?: string;
  isPrivate?: boolean;
  avatarUrl?: string;
}

export async function updateClub(clubId: string, input: UpdateClubInput): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.description !== undefined) updates.description = input.description.trim() || null;
  if (input.city !== undefined) updates.city = input.city.trim() || null;
  if (input.isPrivate !== undefined) updates.is_private = input.isPrivate;
  if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;

  const supabase = createClient();
  const { error } = await supabase.from('run_clubs').update(updates).eq('id', clubId);
  if (error) throw new Error(error.message);
}

/**
 * Uploads a club logo to the `avatars` bucket under `clubs/{clubId}/` —
 * storage RLS there checks the uploader is an active admin/owner of that
 * club — and returns a cache-busted public URL.
 */
export async function uploadClubAvatar(clubId: string, file: File): Promise<string> {
  const supabase = createClient();
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `clubs/${clubId}/logo.${ext}`;

  const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function getClub(id: string): Promise<RunClub> {
  const supabase = createClient();
  const viewerId = await currentUserId();
  const { data, error } = await supabase.from('run_clubs').select('*').eq('id', id).single();
  if (error || !data) throw new Error(error?.message ?? 'Club not found.');
  return toRunClub(data as ClubRow, viewerId);
}

/** Clubs the current user actively belongs to — "Your crews" in the sidebar. */
export async function listMyClubs(): Promise<RunClub[]> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from('club_memberships')
    .select('club_id')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (membershipError) throw new Error(membershipError.message);

  const clubIds = (memberships ?? []).map((m) => m.club_id as string);
  if (clubIds.length === 0) return [];

  const { data, error } = await supabase.from('run_clubs').select('*').in('id', clubIds).order('member_count', { ascending: false });
  if (error) throw new Error(error.message);
  return toRunClubBatch((data ?? []) as ClubRow[], userId);
}

/** Open (non-private) clubs, biggest first — for Discover. */
export async function listNearbyClubs(city: string | null, limit = 30): Promise<RunClub[]> {
  const supabase = createClient();
  const viewerId = await currentUserId();
  let query = supabase.from('run_clubs').select('*').eq('is_private', false).order('member_count', { ascending: false }).limit(limit);
  if (city) query = query.eq('city', city);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return toRunClubBatch((data ?? []) as ClubRow[], viewerId);
}

export async function joinClub(clubId: string, isPrivate: boolean): Promise<ClubMembershipStatus> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to join a club.');

  const status: ClubMembershipStatus = isPrivate ? 'pending' : 'active';
  const { error } = await supabase
    .from('club_memberships')
    .upsert({ club_id: clubId, user_id: userId, role: 'member', status }, { onConflict: 'club_id,user_id' });

  if (error) {
    if (error.message.includes('currently full')) throw new ClubFullError('This club is currently full.');
    throw new Error(error.message);
  }
  return status;
}

export async function leaveClub(clubId: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase.from('club_memberships').delete().eq('club_id', clubId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

interface MemberRow {
  user_id: string;
  role: ClubRole;
  status: ClubMembershipStatus;
  joined_at: string;
  profiles: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
}

export async function listClubMembers(clubId: string, status: ClubMembershipStatus = 'active'): Promise<ClubMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('club_memberships')
    .select('user_id, role, status, joined_at, profiles:user_id(username, avatar_url)')
    .eq('club_id', clubId)
    .eq('status', status)
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as MemberRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: row.user_id,
      username: profile?.username ?? 'unknown',
      avatarUrl: profile?.avatar_url ?? null,
      role: row.role,
      status: row.status,
      joinedAt: new Date(row.joined_at).getTime(),
    };
  });
}

export async function respondToClubJoinRequest(clubId: string, userId: string, approve: boolean): Promise<void> {
  const supabase = createClient();
  if (approve) {
    const { error } = await supabase.from('club_memberships').update({ status: 'active' }).eq('club_id', clubId).eq('user_id', userId);
    if (error) {
      if (error.message.includes('currently full')) throw new ClubFullError('This club is currently full.');
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from('club_memberships').delete().eq('club_id', clubId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}

export async function setClubMemberRole(clubId: string, userId: string, role: ClubRole): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('club_memberships').update({ role }).eq('club_id', clubId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function removeClubMember(clubId: string, userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('club_memberships').delete().eq('club_id', clubId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

interface ClubRouteRow {
  routes: {
    id: string;
    name: string;
    distance_km: number;
    elevation_gain_m: number;
    profiles: { username: string } | { username: string }[] | null;
  } | null;
}

export async function listClubRoutes(clubId: string): Promise<ClubRouteSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('club_routes')
    .select('routes:route_id(id, name, distance_km, elevation_gain_m, profiles:owner_id(username))')
    .eq('club_id', clubId)
    .order('added_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ClubRouteRow[])
    .filter((row): row is ClubRouteRow & { routes: NonNullable<ClubRouteRow['routes']> } => !!row.routes)
    .map((row) => {
      const owner = Array.isArray(row.routes.profiles) ? row.routes.profiles[0] : row.routes.profiles;
      return {
        id: row.routes.id,
        name: row.routes.name,
        distanceKm: row.routes.distance_km,
        elevationGainM: row.routes.elevation_gain_m,
        ownerUsername: owner?.username ?? 'unknown',
      };
    });
}

export async function addClubRoute(clubId: string, routeId: string): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  const { error } = await supabase.from('club_routes').upsert({ club_id: clubId, route_id: routeId, added_by: userId }, { onConflict: 'club_id,route_id' });
  if (error) throw new Error(error.message);
}

export async function removeClubRoute(clubId: string, routeId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('club_routes').delete().eq('club_id', clubId).eq('route_id', routeId);
  if (error) throw new Error(error.message);
}

/** Fire-and-forget — called whenever the Share button is used, anonymous or signed in. */
export async function incrementClubShareCount(clubId: string): Promise<void> {
  const supabase = createClient();
  await supabase.rpc('increment_club_share_count', { club_id: clubId });
}
