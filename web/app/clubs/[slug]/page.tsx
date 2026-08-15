import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicClub } from '@/lib/getClub';

interface Props {
  params: Promise<{ slug: string }>;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) return { title: 'Club not found — Rootah' };

  const title = `${club.name} — Rootah Run Club`;
  const description = [club.city, `${club.memberCount} members`, club.description].filter(Boolean).join(' · ');
  const path = `/clubs/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title,
      description,
      images: club.avatarUrl ? [{ url: club.avatarUrl, alt: club.name }] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: club.avatarUrl ? [club.avatarUrl] : undefined,
    },
  };
}

export default async function ClubPage({ params }: Props) {
  const { slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) notFound();

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
          {club.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, dynamically-sized avatar
            <img
              src={club.avatarUrl}
              alt={club.name}
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
              }}
            />
          )}
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>{club.name}</h1>
            {club.city && <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>📍 {club.city}</p>}
            {club.memberCount > 1 && (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>👥 {club.memberCount} members</p>
            )}
          </div>
        </div>

        {!!club.description && (
          <p style={{ marginTop: 20, fontSize: 15, lineHeight: 1.5 }}>{club.description}</p>
        )}

        {club.upcomingEvents.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 10 }}>Upcoming runs</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {club.upcomingEvents.map((e) => (
                <div
                  key={e.id}
                  style={{
                    background: 'var(--white)',
                    border: '3px solid var(--ink)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    boxShadow: '3px 3px 0 var(--ink)',
                  }}
                >
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>{formatWhen(e.scheduledAt)}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginTop: 2 }}>{e.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {e.routeName ? `${e.routeName} · ` : ''}
                    {e.rsvpCount} joining
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <Link
            href="/#download"
            className="brutal-btn"
            style={
              {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 56,
                width: '100%',
                borderRadius: 14,
                background: 'var(--rust)',
                color: 'var(--sand)',
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                border: '3px solid var(--ink)',
                boxShadow: '4px 4px 0px var(--ink)',
                textDecoration: 'none',
              } as React.CSSProperties
            }
          >
            JOIN ON ROOTAH
          </Link>
        </div>
      </div>
    </main>
  );
}
