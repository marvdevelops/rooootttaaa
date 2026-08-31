import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicProfile } from '@/lib/getProfile';
import OpenInAppButton from './OpenInAppButton';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) return { title: 'Profile not found — Rootah' };

  const title = `${profile.username} on Rootah`;
  const stats = [
    profile.city,
    profile.activityKm > 0 ? `${profile.activityKm.toFixed(0)} km moved` : null,
    profile.routeCount > 0 ? `${profile.routeCount} routes` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const description = profile.bio ? `${profile.bio}${stats ? ` (${stats})` : ''}` : stats || `${profile.username}'s routes and activities on Rootah.`;
  const path = `/profile/${id}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

const MarkPin = ({ size = 13, color = 'var(--stone)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
    <path
      d="M12 21c4.5-4.2 7-7.8 7-11a7 7 0 10-14 0c0 3.2 2.5 6.8 7 11z"
      stroke={color}
      strokeWidth={1.9}
      strokeLinejoin="round"
    />
    <circle cx={12} cy={10} r={2.4} stroke={color} strokeWidth={1.9} />
  </svg>
);

interface Stat {
  value: string;
  label: string;
  accent?: boolean;
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const stats: Stat[] =
    profile.activityCount > 0
      ? [
          { value: `${profile.activityKm.toFixed(0)} km`, label: 'Moved', accent: true },
          { value: String(profile.activityCount), label: profile.activityCount === 1 ? 'Activity' : 'Activities' },
          ...(profile.routeCount > 0
            ? [{ value: String(profile.routeCount), label: profile.routeCount === 1 ? 'Route' : 'Routes' }]
            : []),
        ]
      : profile.routeCount > 0
        ? [
            { value: String(profile.routeCount), label: profile.routeCount === 1 ? 'Route' : 'Routes' },
            { value: `${profile.routeDistanceKm.toFixed(0)} km`, label: 'Mapped', accent: true },
          ]
        : [];

  return (
    <main style={{ minHeight: '100vh', background: 'var(--cream)', position: 'relative', overflow: 'hidden' }}>
      {/* faint route-line watermark, matching the share card */}
      <svg
        width="620"
        height="620"
        viewBox="-8 -4 116 136"
        aria-hidden
        style={{ position: 'absolute', right: '-180px', bottom: '-220px', pointerEvents: 'none' }}
      >
        <path
          d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
          stroke="var(--coral)"
          strokeOpacity={0.08}
          strokeWidth={16}
          fill="none"
          strokeLinecap="round"
        />
        <circle cx={26} cy={24} r={22} fill="var(--coral)" fillOpacity={0.08} />
        <circle cx={74} cy={104} r={19} fill="var(--coral)" fillOpacity={0.08} />
      </svg>

      <div
        style={{
          position: 'relative',
          maxWidth: 560,
          margin: '0 auto',
          padding: '24px 22px 64px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* header: back + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link
            href="/"
            aria-label="Back to Rootah"
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-icon)',
              background: 'var(--surface)',
              boxShadow: 'var(--elevation-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: 'var(--coral)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="14" height="16" viewBox="-8 -4 116 136">
                <path
                  d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
                  stroke="#fff"
                  strokeWidth={12}
                  fill="none"
                  strokeLinecap="round"
                />
                <circle cx={26} cy={24} r={19} fill="#fff" />
                <circle cx={74} cy={104} r={17} fill="#fff" />
              </svg>
            </span>
            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)', letterSpacing: -0.3 }}>rootah</span>
          </div>
        </div>

        {/* identity */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, dynamically-sized avatar
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              style={{
                width: 84,
                height: 84,
                borderRadius: 'var(--radius-lg)',
                objectFit: 'cover',
                boxShadow: 'var(--elevation-card)',
              }}
            />
          ) : (
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--surface)',
                boxShadow: 'var(--elevation-card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 34,
                fontWeight: 800,
                color: 'var(--stone)',
              }}
            >
              {profile.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: -0.6,
                color: 'var(--ink)',
                margin: 0,
                lineHeight: 1.1,
                wordBreak: 'break-word',
              }}
            >
              {profile.username}
            </h1>
            {profile.city && (
              <p
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  color: 'var(--stone)',
                  fontSize: 14,
                  fontWeight: 500,
                  margin: '6px 0 0',
                }}
              >
                <MarkPin /> {profile.city}
              </p>
            )}
          </div>
        </div>

        {!!profile.bio && (
          <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink)', margin: 0 }}>{profile.bio}</p>
        )}

        {stats.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  flex: '1 1 120px',
                  background: s.accent ? 'var(--coral)' : 'var(--surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: '18px 18px',
                  boxShadow: s.accent ? 'var(--elevation-primary-btn)' : 'var(--elevation-card)',
                }}
              >
                <p
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    color: s.accent ? '#fff' : 'var(--ink)',
                    margin: 0,
                    letterSpacing: -0.5,
                  }}
                >
                  {s.value}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: s.accent ? 'rgba(255,255,255,0.82)' : 'var(--stone)',
                    margin: '4px 0 0',
                  }}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}

        <OpenInAppButton userId={profile.id} />
      </div>
    </main>
  );
}
