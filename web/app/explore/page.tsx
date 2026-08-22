import type { Metadata } from 'next';
import Link from 'next/link';
import { listExploreClubs, listFeaturedRoutes, listLatestRoutes, listUpcomingRuns } from '../../lib/listExplore';

export const metadata: Metadata = {
  title: 'Explore Rootah — Routes, clubs, and group runs across the Philippines',
  description:
    'Browse the latest and most-run routes, active run clubs, and upcoming group runs on Rootah. No account needed to look around — download the app or sign in to build, join, and save.',
};

export const revalidate = 300;

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default async function ExplorePage() {
  const [latest, featured, clubs, runs] = await Promise.all([
    listLatestRoutes(8),
    listFeaturedRoutes(8),
    listExploreClubs(8),
    listUpcomingRuns(8),
  ]);

  return (
    <div style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px clamp(20px,5vw,64px)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: 'var(--coral)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(232,75,42,.35)',
            }}
          >
            <svg width={23} height={27} viewBox="-8 -4 116 136">
              <path d="M 26,24 H 80 A 20,20 0 0 1 80,64 H 20 A 20,20 0 0 0 20,104 H 74" stroke="#FFFFFF" strokeWidth={10} fill="none" strokeLinecap="square" />
              <circle cx={26} cy={24} r={22} fill="#FFFFFF" />
              <circle cx={74} cy={104} r={19} fill="#FFFFFF" />
              <circle cx={74} cy={104} r={5} fill="var(--coral)" />
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px', color: 'var(--ink)' }}>rootah</span>
        </Link>
        <a
          href="https://app.rootah.com"
          className="soft-btn"
          style={{
            padding: '11px 22px',
            borderRadius: 50,
            background: 'var(--coral)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            boxShadow: '0 4px 12px rgba(232,75,42,.3)',
          }}
        >
          Open the app
        </a>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px clamp(20px,5vw,64px) 80px', display: 'flex', flexDirection: 'column', gap: 56 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 24 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--coral)' }}>
            Browse Rootah
          </span>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-1px', color: 'var(--ink)' }}>
            Routes, clubs, and runs across the Philippines
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: 'var(--stone)', maxWidth: 640, lineHeight: 1.6 }}>
            Look around free — no account needed. Sign in on the app to build your own routes, join a club, or RSVP to a run.
          </p>
        </div>

        <Section title="Featured routes" emptyText="No featured routes yet — check back soon.">
          {featured.map((r) => (
            <RouteCard key={r.id} route={r} />
          ))}
        </Section>

        <Section title="Latest routes" emptyText="No public routes yet.">
          {latest.map((r) => (
            <RouteCard key={r.id} route={r} />
          ))}
        </Section>

        <Section title="Run clubs" emptyText="No clubs yet — be the first to start one on the app.">
          {clubs.map((c) => (
            <Link
              key={c.id}
              href={`/clubs/${c.slug}`}
              className="soft-btn"
              style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{c.name}</span>
              <span style={{ fontSize: 13, color: 'var(--stone)' }}>
                {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
                {c.city ? ` · ${c.city}` : ''}
              </span>
            </Link>
          ))}
        </Section>

        <Section title="Upcoming group runs" emptyText="No upcoming runs yet.">
          {runs.map((r) => (
            <Link key={r.id} href={`/runs/${r.id}`} className="soft-btn" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{r.title}</span>
              <span style={{ fontSize: 13, color: 'var(--stone)' }}>{formatDate(r.scheduledAt)}</span>
              {r.routeName && <span style={{ fontSize: 12, color: 'var(--mist)' }}>{r.routeName}</span>}
            </Link>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, emptyText, children }: { title: string; emptyText: string; children: React.ReactNode }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{title}</h2>
      {hasContent ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>{children}</div>
      ) : (
        <span style={{ fontSize: 14, color: 'var(--stone)' }}>{emptyText}</span>
      )}
    </section>
  );
}

function RouteCard({ route }: { route: { id: string; name: string; distanceKm: number; activityType: string; city: string | null; ownerUsername: string } }) {
  return (
    <Link href={`/routes/${route.id}`} className="soft-btn" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{route.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--stone)' }}>{route.distanceKm.toFixed(1)} km</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 6,
            background: 'rgba(0,0,0,.06)',
            color: 'var(--ink)',
          }}
        >
          {ACTIVITY_LABEL[route.activityType] ?? route.activityType}
        </span>
      </div>
      <span style={{ fontSize: 12, color: 'var(--mist)' }}>
        {route.city ? `${route.city} · ` : ''}by {route.ownerUsername}
      </span>
    </Link>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 17,
  background: 'var(--surface)',
  boxShadow: '0 4px 16px rgba(0,0,0,.07)',
};
