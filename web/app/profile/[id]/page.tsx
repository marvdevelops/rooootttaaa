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
  const stats = [profile.city, profile.routeCount > 0 ? `${profile.routeCount} routes` : null, profile.distanceKm > 0 ? `${profile.distanceKm.toFixed(0)} km logged` : null]
    .filter(Boolean)
    .join(' · ');
  const description = profile.bio ? `${profile.bio}${stats ? ` (${stats})` : ''}` : stats || `${profile.username}'s running routes on Rootah.`;
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

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  return (
    <main style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ padding: '20px' }}>
        <Link
          href="/"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(226,218,194,0.85)',
            border: '3px solid var(--ink)',
            boxShadow: '3px 3px 0 var(--ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="#222A2A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 22px 60px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, dynamically-sized avatar
            <img
              src={profile.avatarUrl}
              alt={profile.username}
              style={{ width: 72, height: 72, borderRadius: 18, border: '3px solid var(--ink)', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                border: '3px solid var(--ink)',
                background: 'var(--sand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: 28,
              }}
            >
              {profile.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>{profile.username}</h1>
            {profile.city && <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>📍 {profile.city}</p>}
          </div>
        </div>

        {!!profile.bio && <p style={{ marginTop: 20, fontSize: 15, lineHeight: 1.5 }}>{profile.bio}</p>}

        {profile.routeCount > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <div
              style={{
                flex: 1,
                background: 'var(--white)',
                border: '3px solid var(--ink)',
                borderRadius: 14,
                padding: '14px 16px',
                boxShadow: '3px 3px 0 var(--ink)',
              }}
            >
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{profile.routeCount}</p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Routes</p>
            </div>
            <div
              style={{
                flex: 1,
                background: 'var(--white)',
                border: '3px solid var(--ink)',
                borderRadius: 14,
                padding: '14px 16px',
                boxShadow: '3px 3px 0 var(--ink)',
              }}
            >
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{profile.distanceKm.toFixed(0)} km</p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Distance</p>
            </div>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <OpenInAppButton userId={profile.id} />
        </div>
      </div>
    </main>
  );
}
