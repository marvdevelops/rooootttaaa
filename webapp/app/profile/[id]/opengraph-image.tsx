import { ImageResponse } from 'next/og';
import { createClient } from '../../../lib/supabase/server';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface ProfileOgRow {
  username: string;
  avatar_url: string | null;
}

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', id).maybeSingle();
  const profileRow = profile as ProfileOgRow | null;

  const { count: routeCount } = await supabase
    .from('routes')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', id)
    .eq('is_public', true);

  const { data: distanceRows } = await supabase.from('routes').select('distance_km').eq('owner_id', id).eq('is_public', true);
  const distanceKm = (distanceRows ?? []).reduce((s, r) => s + (r.distance_km as number), 0);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#F2EDE5', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {profileRow?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileRow.avatar_url} width={140} height={140} style={{ borderRadius: 32, objectFit: 'cover' }} alt="" />
            ) : (
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 32,
                  background: '#EDE8DF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 56,
                  fontWeight: 800,
                  color: '#8C8078',
                }}
              >
                {(profileRow?.username ?? '?').slice(0, 1).toUpperCase()}
              </div>
            )}

            <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: '#1A1614', letterSpacing: -1.5 }}>
              {profileRow?.username ?? 'A Rootah runner'}
            </div>
          </div>

          {!!routeCount && (
            <div style={{ display: 'flex', gap: 14, marginTop: 40 }}>
              <div style={{ display: 'flex', flexDirection: 'column', background: '#EDE8DF', borderRadius: 16, padding: '16px 22px' }}>
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#1A1614' }}>{routeCount}</div>
                <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: '#8C8078', textTransform: 'uppercase' }}>Routes</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', background: '#4BABB8', borderRadius: 16, padding: '16px 22px' }}>
                <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: 'white' }}>{distanceKm.toFixed(0)} km</div>
                <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.85)', textTransform: 'uppercase' }}>Distance</div>
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
