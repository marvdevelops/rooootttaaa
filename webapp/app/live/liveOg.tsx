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
  race_distance_km: number | null;
  event_logo_url: string | null;
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

/** Fetch a remote logo and inline it — next/og throws on a failed <img src>, so
 * an unreachable organizer URL must not reach the renderer. */
async function inlineImage(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/png';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 1_500_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const rootahMark = (size: number, stroke: string, dot: string) => (
  <svg width={size} height={size * 1.15} viewBox="-8 -4 116 136">
    <path
      d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
      stroke={stroke}
      strokeWidth={11}
      fill="none"
      strokeLinecap="round"
    />
    <circle cx={26} cy={24} r={20} fill={stroke} />
    <circle cx={74} cy={104} r={18} fill={stroke} />
    <circle cx={74} cy={104} r={5} fill={dot} />
  </svg>
);

export async function renderLiveOg(token: string) {
  const supabase = await createClient();
  const [{ data: raceData }, { data: sessionData }] = await Promise.all([
    supabase.rpc('get_race_live_position', { token }),
    supabase.rpc('get_live_session', { token }),
  ]);
  const race = (raceData as RaceRow[] | null)?.[0] ?? null;
  const session = (sessionData as SessionRow[] | null)?.[0] ?? null;

  // ---------- RACE: event-branded card ----------
  if (race) {
    const live = race.finish_time_seconds == null;
    const logo = await inlineImage(race.event_logo_url);
    const distKm =
      race.race_distance_km && race.race_distance_km > 0 ? Number(race.race_distance_km).toFixed(1) : null;
    const coveredKm =
      race.last_distance_meters && race.last_distance_meters > 20
        ? (race.last_distance_meters / 1000).toFixed(1)
        : null;
    const paceStr = pace(race.last_pace_seconds_per_km);
    const timeStr = duration(race.finish_time_seconds);

    const chip = (value: string, label: string) => (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '18px 26px',
          borderRadius: 18,
          background: 'rgba(255,255,255,0.08)',
        }}
      >
        <div style={{ display: 'flex', fontSize: 38, fontWeight: 800, color: CREAM, letterSpacing: -1 }}>{value}</div>
        <div
          style={{
            display: 'flex',
            fontSize: 14,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
            color: 'rgba(242,237,229,0.55)',
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
            background: INK,
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', right: -220, bottom: -260, display: 'flex' }}>
            <svg width={580} height={580} viewBox="-8 -4 116 136">
              <path
                d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
                stroke={CORAL}
                strokeOpacity={0.22}
                strokeWidth={16}
                fill="none"
                strokeLinecap="round"
              />
              <circle cx={26} cy={24} r={22} fill={CORAL} fillOpacity={0.22} />
              <circle cx={74} cy={104} r={19} fill={CORAL} fillOpacity={0.22} />
            </svg>
          </div>

          {/* top: logo + state */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {logo ? (
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 18,
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 10,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} width={56} height={56} style={{ objectFit: 'contain' }} alt="" />
                </div>
              ) : (
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 18,
                    background: CORAL,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {rootahMark(38, '#fff', CORAL)}
                </div>
              )}
              <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: 'rgba(242,237,229,0.5)', letterSpacing: 2, textTransform: 'uppercase' }}>
                Live race tracking
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 22px',
                borderRadius: 999,
                background: live ? CORAL : 'rgba(255,255,255,0.12)',
              }}
            >
              {live && <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: '#fff' }} />}
              <div style={{ display: 'flex', fontSize: 20, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 2 }}>
                {live ? 'Live · racing' : 'Race finished'}
              </div>
            </div>
          </div>

          {/* race name + distance + athlete */}
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 940 }}>
            <div style={{ display: 'flex', fontSize: 78, fontWeight: 800, color: CREAM, lineHeight: 1.03, letterSpacing: -3 }}>
              {race.race_title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
              {distKm && (
                <div
                  style={{
                    display: 'flex',
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#fff',
                    background: CORAL,
                    borderRadius: 999,
                    padding: '8px 20px',
                    letterSpacing: 0.5,
                  }}
                >
                  {distKm} km
                </div>
              )}
              <div style={{ display: 'flex', fontSize: 30, color: 'rgba(242,237,229,0.7)' }}>
                {live ? `${race.athlete_username} is racing — follow live` : `${race.athlete_username} finished`}
              </div>
            </div>
          </div>

          {/* stat strip */}
          <div style={{ display: 'flex', gap: 16 }}>
            {coveredKm ? chip(`${coveredKm} km`, live ? 'covered so far' : 'covered') : null}
            {paceStr ? chip(paceStr, 'pace /km') : null}
            {timeStr ? chip(timeStr, 'finish time') : null}
            {!coveredKm && !paceStr && !timeStr ? (
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

  // ---------- SESSION / fallback: cream card ----------
  let name = 'Someone on Rootah';
  let context = 'is sharing a live activity';
  let live = true;
  let badge = 'Live now';
  let distanceM: number | null = null;
  let paceSec: number | null = null;
  let elapsedSec: number | null = null;

  if (session) {
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
              {rootahMark(27, '#fff', CORAL)}
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
            {live && <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 7, background: '#fff' }} />}
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

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 900 }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, color: INK, lineHeight: 1.02, letterSpacing: -3 }}>
            {name}
          </div>
          <div style={{ display: 'flex', fontSize: 34, color: STONE, marginTop: 14 }}>{context}</div>
        </div>

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
