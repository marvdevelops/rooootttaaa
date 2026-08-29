import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '../../../lib/supabase/server';
import { activityLabel, toLiveSession, type LiveSession, type LiveSessionRow } from '../../../lib/liveSessionsApi';
import LiveMapClient from './LiveMapClient';
import LiveSessionClient from './LiveSessionClient';

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
  live_view_count: number;
}

async function fetchRacePosition(token: string): Promise<RaceLivePositionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_race_live_position', { token });
  return (data as RaceLivePositionRow[] | null)?.[0] ?? null;
}

async function fetchLiveSession(token: string): Promise<LiveSession | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_live_session', { token });
  const row = (data as LiveSessionRow[] | null)?.[0];
  return row ? toLiveSession(row) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const noindex = { robots: { index: false, follow: false } } as const;

  const race = await fetchRacePosition(token);
  if (race) {
    const isFinished = race.finish_time_seconds != null;
    const title = isFinished
      ? `${race.athlete_username} finished ${race.race_title} — Rootah`
      : `🔴 ${race.athlete_username} is live in ${race.race_title} — Rootah`;
    const description = isFinished
      ? `${race.athlete_username} just finished ${race.race_title}. See their finish time, pace, and the course on Rootah.`
      : `${race.athlete_username} is racing ${race.race_title} right now. Follow their live position, pace, and distance on the course — and send a quick cheer.`;
    return { title, description, ...noindex, openGraph: { type: 'website', title, description } };
  }

  const session = await fetchLiveSession(token);
  if (session) {
    const label = activityLabel(session.activityType);
    const title = `🔴 ${session.athleteUsername} is on a live ${label} — Rootah`;
    const description = `Follow ${session.athleteUsername}'s live position, pace, and distance on their ${label}.`;
    return { title, description, ...noindex, openGraph: { type: 'website', title, description } };
  }

  return { title: 'Live tracking not found — Rootah', ...noindex };
}

export default async function LiveTrackingPage({ params }: Props) {
  const { token } = await params;

  const race = await fetchRacePosition(token);
  if (race) {
    return (
      <LiveMapClient
        token={token}
        initial={{
          rsvpId: race.rsvp_id,
          raceTitle: race.race_title,
          routeId: race.route_id,
          athleteUsername: race.athlete_username,
          athleteAvatarUrl: race.athlete_avatar_url,
          status: race.status,
          lastLat: race.last_lat,
          lastLng: race.last_lng,
          lastDistanceMeters: race.last_distance_meters,
          lastPaceSecondsPerKm: race.last_pace_seconds_per_km,
          lastUpdatedAt: race.last_updated_at ? new Date(race.last_updated_at).getTime() : null,
          startedAt: race.started_at ? new Date(race.started_at).getTime() : null,
          finishTimeSeconds: race.finish_time_seconds,
          liveViewCount: race.live_view_count,
        }}
      />
    );
  }

  const session = await fetchLiveSession(token);
  if (session) {
    return <LiveSessionClient token={token} initial={session} />;
  }

  notFound();
}
