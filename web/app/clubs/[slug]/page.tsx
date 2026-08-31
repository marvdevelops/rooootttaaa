import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicClub } from '@/lib/getClub';
import JoinClubButton from './JoinClubButton';

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

  const title = `${club.name} — Rootah run club`;
  const description = [club.city, `${club.memberCount} members`, club.description].filter(Boolean).join(' · ');
  const path = `/clubs/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', url: path, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ClubPage({ params }: Props) {
  const { slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) notFound();

  return (
    <main style={{ minHeight: '100vh', background: 'var(--cream)', position: 'relative', overflow: 'hidden' }}>
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
          gap: 24,
        }}
      >
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

        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          {club.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, dynamically-sized avatar
            <img
              src={club.avatarUrl}
              alt={club.name}
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
                background: 'var(--coral)',
                boxShadow: 'var(--elevation-primary-btn)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="40" height="46" viewBox="-8 -4 116 136">
                <path
                  d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74"
                  stroke="#fff"
                  strokeWidth={11}
                  fill="none"
                  strokeLinecap="round"
                />
                <circle cx={26} cy={24} r={20} fill="#fff" />
                <circle cx={74} cy={104} r={18} fill="#fff" />
              </svg>
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: 27,
                fontWeight: 800,
                letterSpacing: -0.6,
                color: 'var(--ink)',
                margin: 0,
                lineHeight: 1.12,
                wordBreak: 'break-word',
              }}
            >
              {club.name}
            </h1>
            <p
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: 'var(--stone)',
                fontSize: 13.5,
                fontWeight: 600,
                margin: '6px 0 0',
              }}
            >
              {club.city && <span>{club.city}</span>}
              {club.city && club.memberCount > 0 && <span style={{ opacity: 0.5 }}>·</span>}
              <span>
                {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
              </span>
            </p>
          </div>
        </div>

        {!!club.description && (
          <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--ink)', margin: 0 }}>{club.description}</p>
        )}

        <JoinClubButton clubId={club.id} />

        {club.upcomingEvents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: 'var(--stone)',
                margin: 0,
              }}
            >
              Upcoming runs
            </p>
            {club.upcomingEvents.map((e) => (
              <div
                key={e.id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  boxShadow: 'var(--elevation-card)',
                }}
              >
                <p style={{ fontSize: 12, color: 'var(--stone)', margin: 0, fontWeight: 600 }}>
                  {formatWhen(e.scheduledAt)}
                </p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', margin: '3px 0 0' }}>{e.title}</p>
                <p style={{ fontSize: 12.5, color: 'var(--stone)', margin: '3px 0 0' }}>
                  {e.routeName ? `${e.routeName} · ` : ''}
                  {e.rsvpCount} {e.rsvpCount === 1 ? 'person' : 'people'} joining
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
