import { supabase } from './supabase';

export interface PublicClubEvent {
  id: string;
  title: string;
  scheduledAt: string;
  routeName: string | null;
  rsvpCount: number;
}

export interface PublicClub {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  avatarUrl: string | null;
  memberCount: number;
  upcomingEvents: PublicClubEvent[];
}

interface ClubRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  avatar_url: string | null;
  member_count: number;
  is_private: boolean;
}

interface EventRow {
  id: string;
  title: string;
  scheduled_at: string;
  routes: { name: string } | { name: string }[] | null;
  rsvps: { count: number }[] | null;
}

function unwrap<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** RLS only returns non-private clubs for anonymous reads (see 0026_run_clubs.sql). */
export async function getPublicClub(slug: string): Promise<PublicClub | null> {
  const { data, error } = await supabase.from('run_clubs').select('*').eq('slug', slug).single();
  if (error || !data) return null;

  const row = data as ClubRow;
  if (row.is_private) return null;

  const { data: eventRows } = await supabase
    .from('group_runs')
    .select('id, title, scheduled_at, routes:route_id(name), rsvps:group_run_rsvps(count)')
    .eq('club_id', row.id)
    .in('status', ['scheduled', 'active'])
    .order('scheduled_at', { ascending: true })
    .limit(10);

  const upcomingEvents = ((eventRows ?? []) as unknown as EventRow[]).map((e) => {
    const route = unwrap(e.routes);
    return {
      id: e.id,
      title: e.title,
      scheduledAt: e.scheduled_at,
      routeName: route?.name ?? null,
      rsvpCount: e.rsvps?.[0]?.count ?? 0,
    };
  });

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    city: row.city,
    avatarUrl: row.avatar_url,
    memberCount: row.member_count,
    upcomingEvents,
  };
}
