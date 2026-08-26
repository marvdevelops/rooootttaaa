import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import LiveMapClient from './LiveMapClient';

interface Props {
  params: Promise<{ token: string }>;
}

interface RaceLivePositionRow {
  rsvp_id: string;
  race_title: string;
  route_id: string;
  athlete_username: string;
  athlete_avatar_url: string | null;
  status: 'pending' | 'approved' | 'declined';
  last_lat: number | null;
  last_lng: number | null;
  last_distance_meters: number | null;
  last_pace_seconds_per_km: number | null;
  last_updated_at: string | null;
  started_at: string | null;
  finish_time_seconds: number | null;
}

async function fetchPosition(token: string): Promise<RaceLivePositionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_race_live_position', { token });
  return (data as RaceLivePositionRow[] | null)?.[0] ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const row = await fetchPosition(token);
  if (!row) return { title: 'Live tracking not found — Rootah' };

  const title = `${row.athlete_username} · ${row.race_title} — Live on Rootah`;
  const description = `Watch ${row.athlete_username}'s live position, pace, and distance during ${row.race_title}.`;

  return {
    title,
    description,
    // Never indexable — this is a private link shared directly, not a discoverable page.
    robots: { index: false, follow: false },
    openGraph: { type: 'website', title, description },
  };
}

export default async function LiveTrackingPage({ params }: Props) {
  const { token } = await params;
  const row = await fetchPosition(token);
  if (!row) notFound();

  return (
    <LiveMapClient
      token={token}
      initial={{
        rsvpId: row.rsvp_id,
        raceTitle: row.race_title,
        routeId: row.route_id,
        athleteUsername: row.athlete_username,
        athleteAvatarUrl: row.athlete_avatar_url,
        status: row.status,
        lastLat: row.last_lat,
        lastLng: row.last_lng,
        lastDistanceMeters: row.last_distance_meters,
        lastPaceSecondsPerKm: row.last_pace_seconds_per_km,
        lastUpdatedAt: row.last_updated_at ? new Date(row.last_updated_at).getTime() : null,
        startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
        finishTimeSeconds: row.finish_time_seconds,
      }}
    />
  );
}
