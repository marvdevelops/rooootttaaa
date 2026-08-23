import { ImageResponse } from 'next/og';
import { createClient } from '../../../lib/supabase/server';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Ride',
  walk: 'Walk',
  other: 'Route',
};

interface RouteOgRow {
  name: string;
  city: string | null;
  distance_km: number;
  elevation_gain_m: number;
  activity_type: string;
  segments: { path: { latitude: number; longitude: number }[] }[] | null;
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('routes')
    .select('name, city, distance_km, elevation_gain_m, activity_type, segments')
    .eq('id', id)
    .eq('is_public', true)
    .maybeSingle();
  const route = data as RouteOgRow | null;

  // The actual road-following line lives in segments[].path — waypoints are
  // just the sparse click points a route was built from, which draws as a
  // near-straight line instead of the real route shape.
  const points = (route?.segments ?? []).flatMap((seg) => seg.path);
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

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#F2EDE5',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 40px 60px 64px', width: 660 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: '#E84B2A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width={28} height={32.7} viewBox="-8 -4 116 136">
                <path
                  d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
                  stroke="#FFFFFF"
                  strokeWidth={10}
                  fill="none"
                  strokeLinecap="square"
                />
                <circle cx={26} cy={24} r={22} fill="#FFFFFF" />
                <circle cx={74} cy={104} r={19} fill="#FFFFFF" />
                <circle cx={74} cy={104} r={5} fill="#E84B2A" />
              </svg>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1A1614' }}>rootah</div>
          </div>

          <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: '#E84B2A', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            {ACTIVITY_LABEL[route?.activity_type ?? 'run'] ?? 'Route'}
          </div>
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: '#1A1614', lineHeight: 1.1, letterSpacing: -1.5, marginBottom: 20 }}>
            {route?.name ?? 'A Rootah route'}
          </div>
          {route?.city && <div style={{ display: 'flex', fontSize: 20, color: '#8C8078', marginBottom: 30 }}>{route.city}</div>}

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', background: '#EDE8DF', borderRadius: 16, padding: '16px 22px' }}>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#1A1614' }}>{(route?.distance_km ?? 0).toFixed(1)} km</div>
              <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: '#8C8078', textTransform: 'uppercase' }}>Distance</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', background: '#4BABB8', borderRadius: 16, padding: '16px 22px' }}>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: 'white' }}>+{Math.round(route?.elevation_gain_m ?? 0)}m</div>
              <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.85)', textTransform: 'uppercase' }}>Gain</div>
            </div>
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
