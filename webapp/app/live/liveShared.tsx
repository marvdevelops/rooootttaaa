import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';
import { activityLabel, toLiveSession, type LiveSession, type LiveSessionRow } from '../../lib/liveSessionsApi';
import LiveMapClient from './[token]/LiveMapClient';
import LiveSessionClient from './[token]/LiveSessionClient';

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

export async function fetchRacePosition(token: string): Promise<RaceLivePositionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_race_live_position', { token });
  return (data as RaceLivePositionRow[] | null)?.[0] ?? null;
}

export async function fetchLiveSession(token: string): Promise<LiveSession | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_live_session', { token });
  const row = (data as LiveSessionRow[] | null)?.[0];
  return row ? toLiveSession(row) : null;
}

const NOINDEX = { robots: { index: false, follow: false } } as const;

/** Activity-aware verb for copy: "running", "hiking", "riding", … */
function activityVerb(activityType: string): string {
  switch (activityType) {
    case 'hike':
      return 'hiking';
    case 'bike':
      return 'riding';
    case 'walk':
      return 'walking';
    case 'trail_run':
      return 'trail running';
    default:
      return 'running';
  }
}

export async function buildLiveMetadata(token: string): Promise<Metadata> {
  const race = await fetchRacePosition(token);
  if (race) {
    const isFinished = race.finish_time_seconds != null;
    const title = isFinished
      ? `${race.athlete_username} finished ${race.race_title}`
      : `${race.athlete_username} is racing ${race.race_title} — live`;
    const description = isFinished
      ? `See ${race.athlete_username}'s finish time, pace, and the course on Rootah.`
      : `Track ${race.athlete_username}'s position, pace, and distance on the course in real time — and send them a cheer.`;
    return { title, description, ...NOINDEX, openGraph: { type: 'website', title, description } };
  }

  const session = await fetchLiveSession(token);
  if (session) {
    const verb = activityVerb(session.activityType);
    const ended = session.status === 'ended';
    const title = ended
      ? `${session.athleteUsername} was ${verb} — live tracking on Rootah`
      : `${session.athleteUsername} is ${verb} right now — track them live`;
    const description = ended
      ? `${session.athleteUsername}'s live activity has ended. Track your own runs and share them with Rootah.`
      : `Follow ${session.athleteUsername} on the map as they go — live position, pace, and distance, updating every few seconds.`;
    return { title, description, ...NOINDEX, openGraph: { type: 'website', title, description } };
  }

  return { title: 'This live link isn’t active', description: 'It may have ended or expired.', ...NOINDEX };
}

export async function renderLivePage(token: string) {
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

export { activityLabel };
