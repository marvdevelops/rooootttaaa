'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ClubAvatar from '../../components/ClubAvatar';
import RouteThumb from '../../components/RouteThumb';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../lib/AuthContext';
import { joinClub, listNearbyClubs } from '../../lib/clubsApi';
import { listUpcomingGroupRuns } from '../../lib/groupRunsApi';
import { listPublicRoutes } from '../../lib/routesApi';
import { ActivityType, CloudRoute, GroupRun, RunClub } from '../../lib/types';

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Ride',
  walk: 'Walk',
  other: 'Other',
};

type FilterChip = 'all' | 'run' | 'bike' | 'short';

function isLoop(route: CloudRoute): boolean {
  const start = route.waypoints[0];
  const end = route.waypoints[route.waypoints.length - 1];
  if (!start || !end) return false;
  return Math.abs(start.latitude - end.latitude) < 0.001 && Math.abs(start.longitude - end.longitude) < 0.001;
}

function relativeTime(ms: number): string {
  const diffDays = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ExplorePage() {
  const { session } = useAuth();
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [clubs, setClubs] = useState<RunClub[]>([]);
  const [runs, setRuns] = useState<GroupRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<FilterChip>('all');
  const [city, setCity] = useState('all');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listPublicRoutes({ limit: 200 }), listNearbyClubs(null, 30), listUpcomingGroupRuns(6)])
      .then(([r, c, g]) => {
        setRoutes(r);
        setClubs(c);
        setRuns(g);
      })
      .finally(() => setLoading(false));
  }, []);

  const cities = useMemo(() => Array.from(new Set(routes.map((r) => r.city).filter((c): c is string => !!c))).sort(), [routes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return routes.filter((r) => {
      if (chip === 'run' && r.activityType !== 'run' && r.activityType !== 'trail_run') return false;
      if (chip === 'bike' && r.activityType !== 'bike') return false;
      if (chip === 'short' && r.distanceKm > 5) return false;
      if (city !== 'all' && r.city !== city) return false;
      if (q && !r.name.toLowerCase().includes(q) && !r.city?.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [routes, query, chip, city]);

  const featured = [...filtered].sort((a, b) => b.savesCount - a.savesCount).slice(0, 5);
  const latest = [...filtered].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  async function handleJoin(club: RunClub) {
    setJoiningId(club.id);
    try {
      const status = await joinClub(club.id, club.isPrivate);
      setClubs((cs) => cs.map((c) => (c.id === club.id ? { ...c, myStatus: status, myRole: 'member' } : c)));
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px clamp(20px,5vw,64px) 80px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--coral)' }}>
                  Browse Rootah
                </span>
                <h1 style={{ margin: 0, fontSize: 'clamp(26px,3.5vw,38px)', fontWeight: 800, letterSpacing: '-1px' }}>
                  Routes, clubs, and runs across the Philippines
                </h1>
                <p style={{ margin: 0, fontSize: 15, color: 'var(--stone)' }}>
                  Look around free — sign in to build your own routes, join a club, or RSVP to a run.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div className="explore-stat-pill">
                  <span className="explore-stat-pill-value">{routes.length}</span>
                  <span className="explore-stat-pill-label">Routes</span>
                </div>
                <div className="explore-stat-pill">
                  <span className="explore-stat-pill-value">{cities.length}</span>
                  <span className="explore-stat-pill-label">Cities</span>
                </div>
                <div className="explore-stat-pill">
                  <span className="explore-stat-pill-value tone-teal">{clubs.length}</span>
                  <span className="explore-stat-pill-label">Clubs</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search routes, clubs or cities…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="discover-search-input"
                style={{ boxShadow: 'var(--shadow-hairline)', maxWidth: 320 }}
              />
              <button className="explore-filter-chip" data-active={chip === 'all'} onClick={() => setChip('all')}>
                All
              </button>
              <button className="explore-filter-chip" data-active={chip === 'run'} onClick={() => setChip('run')}>
                Run
              </button>
              <button className="explore-filter-chip" data-active={chip === 'bike'} onClick={() => setChip('bike')}>
                Ride
              </button>
              <button className="explore-filter-chip" data-active={chip === 'short'} onClick={() => setChip('short')}>
                Under 5 km
              </button>
              {cities.length > 0 && (
                <select value={city} onChange={(e) => setCity(e.target.value)} className="mymaps-filter-select" style={{ height: 38 }}>
                  <option value="all">All cities</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {loading && <span style={{ color: 'var(--stone)' }}>Loading…</span>}

            {!loading && (
              <>
                <Section title="Featured routes" subtitle="Hand-picked by the Rootah community this week" empty="No routes match your filters." count={featured.length}>
                  {featured.map((r) => (
                    <FeaturedCard key={r.id} route={r} />
                  ))}
                </Section>

                <Section title="Latest routes" subtitle="Just mapped by runners near you" empty="No routes match your filters." count={latest.length}>
                  {latest.map((r) => (
                    <LatestRow key={r.id} route={r} />
                  ))}
                </Section>

                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32, alignItems: 'flex-start' }}>
                  <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Run clubs</h2>
                      <span style={{ fontSize: 13, color: 'var(--stone)' }}>Find your people</span>
                    </div>
                    {clubs.length === 0 && <span style={{ fontSize: 14, color: 'var(--stone)' }}>No clubs yet.</span>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {clubs.slice(0, 5).map((club) => (
                        <div key={club.id} className="explore-club-row">
                          <ClubAvatar club={club} size={40} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>
                              {club.name}
                              {club.myStatus === 'active' && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    background: 'var(--sage)',
                                    color: 'var(--white)',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Joined
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: 12.5, color: 'var(--stone)' }}>
                              {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
                              {club.city ? ` · ${club.city}` : ''}
                            </span>
                          </div>
                          {club.myStatus === 'active' ? (
                            <Link href={`/clubs/${club.id}`} className="explore-filter-chip">
                              View
                            </Link>
                          ) : session ? (
                            <button onClick={() => handleJoin(club)} disabled={joiningId === club.id} className="discover-run-btn" style={{ width: 'auto', padding: '9px 18px' }}>
                              {club.myStatus === 'pending' ? 'Pending' : 'Join'}
                            </button>
                          ) : (
                            <Link href="/login" className="discover-run-btn" style={{ width: 'auto', padding: '9px 18px' }}>
                              Join
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                    {clubs.length > 5 && (
                      <Link href="/clubs" style={{ fontSize: 13, fontWeight: 700, color: 'var(--coral)' }}>
                        Browse all {clubs.length} →
                      </Link>
                    )}
                  </section>

                  <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Upcoming group runs</h2>
                    </div>
                    {runs.length === 0 ? (
                      <div className="explore-cta-card">
                        <div className="explore-cta-icon">📅</div>
                        <span style={{ fontSize: 17, fontWeight: 800 }}>Be the first to schedule a run in your area</span>
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>
                          Pick any route, set a date, and Rootah tells nearby runners. Most first runs fill within a week.
                        </p>
                        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                          <Link href="/runs/new" className="discover-run-btn" style={{ width: 'auto', padding: '10px 18px' }}>
                            Schedule a run
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {runs.map((r) => (
                          <Link key={r.id} href={`/runs/${r.id}`} className="explore-club-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{r.title}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--stone)' }}>{new Date(r.scheduledAt).toLocaleString()}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  empty,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
        <span style={{ fontSize: 13, color: 'var(--stone)' }}>{subtitle}</span>
      </div>
      {count === 0 ? (
        <span style={{ fontSize: 14, color: 'var(--stone)' }}>{empty}</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 16 }}>{children}</div>
      )}
    </section>
  );
}

function FeaturedCard({ route }: { route: CloudRoute }) {
  const loop = isLoop(route);
  return (
    <Link href={`/routes/${route.id}`} className="explore-card">
      <div className="explore-card-thumb">
        <RouteThumb waypoints={route.waypoints} className="explore-card-thumb" />
        <span className="explore-card-badge" style={{ left: 10 }}>
          {ACTIVITY_LABEL[route.activityType] ?? route.activityType}
        </span>
        {(loop || route.isTrail) && (
          <span className={`explore-card-badge ${loop ? 'tone-loop' : 'tone-trail'}`} style={{ right: 10 }}>
            {loop ? 'Loop' : 'Trail'}
          </span>
        )}
      </div>
      <div className="explore-card-body">
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>{route.name}</span>
        <span style={{ fontSize: 13, color: 'var(--stone)' }}>
          <strong style={{ color: 'var(--coral)' }}>{route.distanceKm.toFixed(1)} km</strong> · ↑{Math.round(route.elevationGainM)}m
        </span>
        {route.city && <span style={{ fontSize: 12, color: 'var(--mist)' }}>{route.city}</span>}
      </div>
    </Link>
  );
}

function LatestRow({ route }: { route: CloudRoute }) {
  return (
    <Link href={`/routes/${route.id}`} className="explore-list-row">
      <RouteThumb waypoints={route.waypoints} className="explore-list-thumb" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{route.name}</span>
        <span style={{ fontSize: 12, color: 'var(--stone)' }}>
          {route.distanceKm.toFixed(1)} km · ↑{Math.round(route.elevationGainM)}m{route.city ? ` · ${route.city}` : ''}
        </span>
      </div>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 6,
          background: 'rgba(0,0,0,.06)',
          color: 'var(--ink)',
          textTransform: 'uppercase',
        }}
      >
        {ACTIVITY_LABEL[route.activityType] ?? route.activityType}
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--mist)', whiteSpace: 'nowrap' }}>{relativeTime(route.createdAt)}</span>
    </Link>
  );
}
