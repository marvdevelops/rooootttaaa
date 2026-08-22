import { createClient } from './supabase/client';
import { ClubMembershipStatus, ClubRole, CreateClubInput, RunClub } from './types';

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
