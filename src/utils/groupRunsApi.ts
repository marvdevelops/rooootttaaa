import { supabase } from '../lib/supabase';
import { ActivityType, GroupRun, GroupRunParticipant, GroupRunStatus, RaceCategorySummary, RaceEventSummary, RsvpStatus } from '../types/route';
import { track } from '../lib/analytics';
import { OFFICIAL_ACCOUNT_ID } from '../constants/officialAccount';

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
  start_lat: number | null;
  start_lng: number | null;
  club_id: string | null;
  series_id: string | null;
  category: 'training' | 'race';
  visibility: 'public' | 'club';
  activity_type: ActivityType;
  routes: { name: string; distance_km: number } | { name: string; distance_km: number }[] | null;
  profiles: { username: string } | { username: string }[] | null;
  run_clubs: { name: string; avatar_url: string | null } | { name: string; avatar_url: string | null }[] | null;
}

const GROUP_RUN_SELECT = '*, routes(name, distance_km), profiles!host_id(username), run_clubs(name, avatar_url)';

const UPCOMING_STATUSES: GroupRunStatus[] = ['scheduled', 'active'];

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function unwrapRoute(routes: GroupRunRow['routes']) {
  return Array.isArray(routes) ? routes[0] : routes;
}

function buildGroupRun(
  row: GroupRunRow,
  viewerId: string | null,
  myRsvpStatus: RsvpStatus | null,
  myRole?: 'host' | 'participant',
): GroupRun {
  const route = unwrapRoute(row.routes);
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
    // Admin override for the official account — see routesApi.ts's
    // isOwnedByMe comment and migration 0055 for the RLS backing this.
    isHostedByMe: row.host_id === viewerId || viewerId === OFFICIAL_ACCOUNT_ID,
    isRsvpedByMe: myRsvpStatus === 'approved',
    myRsvpStatus,
    myRole,
    startLat: row.start_lat,
    startLng: row.start_lng,
    clubId: row.club_id,
    clubName: club?.name ?? null,
    clubAvatarUrl: club?.avatar_url ?? null,
    seriesId: row.series_id,
    category: row.category,
    visibility: row.visibility ?? 'public',
    activityType: row.activity_type ?? 'run',
  };
}

async function toGroupRun(
  row: GroupRunRow,
  viewerId: string | null,
  myRole?: 'host' | 'participant',
  myStatusOverride?: RsvpStatus | null,
): Promise<GroupRun> {
  let myRsvpStatus: RsvpStatus | null = myStatusOverride ?? null;
  if (myRole === 'host') {
    myRsvpStatus = 'approved';
  } else if (viewerId && myStatusOverride === undefined && !myRole) {
    const { data } = await supabase
      .from('group_run_rsvps')
      .select('status')
      .eq('group_run_id', row.id)
      .eq('user_id', viewerId)
      .maybeSingle();
    myRsvpStatus = (data?.status as RsvpStatus | undefined) ?? null;
  }

  return buildGroupRun(row, viewerId, myRsvpStatus, myRole);
}

/**
 * Same result as mapping each row through toGroupRun, but fetches this
 * viewer's RSVP status for every row in a single query instead of one round
 * trip per row — listing 20-40 upcoming runs previously meant 20-40
 * concurrent RSVP queries on top of the list query itself, which is what
 * made the group runs / near-you list feel slow to load.
 */
async function toGroupRunBatch(rows: GroupRunRow[], viewerId: string | null): Promise<GroupRun[]> {
  if (rows.length === 0) return [];
  if (!viewerId) return rows.map((row) => buildGroupRun(row, viewerId, null));

  const { data } = await supabase
    .from('group_run_rsvps')
    .select('group_run_id, status')
    .eq('user_id', viewerId)
    .in(
      'group_run_id',
      rows.map((r) => r.id),
    );

  const byRunId = new Map((data ?? []).map((r) => [r.group_run_id as string, r.status as RsvpStatus]));
  return rows.map((row) => {
    const myRole = row.host_id === viewerId ? 'host' : undefined;
    const myRsvpStatus = myRole === 'host' ? 'approved' : (byRunId.get(row.id) ?? null);
    return buildGroupRun(row, viewerId, myRsvpStatus, myRole);
  });
}

export interface RaceMetaInput {
  raceDate: Date;
  raceTimezone?: string;
  organizerName?: string | null;
  organizerLogoUrl?: string | null;
  eventBannerUrl?: string | null;
  eventLogoUrl?: string | null;
  /** Set when this race is a new distance category joining an existing multi-distance event — pass the event's anchor race id (any sibling category's group_run_id works, since they all share the same event_group_id). Omit for a standalone race or the first category of a new event. */
  eventGroupId?: string | null;
  /** The shared event display name ("Milo Marathon 2026"). Pass the existing event's title when adding a category to it; omit to default to this category's own `title` (the normal case — a standalone race or a brand-new event's first category). */
  eventTitle?: string | null;
}

export interface CreateGroupRunInput {
  routeId: string;
  title: string;
  description: string;
  scheduledAt: Date;
  /** null = open to all (paid hosts only — free hosts are still capped at 10 server-side regardless of what's stored here). */
  maxParticipants: number | null;
  /** Tags this run as a club event — shows the club name/avatar on the card and notifies members. */
  clubId?: string | null;
  /** 'club' = only members of `clubId` can see it (requires clubId). Defaults to 'public'. */
  visibility?: 'public' | 'club';
  /** What the event is — run / trail_run / walk / hike / bike. Defaults to the route's own type upstream. */
  activityType?: ActivityType;
  /** Only the official Rootah account is allowed to set this — enforced server-side by the group_runs insert RLS policy. */
  race?: RaceMetaInput | null;
}

export async function createGroupRun(input: CreateGroupRunInput): Promise<GroupRun> {
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
      category: input.race ? 'race' : 'training',
      visibility: input.clubId && input.visibility === 'club' ? 'club' : 'public',
      activity_type: input.activityType ?? 'run',
    })
    .select(GROUP_RUN_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to schedule group run.');

  if (input.race) {
    const newRaceId = (data as { id: string }).id;
    // en-CA gives YYYY-MM-DD, matching race_details.race_date's format.
    const raceDate = new Intl.DateTimeFormat('en-CA', { timeZone: input.race.raceTimezone ?? 'Asia/Manila' }).format(input.race.raceDate);
    const { error: raceDetailsError } = await supabase.from('race_details').insert({
      group_run_id: newRaceId,
      race_date: raceDate,
      race_timezone: input.race.raceTimezone ?? 'Asia/Manila',
      organizer_name: input.race.organizerName ?? null,
      organizer_logo_url: input.race.organizerLogoUrl ?? null,
      event_banner_url: input.race.eventBannerUrl ?? null,
      event_logo_url: input.race.eventLogoUrl ?? null,
      // Joining an existing multi-distance event uses that event's anchor
      // id; otherwise this race becomes its own event's anchor (self-
      // referencing) so "this race's event" is always well-defined —
      // getRaceCategories(eventGroupId) then just returns itself for a
      // standalone race.
      event_group_id: input.race.eventGroupId ?? newRaceId,
      event_title: input.race.eventTitle ?? input.title,
    });
    if (raceDetailsError) throw new Error(raceDetailsError.message);
  }

  track('group_run_scheduled', { max_participants: input.maxParticipants, has_club: !!input.clubId, category: input.race ? 'race' : 'training' });
  return toGroupRun(data as unknown as GroupRunRow, hostId, 'host');
}

export interface UpdateGroupRunInput {
  title: string;
  description: string;
  scheduledAt: Date;
  maxParticipants: number | null;
  /** Change who can see the event. 'club' only allowed on events that belong to a club. */
  visibility?: 'public' | 'club';
  activityType?: ActivityType;
  /** Only relevant for races (category is set at creation and isn't editable here) — updates race_details. */
  race?: RaceMetaInput | null;
}

/** RLS restricts this to the run's own host — see "hosts can update their own group runs" in 0002_social_and_groups.sql. */
export async function updateGroupRun(id: string, input: UpdateGroupRunInput): Promise<GroupRun> {
  const viewerId = await currentUserId();

  const { data, error } = await supabase
    .from('group_runs')
    .update({
      title: input.title,
      description: input.description,
      scheduled_at: input.scheduledAt.toISOString(),
      max_participants: input.maxParticipants,
      ...(input.visibility ? { visibility: input.visibility } : {}),
      ...(input.activityType ? { activity_type: input.activityType } : {}),
    })
    .eq('id', id)
    .select(GROUP_RUN_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to update event.');

  if (input.race) {
    const raceDate = new Intl.DateTimeFormat('en-CA', { timeZone: input.race.raceTimezone ?? 'Asia/Manila' }).format(input.race.raceDate);
    // .select().single() is load-bearing, not decoration — race_details had
    // no UPDATE RLS policy at all until 0052, so this write was silently
    // no-oping (0 rows affected, no error) for months. This makes the same
    // class of bug throw instead of silently succeeding if it regresses.
    const { error: raceDetailsError, data: raceDetailsData } = await supabase
      .from('race_details')
      .update({
        race_date: raceDate,
        organizer_name: input.race.organizerName ?? null,
        organizer_logo_url: input.race.organizerLogoUrl ?? null,
        event_banner_url: input.race.eventBannerUrl ?? null,
        event_logo_url: input.race.eventLogoUrl ?? null,
      })
      .eq('group_run_id', id)
      .select('group_run_id')
      .single();
    if (raceDetailsError || !raceDetailsData) throw new Error(raceDetailsError?.message ?? 'Failed to update race details.');
  }

  return toGroupRun(data as unknown as GroupRunRow, viewerId, 'host');
}

/** All upcoming (scheduled/active) group runs, soonest first — never includes archived runs. */
/** Keeps only the next occurrence per series (already sorted soonest-first) so a weekly run doesn't show 4+ near-duplicate cards — non-recurring runs are always kept. */
function dedupeBySeries(runs: GroupRun[]): GroupRun[] {
  const seenSeries = new Set<string>();
  return runs.filter((run) => {
    if (!run.seriesId) return true;
    if (seenSeries.has(run.seriesId)) return false;
    seenSeries.add(run.seriesId);
    return true;
  });
}

export async function listUpcomingGroupRuns(limit = 40): Promise<GroupRun[]> {
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

/** Upcoming races only, soonest first — for the discover screen's races strip (replaces the old "popular routes" strip there). */
export async function listUpcomingRaces(limit = 20): Promise<GroupRun[]> {
  const viewerId = await currentUserId();

  const { data, error } = await supabase
    .from('group_runs')
    .select(GROUP_RUN_SELECT)
    .eq('category', 'race')
    .in('status', UPCOMING_STATUSES)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as GroupRunRow[];
  return toGroupRunBatch(rows, viewerId);
}

/**
 * Same upcoming races, grouped into one entry per multi-distance event
 * (event_group_id) instead of one per distance category — what the browse
 * screens actually want to show. A standalone single-distance race is just
 * a group of one. See docs/race-mode-plan.md's distance-categories section
 * for why this is a client-side grouping over ordinary group_runs rows
 * rather than a dedicated events table.
 */
export async function listUpcomingRaceEvents(limit = 20): Promise<RaceEventSummary[]> {
  const races = await listUpcomingRaces(limit);
  if (races.length === 0) return [];

  const { data: detailsRows, error } = await supabase
    .from('race_details')
    .select('group_run_id, event_group_id, event_title')
    .in(
      'group_run_id',
      races.map((r) => r.id),
    );
  if (error) throw new Error(error.message);

  const detailsByRunId = new Map(
    (detailsRows ?? []).map((row) => [row.group_run_id as string, { eventGroupId: row.event_group_id as string | null, eventTitle: row.event_title as string | null }]),
  );

  const eventsByGroupId = new Map<string, RaceEventSummary>();
  for (const race of races) {
    const details = detailsByRunId.get(race.id);
    const eventGroupId = details?.eventGroupId ?? race.id;
    const category: RaceCategorySummary = { groupRunId: race.id, title: race.title, routeDistanceKm: race.routeDistanceKm, scheduledAt: race.scheduledAt };

    const existing = eventsByGroupId.get(eventGroupId);
    if (existing) {
      existing.categories.push(category);
      existing.rsvpCount += race.rsvpCount;
      if (race.scheduledAt < existing.scheduledAt) {
        existing.scheduledAt = race.scheduledAt;
        existing.primaryGroupRunId = race.id;
      }
    } else {
      eventsByGroupId.set(eventGroupId, {
        eventGroupId,
        eventTitle: details?.eventTitle ?? race.title,
        primaryGroupRunId: race.id,
        scheduledAt: race.scheduledAt,
        rsvpCount: race.rsvpCount,
        categories: [category],
      });
    }
  }

  for (const event of eventsByGroupId.values()) event.categories.sort((a, b) => a.routeDistanceKm - b.routeDistanceKm);
  return Array.from(eventsByGroupId.values()).sort((a, b) => a.scheduledAt - b.scheduledAt);
}

/**
 * Upcoming runs within `radiusKm` of the given point, closest first — a real
 * geographic search (Haversine, via the nearby_group_runs RPC) rather than
 * an exact city-string match, so a run just across a city boundary still
 * shows up. Falls back to all upcoming runs nationwide when location is
 * null (permission denied / not yet resolved).
 */
export async function listRunsNearLocation(
  location: { latitude: number; longitude: number } | null,
  radiusKm = 50,
  limit = 20,
): Promise<GroupRun[]> {
  if (!location) return listUpcomingGroupRuns(limit);

  const viewerId = await currentUserId();

  const { data: nearby, error: rpcError } = await supabase.rpc('nearby_group_runs', {
    user_lat: location.latitude,
    user_lng: location.longitude,
    radius_km: radiusKm,
    result_limit: limit,
  });
  if (rpcError) throw new Error(rpcError.message);
  if (!nearby || nearby.length === 0) return [];

  // Order from the RPC (distance from the search point) — the app displays
  // distance from the user's actual GPS location separately, computed
  // client-side, since the search point here may just be the map's current
  // viewport center rather than where the user actually is.
  const order = new Map<string, number>((nearby as { id: string }[]).map((r, i) => [r.id, i]));
  const { data, error } = await supabase
    .from('group_runs')
    .select(GROUP_RUN_SELECT)
    .in('id', Array.from(order.keys()));
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as GroupRunRow[];
  const runs = await toGroupRunBatch(rows, viewerId);
  // The .in() query above doesn't preserve the RPC's distance ordering.
  const sorted = runs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return dedupeBySeries(sorted);
}

export async function getGroupRun(id: string): Promise<GroupRun> {
  const viewerId = await currentUserId();

  const { data, error } = await supabase.from('group_runs').select(GROUP_RUN_SELECT).eq('id', id).single();

  if (error || !data) throw new Error(error?.message ?? 'Group run not found.');
  return toGroupRun(data as unknown as GroupRunRow, viewerId);
}

/** Upcoming (scheduled/active) group runs for a specific route — never includes archived runs. */
export async function listGroupRunsForRoute(routeId: string): Promise<GroupRun[]> {
  const viewerId = await currentUserId();

  const { data, error } = await supabase
    .from('group_runs')
    .select(GROUP_RUN_SELECT)
    .eq('route_id', routeId)
    .in('status', UPCOMING_STATUSES)
    .order('scheduled_at', { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as GroupRunRow[];
  return toGroupRunBatch(rows, viewerId);
}

/** Upcoming (scheduled/active) group runs tagged to a club — for the club profile's Events tab. */
export async function listClubEvents(clubId: string): Promise<GroupRun[]> {
  const viewerId = await currentUserId();

  const { data, error } = await supabase
    .from('group_runs')
    .select(GROUP_RUN_SELECT)
    .eq('club_id', clubId)
    .in('status', UPCOMING_STATUSES)
    .order('scheduled_at', { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as GroupRunRow[];
  return toGroupRunBatch(rows, viewerId);
}

/** Thrown when a free-tier user tries to RSVP to a second event — callers should open the paywall rather than show a plain error. */
export class FreeJoinLimitError extends Error {}

/**
 * Requests to join (rsvped=true) create a 'pending' row — the host has to
 * approve it before it counts as attending. Un-RSVPing (false) withdraws the
 * request/attendance outright, whatever its current status.
 */
export async function setGroupRunRsvp(groupRunId: string, rsvped: boolean): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to RSVP.');

  if (rsvped) {
    const { error } = await supabase
      .from('group_run_rsvps')
      .insert({ group_run_id: groupRunId, user_id: userId });
    // The DB triggers raise plain messages for these two cases — pass them
    // through as a typed/friendly error rather than Postgres's wrapped text.
    if (error) {
      if (error.message.includes('at capacity')) throw new Error('This run is at capacity.');
      if (error.message.includes('one event at a time')) {
        throw new FreeJoinLimitError('Free accounts can only join one event at a time.');
      }
      throw new Error(error.message);
    }
    track('group_run_rsvp', { group_run_id: groupRunId });
  } else {
    const { error } = await supabase
      .from('group_run_rsvps')
      .delete()
      .eq('group_run_id', groupRunId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
  }
}

/** Host-only: approve or decline a pending (or previously-decided) join request. */
export async function respondToJoinRequest(
  groupRunId: string,
  userId: string,
  approve: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('group_run_rsvps')
    .update({ status: approve ? 'approved' : 'declined' })
    .eq('group_run_id', groupRunId)
    .eq('user_id', userId);
  if (error) {
    if (error.message.includes('at capacity')) throw new Error('This run is at capacity.');
    throw new Error(error.message);
  }
}

interface ParticipantRow {
  user_id: string;
  status: RsvpStatus;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
}

/**
 * Everyone who's requested/joined a run. RLS scopes what comes back: the
 * host sees every status (for the approve/decline queue), a regular viewer
 * only sees approved rows plus their own pending/declined request.
 */
export async function listGroupRunParticipants(groupRunId: string): Promise<GroupRunParticipant[]> {
  const { data, error } = await supabase
    .from('group_run_rsvps')
    .select('user_id, status, created_at, profiles(username, avatar_url)')
    .eq('group_run_id', groupRunId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ParticipantRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: row.user_id,
      username: profile?.username ?? 'unknown',
      avatarUrl: profile?.avatar_url ?? null,
      status: row.status,
      requestedAt: new Date(row.created_at).getTime(),
    };
  });
}

/** Cheap count for gate checks — how many upcoming (scheduled/active) runs the current user is hosting. */
export async function countMyActiveGroupRuns(): Promise<number> {
  const hostId = await currentUserId();
  if (!hostId) return 0;

  const { count, error } = await supabase
    .from('group_runs')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', hostId)
    .in('status', UPCOMING_STATUSES);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function cancelGroupRun(id: string): Promise<void> {
  // .select() is load-bearing — a DELETE that RLS filters to zero rows returns
  // no error and no data, so without this an unauthorised delete would look
  // like it succeeded. Now it throws instead.
  const { data, error } = await supabase.from('group_runs').delete().eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('You do not have permission to delete this event.');
  }
}

interface RsvpEmbedRow {
  status: RsvpStatus;
  group_runs: GroupRunRow | GroupRunRow[] | null;
}

async function fetchJoinedRuns(
  profileUserId: string,
  statuses: GroupRunStatus[],
  rsvpStatuses: RsvpStatus[],
  ascending: boolean,
): Promise<GroupRun[]> {
  const { data, error } = await supabase
    .from('group_run_rsvps')
    .select(`status, group_runs!inner(${GROUP_RUN_SELECT})`)
    .eq('user_id', profileUserId)
    .in('status', rsvpStatuses)
    .in('group_runs.status', statuses)
    .neq('group_runs.host_id', profileUserId)
    .order('scheduled_at', { referencedTable: 'group_runs', ascending });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as RsvpEmbedRow[];
  return Promise.all(
    rows
      .filter((row): row is RsvpEmbedRow & { group_runs: GroupRunRow | GroupRunRow[] } => !!row.group_runs)
      .map((row) => {
        const run = Array.isArray(row.group_runs) ? row.group_runs[0] : row.group_runs;
        return { run, status: row.status };
      })
      .filter((r): r is { run: GroupRunRow; status: RsvpStatus } => !!r.run)
      .map(({ run, status }) => toGroupRun(run, profileUserId, 'participant', status)),
  );
}

/** Runs shown on a profile: created by them + joined/requested (not created), scheduled/active only, soonest first. A run both hosted and RSVP'd to appears once, as host. */
export async function fetchUpcomingEvents(profileUserId: string): Promise<GroupRun[]> {
  const [hosted, joined] = await Promise.all([
    supabase
      .from('group_runs')
      .select(GROUP_RUN_SELECT)
      .eq('host_id', profileUserId)
      .in('status', UPCOMING_STATUSES)
      .order('scheduled_at', { ascending: true }),
    fetchJoinedRuns(profileUserId, UPCOMING_STATUSES, ['pending', 'approved'], true),
  ]);

  if (hosted.error) throw new Error(hosted.error.message);
  const hostedRuns = await Promise.all(
    ((hosted.data ?? []) as unknown as GroupRunRow[]).map((row) => toGroupRun(row, profileUserId, 'host')),
  );

  return [...hostedRuns, ...joined].sort((a, b) => a.scheduledAt - b.scheduledAt);
}

/** Archived runs the user hosted or actually attended (approved), most recent first. Only ever call this for the signed-in user's own profile — it's meant to be private. */
export async function fetchPastEvents(userId: string): Promise<GroupRun[]> {
  const [hosted, joined] = await Promise.all([
    supabase
      .from('group_runs')
      .select(GROUP_RUN_SELECT)
      .eq('host_id', userId)
      .eq('status', 'archived')
      .order('scheduled_at', { ascending: false }),
    fetchJoinedRuns(userId, ['archived'], ['approved'], false),
  ]);

  if (hosted.error) throw new Error(hosted.error.message);
  const hostedRuns = await Promise.all(
    ((hosted.data ?? []) as unknown as GroupRunRow[]).map((row) => toGroupRun(row, userId, 'host')),
  );

  return [...hostedRuns, ...joined].sort((a, b) => b.scheduledAt - a.scheduledAt);
}
