import { ImageResponse } from 'next/og';
import { getPublicProfile } from '@/lib/getProfile';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CREAM = '#F2EDE5';
const INK = '#1A1614';
const STONE = '#8C8078';
const CORAL = '#E84B2A';

/** next/og can't fetch a remote <img> at render time — pull the avatar and
 * inline it as a data URI. https-only, small cap; the avatars bucket is our
 * own Supabase storage so the surface is narrow. */
async function inlineImage(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith('https://')) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 2_000_000) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const rootahMark = (s: number, stroke: string, dot: string) => (
  <svg width={s} height={s * 1.15} viewBox="-8 -4 116 136">
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

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id);

  const username = profile?.username ?? 'A Rootah member';
  const avatar = await inlineImage(profile?.avatarUrl ?? null);
  const bio = (profile?.bio ?? '').trim();
  const bioLine = bio.length > 86 ? `${bio.slice(0, 85)}…` : bio;

  type Chip = { value: string; label: string; accent?: boolean };
  const chips: Chip[] = !profile
    ? []
    : profile.activityCount > 0
      ? [
          { value: `${profile.activityKm.toFixed(0)} km`, label: 'moved', accent: true },
          { value: String(profile.activityCount), label: profile.activityCount === 1 ? 'activity' : 'activities' },
          ...(profile.routeCount > 0
            ? [{ value: String(profile.routeCount), label: profile.routeCount === 1 ? 'route' : 'routes' }]
            : []),
        ]
      : profile.routeCount > 0
        ? [
            { value: String(profile.routeCount), label: profile.routeCount === 1 ? 'route' : 'routes' },
            { value: `${profile.routeDistanceKm.toFixed(0)} km`, label: 'mapped', accent: true },
          ]
        : [];

  const stat = (value: string, label: string, accent = false) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '18px 30px',
        borderRadius: 20,
        background: accent ? CORAL : '#fff',
      }}
    >
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: accent ? '#fff' : INK, letterSpacing: -1 }}>
        {value}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: accent ? 'rgba(255,255,255,0.8)' : STONE,
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
        {/* route-line watermark */}
        <div style={{ position: 'absolute', right: -210, bottom: -250, display: 'flex' }}>
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

        {/* top row */}
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
              {rootahMark(26, '#fff', CORAL)}
            </div>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: INK, letterSpacing: -0.5 }}>rootah</div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 22px',
              borderRadius: 999,
              background: INK,
            }}
          >
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
              {profile?.city ? profile.city : 'Member'}
            </div>
          </div>
        </div>

        {/* identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} width={172} height={172} style={{ borderRadius: 44, objectFit: 'cover' }} alt="" />
          ) : (
            <div
              style={{
                width: 172,
                height: 172,
                borderRadius: 44,
                background: '#E9E2D6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 76,
                fontWeight: 800,
                color: STONE,
              }}
            >
              {username.slice(0, 1).toUpperCase()}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 820 }}>
            <div style={{ display: 'flex', fontSize: 78, fontWeight: 800, color: INK, lineHeight: 1.02, letterSpacing: -3 }}>
              {username}
            </div>
            {bioLine ? (
              <div style={{ display: 'flex', fontSize: 30, color: STONE, marginTop: 12 }}>{bioLine}</div>
            ) : (
              <div style={{ display: 'flex', fontSize: 30, color: STONE, marginTop: 12 }}>Mapping routes on Rootah</div>
            )}
          </div>
        </div>

        {/* stats / cta */}
        <div style={{ display: 'flex', gap: 16 }}>
          {chips.length > 0 ? (
            <>
              {chips.map((c) => (
                <div key={c.label} style={{ display: 'flex' }}>
                  {stat(c.value, c.label, c.accent)}
                </div>
              ))}
            </>
          ) : (
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
              See their routes on Rootah  →
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
