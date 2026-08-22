'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import { listNearbyClubs } from '../../lib/clubsApi';
import { listUpcomingGroupRuns } from '../../lib/groupRunsApi';
import { listFeaturedRoutes, listPublicRoutes } from '../../lib/routesApi';
import { CloudRoute, GroupRun, RunClub } from '../../lib/types';

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function ExplorePage() {
  const [featured, setFeatured] = useState<CloudRoute[]>([]);
  const [latest, setLatest] = useState<CloudRoute[]>([]);
  const [clubs, setClubs] = useState<RunClub[]>([]);
  const [runs, setRuns] = useState<GroupRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listFeaturedRoutes(8), listPublicRoutes({ limit: 8 }), listNearbyClubs(null, 8), listUpcomingGroupRuns(8)])
      .then(([f, l, c, r]) => {
        setFeatured(f);
        setLatest(l);
        setClubs(c);
        setRuns(r);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />

      <main style={{ flex: 1, padding: '32px clamp(20px,5vw,64px) 80px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--coral)' }}>
              Browse Rootah
            </span>
            <h1 style={{ margin: 0, fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 800, letterSpacing: '-1px' }}>
              Routes, clubs, and runs across the Philippines
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--stone)', maxWidth: 600 }}>
              Look around free — sign in to build your own routes, join a club, or RSVP to a run.
            </p>
          </div>

          {loading && <span style={{ color: 'var(--stone)' }}>Loading…</span>}

          {!loading && (
            <>
              <Section title="Featured routes" empty="No featured routes yet.">
                {featured.map((r) => (
                  <RouteCard key={r.id} route={r} />
                ))}
              </Section>

              <Section title="Latest routes" empty="No public routes yet.">
                {latest.map((r) => (
                  <RouteCard key={r.id} route={r} />
                ))}
              </Section>

              <Section title="Run clubs" empty="No clubs yet.">
                {clubs.map((c) => (
                  <Link key={c.id} href={`/clubs/${c.id}`} style={cardStyle}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--stone)' }}>
                      {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'}
                      {c.city ? ` · ${c.city}` : ''}
                    </span>
                  </Link>
                ))}
              </Section>

              <Section title="Upcoming group runs" empty="No upcoming runs yet.">
                {runs.map((r) => (
                  <Link key={r.id} href={`/runs/${r.id}`} style={cardStyle}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{r.title}</span>
                    <span style={{ fontSize: 13, color: 'var(--stone)' }}>{formatDate(r.scheduledAt)}</span>
                    <span style={{ fontSize: 12, color: 'var(--mist)' }}>{r.routeName}</span>
                  </Link>
                ))}
              </Section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
      {children.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>{children}</div>
      ) : (
        <span style={{ fontSize: 14, color: 'var(--stone)' }}>{empty}</span>
      )}
    </section>
  );
}

function RouteCard({ route }: { route: CloudRoute }) {
  return (
    <Link href={`/routes/${route.id}`} style={cardStyle}>
      <span style={{ fontWeight: 700, fontSize: 15 }}>{route.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--stone)' }}>{route.distanceKm.toFixed(1)} km</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(0,0,0,.06)' }}>
          {ACTIVITY_LABEL[route.activityType] ?? route.activityType}
        </span>
      </div>
      {route.city && <span style={{ fontSize: 12, color: 'var(--mist)' }}>{route.city}</span>}
    </Link>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 16,
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  boxShadow: 'var(--elevation-card)',
};
