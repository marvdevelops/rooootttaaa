import type { Metadata } from 'next';
import { createClient } from '../../lib/supabase/server';
import { activityLabel, toLiveSession, type LiveSession, type LiveSessionRow } from '../../lib/liveSessionsApi';
import LiveMapClient from './LiveMapClient';
import LiveSessionClient from './LiveSessionClient';

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

function ogImage(token: string) {
  return { url: `/live/og?token=${encodeURIComponent(token)}`, width: 1200, height: 630 };
}

const NOUN: Record<string, string> = {
  hike: 'hike',
  bike: 'ride',
  walk: 'walk',
  trail_run: 'trail run',
  run: 'run',
  other: 'activity',
};
const VERB: Record<string, string> = {
  hike: 'hiking',
  bike: 'riding',
  walk: 'walking',
  trail_run: 'trail running',
  run: 'running',
  other: 'out on an activity',
};

function meta(title: string, description: string, token: string): Metadata {
  const url = `https://app.rootah.com/live/${token}`;
  return {
    title,
    description,
    ...NOINDEX,
    // Override the site-wide canonical from the root layout — without this,
    // scrapers (Facebook, etc.) follow rel="canonical" to app.rootah.com and
    // show the homepage card instead of this activity.
    alternates: { canonical: url },
    openGraph: { type: 'website', title, description, url, images: [ogImage(token)] },
  };
}

export async function buildLiveMetadata(token: string): Promise<Metadata> {
  try {
    return await buildLiveMetadataInner(token);
  } catch {
    // Never let a metadata error bubble — Next would silently fall back to the
    // site's default card, which is exactly the bug this route exists to fix.
    return meta('Live activity on Rootah', 'Follow this activity live on the map.', token);
  }
}

async function buildLiveMetadataInner(token: string): Promise<Metadata> {
  const race = await fetchRacePosition(token);
  if (race) {
    const done = race.finish_time_seconds != null;
    return done
      ? meta(
          `${race.athlete_username} finished ${race.race_title}`,
          `See how ${race.athlete_username}'s race went — finish time, pace, and the full course.`,
          token,
        )
      : meta(
          `Follow ${race.athlete_username} — racing ${race.race_title} live`,
          `They're on the course right now. Watch their position, pace, and distance update in real time, and send a cheer.`,
          token,
        );
  }

  const session = await fetchLiveSession(token);
  if (session) {
    const noun = NOUN[session.activityType] ?? 'run';
    const verb = VERB[session.activityType] ?? 'moving';
    const done = session.status === 'ended';
    return done
      ? meta(
          `${session.athleteUsername} just finished a ${noun}`,
          `See how the ${noun} went — distance, pace, and the route on Rootah.`,
          token,
        )
      : meta(
          `Follow ${session.athleteUsername} live — ${verb} right now`,
          `Watch them move on the map. Live position, pace, and distance, updating every few seconds. No app needed.`,
          token,
        );
  }

  return meta(
    'This live link isn’t active',
    'The activity has ended or the link has expired.',
    token,
  );
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

  // Dead / expired token — a friendly branded page rather than a bare 404, so
  // an old shared link still lands somewhere that makes sense.
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
        background: 'var(--cream, #F2EDE5)',
        color: 'var(--ink, #1A1614)',
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>This live link isn’t active</h1>
      <p style={{ fontSize: 15, color: 'var(--stone, #8C8078)', margin: 0, maxWidth: 320 }}>
        The activity has ended or the link has expired.
      </p>
      <a
        href="https://rootah.com/#download"
        style={{
          marginTop: 8,
          padding: '12px 22px',
          borderRadius: 999,
          background: 'var(--coral, #E84B2A)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          textDecoration: 'none',
        }}
      >
        Get Rootah
      </a>
    </div>
  );
}

export { activityLabel };
