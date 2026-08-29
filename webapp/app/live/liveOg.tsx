import { ImageResponse } from 'next/og';
import { createClient } from '../../lib/supabase/server';

export const ogSize = { width: 1200, height: 630 };

const CREAM = '#F2EDE5';
const INK = '#1A1614';
const STONE = '#8C8078';
const CORAL = '#E84B2A';

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
  last_elapsed_seconds: number | null;
  last_pace_seconds_per_km: number | null;
}

const NOUN: Record<string, string> = {
  run: 'run',
  trail_run: 'trail run',
  hike: 'hike',
  bike: 'ride',
  walk: 'walk',
  other: 'activity',
};
const VERB: Record<string, string> = {
  run: 'running',
  trail_run: 'trail running',
  hike: 'hiking',
  bike: 'riding',
  walk: 'walking',
  other: 'out',
};

function pace(secPerKm: number | null): string | null {
  if (!secPerKm || secPerKm <= 0) return null;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function duration(sec: number | null): string | null {
  if (!sec || sec <= 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export async function renderLiveOg(token: string) {
  const supabase = await createClient();
  const [{ data: raceData }, { data: sessionData }] = await Promise.all([
    supabase.rpc('get_race_live_position', { token }),
    supabase.rpc('get_live_session', { token }),
  ]);
  const race = (raceData as RaceRow[] | null)?.[0] ?? null;
  const session = (sessionData as SessionRow[] | null)?.[0] ?? null;

  let name = 'Someone on Rootah';
  let context = 'is sharing a live activity';
  let live = true;
  let badge = 'Live now';
  let distanceM: number | null = null;
  let paceSec: number | null = null;
  let elapsedSec: number | null = null;

  if (race) {
    name = race.athlete_username;
    live = race.finish_time_seconds == null;
    badge = live ? 'Live · racing' : 'Race finished';
    context = live ? `is racing ${race.race_title} right now` : `finished ${race.race_title}`;
    distanceM = race.last_distance_meters;
    paceSec = race.last_pace_seconds_per_km;
    elapsedSec = race.finish_time_seconds;
  } else if (session) {
    const noun = NOUN[session.activity_type] ?? 'run';
    const verb = VERB[session.activity_type] ?? 'moving';
    name = session.athlete_username;
    live = session.status !== 'ended';
    badge = live ? 'Live now' : `${noun} finished`;
    context = live ? `is ${verb} — follow along on the map` : `just finished a ${noun}`;
    distanceM = session.last_distance_meters;
    paceSec = session.last_pace_seconds_per_km;
    elapsedSec = session.last_elapsed_seconds;
  }

  const km = distanceM && distanceM > 20 ? (distanceM / 1000).toFixed(1) : null;
  const paceStr = pace(paceSec);
  const timeStr = duration(elapsedSec);
  const hasStats = Boolean(km || paceStr || timeStr);

  const stat = (value: string, label: string, accent = false) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '18px 26px',
        borderRadius: 18,
        background: accent ? CORAL : '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: accent ? '#fff' : INK, letterSpacing: -1 }}>
        {value}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 15,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          color: accent ? 'rgba(255,255,255,0.9)' : STONE,
        }}
      >
        {label}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
          background: CREAM,
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* faint route-line motif, bleeding off the bottom-right corner */}
        <div style={{ position: 'absolute', right: -210, bottom: -240, display: 'flex' }}>
          <svg width={560} height={560} viewBox="-8 -4 116 136">
            <path
              d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
              stroke={CORAL}
              strokeOpacity={0.12}
              strokeWidth={16}
              fill="none"
              strokeLinecap="round"
            />
            <circle cx={26} cy={24} r={22} fill={CORAL} fillOpacity={0.12} />
            <circle cx={74} cy={104} r={19} fill={CORAL} fillOpacity={0.12} />
          </svg>
        </div>

        {/* top row: brand + state badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: CORAL,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width={27} height={31} viewBox="-8 -4 116 136">
                <path
                  d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
                  stroke="#fff"
                  strokeWidth={11}
                  fill="none"
                  strokeLinecap="round"
                />
                <circle cx={26} cy={24} r={20} fill="#fff" />
                <circle cx={74} cy={104} r={18} fill="#fff" />
                <circle cx={74} cy={104} r={5} fill={CORAL} />
              </svg>
            </div>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: INK, letterSpacing: -0.5 }}>rootah</div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 22px',
              borderRadius: 999,
              background: live ? CORAL : INK,
            }}
          >
            {live && (
              <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: '#fff' }} />
            )}
            <div
              style={{
                display: 'flex',
                fontSize: 20,
                fontWeight: 800,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              {badge}
            </div>
          </div>
        </div>

        {/* headline */}
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 900 }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, color: INK, lineHeight: 1.02, letterSpacing: -3 }}>
            {name}
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: STONE, marginTop: 14 }}>{context}</div>
        </div>

        {/* stat strip / CTA */}
        <div style={{ display: 'flex', gap: 16 }}>
          {km ? stat(`${km} km`, live ? 'so far' : 'covered') : null}
          {paceStr ? stat(paceStr, 'pace /km', true) : null}
          {timeStr ? stat(timeStr, live ? 'elapsed' : 'time') : null}
          {!hasStats ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 24,
                fontWeight: 800,
                color: '#fff',
                background: CORAL,
                borderRadius: 999,
                padding: '20px 34px',
              }}
            >
              Open to watch live  →
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...ogSize },
  );
}
