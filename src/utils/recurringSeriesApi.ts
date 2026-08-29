import { supabase } from '../lib/supabase';
import { RecurrenceFrequency, RecurringSeries } from '../types/recurringSeries';
import { GroupRun } from '../types/route';

interface SeriesRow {
  id: string;
  host_id: string;
  route_id: string;
  club_id: string | null;
  title: string;
  description: string;
  frequency: RecurrenceFrequency;
  start_time: string;
  series_start_date: string;
  series_end_date: string | null;
  is_active: boolean;
}

function toSeries(row: SeriesRow): RecurringSeries {
  return {
    id: row.id,
    hostId: row.host_id,
    routeId: row.route_id,
    clubId: row.club_id,
    title: row.title,
    description: row.description,
    frequency: row.frequency,
    startTime: row.start_time,
    seriesStartDate: row.series_start_date,
    seriesEndDate: row.series_end_date,
    isActive: row.is_active,
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export interface CreateSeriesInput {
  routeId: string;
  clubId?: string | null;
  /** 'club' hides the series (and every occurrence it generates) from non-members. Requires clubId. */
  visibility?: 'public' | 'club';
  title: string;
  description: string;
  /** The first occurrence's date + time — sets series_start_date, day_of_week/day_of_month, and start_time. */
  firstOccurrenceAt: Date;
  frequency: RecurrenceFrequency;
  endDate: Date | null;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Creates the series, auto-subscribes the host, and generates the first occurrence(s) immediately. */
export async function createSeries(input: CreateSeriesInput): Promise<RecurringSeries> {
  const hostId = await currentUserId();
  if (!hostId) throw new Error('You must be signed in to schedule a series.');

  const { data, error } = await supabase
    .from('recurring_series')
    .insert({
      host_id: hostId,
      route_id: input.routeId,
      club_id: input.clubId ?? null,
      visibility: input.clubId && input.visibility === 'club' ? 'club' : 'public',
      title: input.title,
      description: input.description,
      start_time: toTimeString(input.firstOccurrenceAt),
      frequency: input.frequency,
      day_of_week: input.firstOccurrenceAt.getDay(),
      day_of_month: input.firstOccurrenceAt.getDate(),
      series_start_date: toDateString(input.firstOccurrenceAt),
      series_end_date: input.endDate ? toDateString(input.endDate) : null,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create recurring series.');
  const series = toSeries(data as SeriesRow);

  const { error: subError } = await supabase
    .from('series_subscriptions')
    .insert({ series_id: series.id, user_id: hostId });
  if (subError) throw new Error(subError.message);

  const { error: genError } = await supabase.rpc('generate_occurrences_for_series', { p_series_id: series.id });
  if (genError) throw new Error(genError.message);

  return series;
}

/** The earliest upcoming occurrence for a freshly created series — for navigating to it right after creation. */
export async function getFirstUpcomingOccurrence(seriesId: string): Promise<GroupRun | null> {
  const { data } = await supabase
    .from('group_runs')
    .select('id')
    .eq('series_id', seriesId)
    .in('status', ['scheduled', 'active'])
    .order('occurrence_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const { getGroupRun } = await import('./groupRunsApi');
  return getGroupRun(data.id);
}

export async function isSubscribedToSeries(seriesId: string): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  const { data } = await supabase
    .from('series_subscriptions')
    .select('user_id')
    .eq('series_id', seriesId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/** Subscribes and auto-RSVPs to every existing future occurrence. */
export async function subscribeToSeries(seriesId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new Error('You must be signed in to subscribe.');

  const { error } = await supabase.from('series_subscriptions').insert({ series_id: seriesId, user_id: userId });
  if (error) throw new Error(error.message);

  const { data: future } = await supabase
    .from('group_runs')
    .select('id')
    .eq('series_id', seriesId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString());

  if (future && future.length > 0) {
    await supabase
      .from('group_run_rsvps')
      .upsert(
        future.map((f) => ({ group_run_id: f.id, user_id: userId, status: 'approved' })),
        { onConflict: 'group_run_id,user_id' },
      );
  }
}

/** Unsubscribes and removes RSVPs from future occurrences only — past attendance stays on record. */
export async function unsubscribeFromSeries(seriesId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('series_subscriptions')
    .delete()
    .eq('series_id', seriesId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);

  const { data: future } = await supabase
    .from('group_runs')
    .select('id')
    .eq('series_id', seriesId)
    .gte('scheduled_at', new Date().toISOString());

  if (future && future.length > 0) {
    await supabase
      .from('group_run_rsvps')
      .delete()
      .eq('user_id', userId)
      .in('group_run_id', future.map((f) => f.id));
  }
}

export interface SeriesOccurrence {
  id: string;
  scheduledAt: number;
  status: string;
  rsvpCount: number;
}

export async function listSeriesOccurrences(seriesId: string): Promise<SeriesOccurrence[]> {
  const { data, error } = await supabase
    .from('group_runs')
    .select('id, scheduled_at, status, approved_count')
    .eq('series_id', seriesId)
    .in('status', ['scheduled', 'active'])
    .order('scheduled_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    scheduledAt: new Date(row.scheduled_at).getTime(),
    status: row.status,
    rsvpCount: row.approved_count ?? 0,
  }));
}

export async function endSeries(seriesId: string): Promise<void> {
  const { error: seriesError } = await supabase
    .from('recurring_series')
    .update({ is_active: false })
    .eq('id', seriesId);
  if (seriesError) throw new Error(seriesError.message);

  const { error: runsError } = await supabase
    .from('group_runs')
    .update({ status: 'cancelled' })
    .eq('series_id', seriesId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString());
  if (runsError) throw new Error(runsError.message);
}
