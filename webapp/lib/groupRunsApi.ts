import { createClient } from './supabase/client';
import { CreateGroupRunInput, GroupRun, GroupRunStatus, RsvpStatus } from './types';

interface GroupRunRow {
  id: string;
  route_id: string;
  host_id: string;
  title: string;
  description: string;
  scheduled_at: string;
  created_at: string;
  status: GroupRunStatus;
  city: string | null;
  max_participants: number | null;
  approved_count: number;
  club_id: string | null;
  series_id: string | null;
  routes: { name: string; distance_km: number } | { name: string; distance_km: number }[] | null;
  profiles: { username: string } | { username: string }[] | null;
  run_clubs: { name: string; avatar_url: string | null } | { name: string; avatar_url: string | null }[] | null;
}

const GROUP_RUN_SELECT = '*, routes(name, distance_km), profiles!host_id(username), run_clubs(name, avatar_url)';
const UPCOMING_STATUSES: GroupRunStatus[] = ['scheduled', 'active'];

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function buildGroupRun(row: GroupRunRow, viewerId: string | null, myRsvpStatus: RsvpStatus | null): GroupRun {
  const route = Array.isArray(row.routes) ? row.routes[0] : row.routes;
  const host = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const club = Array.isArray(row.run_clubs) ? row.run_clubs[0] : row.run_clubs;

  return {
    id: row.id,
    routeId: row.route_id,
    routeName: route?.name ?? 'Untitled route',
    routeDistanceKm: route?.distance_km ?? 0,
    hostId: row.host_id,
    hostUsername: host?.username ?? 'unknown',
    title: row.title,
    description: row.description,
    scheduledAt: new Date(row.scheduled_at).getTime(),
    createdAt: new Date(row.created_at).getTime(),
    status: row.status,
    city: row.city,
    maxParticipants: row.max_participants,
    rsvpCount: row.approved_count ?? 0,
    isHostedByMe: row.host_id === viewerId,
    isRsvpedByMe: myRsvpStatus === 'approved',
    myRsvpStatus,
    clubId: row.club_id,
    clubName: club?.name ?? null,
    clubAvatarUrl: club?.avatar_url ?? null,
    seriesId: row.series_id,
  };
}

async function toGroupRunBatch(rows: GroupRunRow[], viewerId: string | null): Promise<GroupRun[]> {
  if (rows.length === 0) return [];
  if (!viewerId) return rows.map((row) => buildGroupRun(row, viewerId, null));

  const supabase = createClient();
  const { data } = await supabase
    .from('group_run_rsvps')
    .select('group_run_id, status')
    .eq('user_id', viewerId)
    .in('group_run_id', rows.map((r) => r.id));

  const byRunId = new Map((data ?? []).map((r) => [r.group_run_id as string, r.status as RsvpStatus]));
  return rows.map((row) => {
    const myRsvpStatus = row.host_id === viewerId ? 'approved' : (byRunId.get(row.id) ?? null);
    return buildGroupRun(row, viewerId, myRsvpStatus);
  });
}

/** Keeps only the next occurrence per series so a weekly run doesn't show 4+ near-duplicate cards. */
function dedupeBySeries(runs: GroupRun[]): GroupRun[] {
  const seenSeries = new Set<string>();
  return runs.filter((run) => {
    if (!run.seriesId) return true;
    if (seenSeries.has(run.seriesId)) return false;
    seenSeries.add(run.seriesId);
    return true;
  });
}

export async function createGroupRun(input: CreateGroupRunInput): Promise<GroupRun> {
  const supabase = createClient();
  const hostId = await currentUserId();
  if (!hostId) throw new Error('You must be signed in to schedule a group run.');

  const { data, error } = await supabase
    .from('group_runs')
    .insert({
      route_id: input.routeId,
      host_id: hostId,
      title: input.title,
      description: input.description,
      scheduled_at: input.scheduledAt.toISOString(),
      max_participants: input.maxParticipants,
      club_id: input.clubId ?? null,
    })
    .select(GROUP_RUN_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to schedule group run.');
  return buildGroupRun(data as unknown as GroupRunRow, hostId, 'approved');
}

export async function listUpcomingGroupRuns(limit = 40): Promise<GroupRun[]> {
  const supabase = createClient();
  const viewerId = await currentUserId();

  const { data, error } = await supabase
    .from('group_runs')
    .select(GROUP_RUN_SELECT)
    .in('status', UPCOMING_STATUSES)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as GroupRunRow[];
  return dedupeBySeries(await toGroupRunBatch(rows, viewerId));
}

export async function getGroupRun(id: string): Promise<GroupRun> {
  const supabase = createClient();
  const viewerId = await currentUserId();

  const { data, error } = await supabase.from('group_runs').select(GROUP_RUN_SELECT).eq('id', id).single();
  if (error || !data) throw new Error(error?.message ?? 'Group run not found.');

  const row = data as unknown as GroupRunRow;
  let myRsvpStatus: RsvpStatus | null = row.host_id === viewerId ? 'approved' : null;
  if (viewerId && row.host_id !== viewerId) {
    const { data: rsvp } = await supabase
      .from('group_run_rsvps')
      .select('status')
      .eq('group_run_id', id)
      .eq('user_id', viewerId)
      .maybeSingle();
    myRsvpStatus = (rsvp?.status as RsvpStatus | undefined) ?? null;
  }
  return buildGroupRun(row, viewerId, myRsvpStatus);
}

/** Upcoming (scheduled/active) group runs for a specific route. */
export async function listGroupRunsForRoute(routeId: string): Promise<GroupRun[]> {
  const supabase = createClient();
  const viewerId = await currentUserId();

  const { data, error } = await supabase
    .from('group_runs')
    .select(GROUP_RUN_SELECT)
    .eq('route_id', routeId)
    .in('status', UPCOMING_STATUSES)
    .order('scheduled_at', { ascending: true });

  if (error) throw new Error(error.message);
  return toGroupRunBatch((data ?? []) as unknown as GroupRunRow[], viewerId);
}

export class FreeJoinLimitError extends Error {}

export async function setGroupRunRsvp(groupRunId: string, rsvped: boolean): Promise<void> {
  const supabase = createClient();
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to RSVP.');

  if (rsvped) {
    const { error } = await supabase.from('group_run_rsvps').insert({ group_run_id: groupRunId, user_id: userId });
    if (error) {
      if (error.message.includes('at capacity')) throw new Error('This run is at capacity.');
      if (error.message.includes('one event at a time')) {
        throw new FreeJoinLimitError('Free accounts can only join one event at a time.');
      }
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase.from('group_run_rsvps').delete().eq('group_run_id', groupRunId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}
