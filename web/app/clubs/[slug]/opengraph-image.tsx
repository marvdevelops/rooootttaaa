import { ImageResponse } from 'next/og';
import { getPublicClub } from '@/lib/getClub';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CREAM = '#F2EDE5';
const INK = '#1A1614';
const STONE = '#8C8078';
const CORAL = '#E84B2A';

const rootahMark = (s: number, stroke: string, dot: string) => (
  <svg width={s} height={s * 1.15} viewBox="-8 -4 116 136">
    <path d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74" stroke={stroke} strokeWidth={11} fill="none" strokeLinecap="round" />
    <circle cx={26} cy={24} r={20} fill={stroke} />
    <circle cx={74} cy={104} r={18} fill={stroke} />
    <circle cx={74} cy={104} r={5} fill={dot} />
  </svg>
);

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getPublicClub(slug);

  const name = club?.name ?? 'A Rootah club';
  const desc = (club?.description ?? '').trim();
  const descLine = desc.length > 92 ? `${desc.slice(0, 91)}…` : desc || 'A run club on Rootah';

  const chips: { value: string; label: string; accent?: boolean }[] = club
    ? [
        { value: String(club.memberCount), label: club.memberCount === 1 ? 'member' : 'members', accent: true },
        ...(club.upcomingEvents.length > 0
          ? [{ value: String(club.upcomingEvents.length), label: club.upcomingEvents.length === 1 ? 'upcoming run' : 'upcoming runs' }]
          : []),
      ]
    : [];

  const stat = (value: string, label: string, accent = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '18px 30px', borderRadius: 20, background: accent ? CORAL : '#fff' }}>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: accent ? '#fff' : INK, letterSpacing: -1 }}>{value}</div>
      <div style={{ display: 'flex', fontSize: 17, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: accent ? 'rgba(255,255,255,0.8)' : STONE }}>
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
        <div style={{ position: 'absolute', right: -210, bottom: -250, display: 'flex' }}>
          <svg width={560} height={560} viewBox="-8 -4 116 136">
            <path d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74" stroke={CORAL} strokeOpacity={0.12} strokeWidth={16} fill="none" strokeLinecap="round" />
            <circle cx={26} cy={24} r={22} fill={CORAL} fillOpacity={0.12} />
            <circle cx={74} cy={104} r={19} fill={CORAL} fillOpacity={0.12} />
          </svg>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: CORAL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {rootahMark(26, '#fff', CORAL)}
            </div>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, color: INK, letterSpacing: -0.5 }}>rootah</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 22px', borderRadius: 999, background: INK }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 2 }}>
              {club?.city ? club.city : 'Run club'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div style={{ width: 172, height: 172, borderRadius: 44, background: CORAL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {rootahMark(80, '#fff', CORAL)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 820 }}>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: INK, lineHeight: 1.03, letterSpacing: -2.5 }}>{name}</div>
            <div style={{ display: 'flex', fontSize: 30, color: STONE, marginTop: 12 }}>{descLine}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {chips.length > 0 ? (
            chips.map((c) => (
              <div key={c.label} style={{ display: 'flex' }}>
                {stat(c.value, c.label, c.accent)}
              </div>
            ))
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 800, color: '#fff', background: CORAL, borderRadius: 999, padding: '20px 34px' }}>
              Join the club on Rootah  →
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
