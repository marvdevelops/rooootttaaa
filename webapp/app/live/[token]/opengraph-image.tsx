import { ImageResponse } from 'next/og';
import { createClient } from '../../../lib/supabase/server';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface LivePositionRow {
  race_title: string;
  athlete_username: string;
  route_id: string;
  finish_time_seconds: number | null;
  last_distance_meters: number | null;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
}

interface RouteRow {
  name: string;
  distance_km: number;
  segments: { path: RoutePoint[] }[];
}

export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: posData }, { data: routeData }] = await Promise.all([
    supabase.rpc('get_race_live_position', { token }),
    supabase.rpc('get_race_route', { token }),
  ]);
  let position = (posData as LivePositionRow[] | null)?.[0] ?? null;
  const route = (routeData as RouteRow[] | null)?.[0] ?? null;

  // Non-race live session — reuse the same card, just without a race title.
  let sessionLabel: string | null = null;
  if (!position) {
    const { data: sessionData } = await supabase.rpc('get_live_session', { token });
    const s = (sessionData as { athlete_username: string; activity_type: string; last_distance_meters: number | null }[] | null)?.[0];
    if (s) {
      const labels: Record<string, string> = { run: 'run', trail_run: 'trail run', hike: 'hike', bike: 'ride', walk: 'walk', other: 'activity' };
      sessionLabel = labels[s.activity_type] ?? 'activity';
      position = {
        race_title: '',
        athlete_username: s.athlete_username,
        route_id: '',
        finish_time_seconds: null,
        last_distance_meters: s.last_distance_meters,
      };
    }
  }

  const points: RoutePoint[] = (route?.segments ?? []).flatMap((seg) => seg.path);
  let pathD = '';
  if (points.length > 1) {
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;
    const w = 460;
    const h = 300;
    const pad = 24;
    pathD = points
      .map((p, i) => {
        const x = pad + ((p.longitude - minLng) / lngRange) * (w - pad * 2);
        const y = h - pad - ((p.latitude - minLat) / latRange) * (h - pad * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  const isFinished = position?.finish_time_seconds != null;
  const distanceKm = position?.last_distance_meters ? (position.last_distance_meters / 1000).toFixed(1) : null;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#F2EDE5', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 40px 60px 64px', width: 660 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#E84B2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width={28} height={32.7} viewBox="-8 -4 116 136">
                <path d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74" stroke="#FFFFFF" strokeWidth={10} fill="none" strokeLinecap="square" />
                <circle cx={26} cy={24} r={22} fill="#FFFFFF" />
                <circle cx={74} cy={104} r={19} fill="#FFFFFF" />
                <circle cx={74} cy={104} r={5} fill="#E84B2A" />
              </svg>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1A1614' }}>rootah</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {!isFinished && <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 5, background: '#E84B2A' }} />}
            <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: '#E84B2A', textTransform: 'uppercase', letterSpacing: 2 }}>
              {isFinished ? 'Race finisher' : 'Live now'}
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 48, fontWeight: 800, color: '#1A1614', lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 12 }}>
            {position?.athlete_username ?? 'A Rootah athlete'}
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: '#8C8078', marginBottom: 30 }}>
            {isFinished
              ? `Finished ${position?.race_title ?? 'their race'} — tap to see the result`
              : sessionLabel
                ? `On a ${sessionLabel} right now — follow along live`
                : `Running ${position?.race_title ?? 'a race'} right now — follow along live`}
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            {route && (
              <div style={{ display: 'flex', flexDirection: 'column', background: '#EDE8DF', borderRadius: 16, padding: '16px 22px' }}>
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#1A1614' }}>{route.distance_km.toFixed(1)} km</div>
                <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: '#8C8078', textTransform: 'uppercase' }}>Course</div>
              </div>
            )}
            {distanceKm && (
              <div style={{ display: 'flex', flexDirection: 'column', background: '#4BABB8', borderRadius: 16, padding: '16px 22px' }}>
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: 'white' }}>{distanceKm} km</div>
                <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.85)', textTransform: 'uppercase' }}>
                  {isFinished ? 'Covered' : 'So far'}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', width: 540, height: '100%', background: '#E5E0D8', alignItems: 'center', justifyContent: 'center' }}>
          {pathD && (
            <svg width="460" height="300" viewBox="0 0 460 300">
              <path d={pathD} fill="none" stroke="#E84B2A" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
