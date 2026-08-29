import { ImageResponse } from 'next/og';
import { createClient } from '../../lib/supabase/server';

export const ogSize = { width: 1200, height: 630 };

interface RaceRow {
  race_title: string;
  athlete_username: string;
  finish_time_seconds: number | null;
  last_distance_meters: number | null;
  last_pace_seconds_per_km: number | null;
}
interface SessionRow {
  athlete_username: string;
  activity_type: string;
  status: string;
  last_distance_meters: number | null;
  last_pace_seconds_per_km: number | null;
}

function verb(activity: string): string {
  return (
    { hike: 'hiking', bike: 'riding', walk: 'walking', trail_run: 'trail running', run: 'running', other: 'moving' }[
      activity
    ] ?? 'running'
  );
}

function noun(activity: string): string {
  return (
    { hike: 'hike', bike: 'ride', walk: 'walk', trail_run: 'trail run', run: 'run', other: 'activity' }[activity] ??
    'run'
  );
}

function pace(secPerKm: number | null): string | null {
  if (!secPerKm) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function renderLiveOg(token: string) {
  const supabase = await createClient();
  const [{ data: raceData }, { data: sessionData }] = await Promise.all([
    supabase.rpc('get_race_live_position', { token }),
    supabase.rpc('get_live_session', { token }),
  ]);
  const race = (raceData as RaceRow[] | null)?.[0] ?? null;
  const session = (sessionData as SessionRow[] | null)?.[0] ?? null;

  let name = 'A Rootah runner';
  let line = 'is out on a live activity';
  let state: 'live' | 'done' = 'live';
  let doneLabel = 'Activity finished';
  let distanceM: number | null = null;
  let paceSecPerKm: number | null = null;

  if (race) {
    name = race.athlete_username;
    state = race.finish_time_seconds != null ? 'done' : 'live';
    line = state === 'done' ? `finished ${race.race_title}` : `is racing ${race.race_title}`;
    doneLabel = 'Race finished';
    distanceM = race.last_distance_meters;
    paceSecPerKm = race.last_pace_seconds_per_km;
  } else if (session) {
    name = session.athlete_username;
    state = session.status === 'ended' ? 'done' : 'live';
    line = state === 'done' ? `finished a ${noun(session.activity_type)}` : `is ${verb(session.activity_type)} right now`;
    doneLabel = `${noun(session.activity_type)} finished`;
    distanceM = session.last_distance_meters;
    paceSecPerKm = session.last_pace_seconds_per_km;
  }

  const km = distanceM && distanceM > 20 ? (distanceM / 1000).toFixed(1) : null;
  const paceStr = pace(paceSecPerKm);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#F2EDE5', fontFamily: 'sans-serif' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 56px',
            width: 720,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 15,
                background: '#E84B2A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width={30} height={35} viewBox="-8 -4 116 136">
                <path
                  d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
                  stroke="#fff"
                  strokeWidth={10}
                  fill="none"
                  strokeLinecap="square"
                />
                <circle cx={26} cy={24} r={22} fill="#fff" />
                <circle cx={74} cy={104} r={19} fill="#fff" />
                <circle cx={74} cy={104} r={5} fill="#E84B2A" />
              </svg>
            </div>
            <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, color: '#1A1614' }}>rootah</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              {state === 'live' && (
                <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: '#E84B2A' }} />
              )}
              <div
                style={{
                  display: 'flex',
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#E84B2A',
                  textTransform: 'uppercase',
                  letterSpacing: 3,
                }}
              >
                {state === 'live' ? 'Live now' : doneLabel}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 66,
                fontWeight: 800,
                color: '#1A1614',
                lineHeight: 1.05,
                letterSpacing: -2,
              }}
            >
              {name}
            </div>
            <div style={{ display: 'flex', fontSize: 30, color: '#8C8078', marginTop: 10 }}>{line}</div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            {km ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#fff',
                  borderRadius: 18,
                  padding: '18px 26px',
                }}
              >
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#1A1614' }}>{km} km</div>
                <div
                  style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: '#8C8078', textTransform: 'uppercase' }}
                >
                  {state === 'done' ? 'Covered' : 'So far'}
                </div>
              </div>
            ) : null}
            {paceStr ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: '#4BABB8',
                  borderRadius: 18,
                  padding: '18px 26px',
                }}
              >
                <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#fff' }}>{paceStr}</div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,.85)',
                    textTransform: 'uppercase',
                  }}
                >
                  Pace /km
                </div>
              </div>
            ) : null}
            {!km && !paceStr ? (
              <div
                style={{
                  display: 'flex',
                  background: '#E84B2A',
                  color: '#fff',
                  fontSize: 20,
                  fontWeight: 800,
                  borderRadius: 999,
                  padding: '16px 28px',
                }}
              >
                Tap to follow along →
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            width: 480,
            height: '100%',
            background: '#E84B2A',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width={220} height={258} viewBox="-8 -4 116 136">
            <path
              d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={10}
              fill="none"
              strokeLinecap="square"
            />
            <circle cx={26} cy={24} r={22} fill="rgba(255,255,255,0.9)" />
            <circle cx={74} cy={104} r={19} fill="rgba(255,255,255,0.9)" />
            <circle cx={74} cy={104} r={5} fill="#E84B2A" />
          </svg>
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
