'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import RouteThumb from '../../components/RouteThumb';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../lib/AuthContext';
import { listRoutesByOwner } from '../../lib/routesApi';
import { ActivityType, CloudRoute } from '../../lib/types';

const ACTIVITY_OPTIONS: { value: ActivityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'run', label: 'Run' },
  { value: 'trail_run', label: 'Trail run' },
  { value: 'hike', label: 'Hike' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
];

type SortMode = 'recent' | 'distance' | 'name';

export default function MyMapsPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<ActivityType | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('recent');

  useEffect(() => {
    if (!authLoading && !session) router.push('/login?next=/my-maps');
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    listRoutesByOwner(session.user.id)
      .then(setRoutes)
      .finally(() => setLoading(false));
  }, [session]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = routes.filter((route) => {
      if (activityFilter !== 'all' && route.activityType !== activityFilter) return false;
      if (q && !route.name.toLowerCase().includes(q) && !route.city?.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === 'distance') return [...result].sort((a, b) => b.distanceKm - a.distanceKm);
    if (sort === 'name') return [...result].sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [routes, query, activityFilter, sort]);

  if (authLoading || !session) return null;

  const totalKm = routes.reduce((sum, r) => sum + r.distanceKm, 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content" style={{ overflowY: 'auto' }}>
        <div className="mymaps-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>My maps</h1>
              <span style={{ fontSize: 13, color: 'var(--stone)' }}>
                {routes.length} route{routes.length === 1 ? '' : 's'} · {totalKm.toFixed(1)} km total
              </span>
            </div>
            <Link href="/build" className="discover-run-btn" style={{ width: 'auto', padding: '10px 18px' }}>
              + Build a route
            </Link>
          </div>

          <div className="discover-segmented" style={{ margin: '18px 0 0', maxWidth: 340 }}>
            <button className="discover-segmented-item" data-active="true">
              All routes
            </button>
            <span className="discover-segmented-item mymaps-segmented-disabled" title="Coming soon">
              Drafts
            </span>
            <span className="discover-segmented-item mymaps-segmented-disabled" title="Coming soon">
              Shared
            </span>
          </div>

          <div className="mymaps-filters">
            <input
              type="text"
              placeholder="Search your routes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="discover-search-input"
              style={{ boxShadow: 'var(--shadow-hairline)', maxWidth: 280 }}
            />
            <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value as ActivityType | 'all')} className="mymaps-filter-select">
              {ACTIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="mymaps-filter-select" style={{ marginLeft: 'auto' }}>
              <option value="recent">Sort: Recent</option>
              <option value="distance">Sort: Distance</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>

          {loading && <div style={{ marginTop: 20, color: 'var(--stone)', fontSize: 13 }}>Loading…</div>}
          {!loading && routes.length > 0 && filtered.length === 0 && (
            <div style={{ marginTop: 20, color: 'var(--stone)', fontSize: 13 }}>No routes match your search.</div>
          )}

          <div className="mymaps-grid">
            <Link href="/build" className="mymaps-add-tile">
              <span style={{ fontSize: 22 }}>+</span>
              Build a route
            </Link>

            {filtered.map((route) => (
              <Link key={route.id} href={`/routes/${route.id}`} className="mymaps-card">
                <RouteThumb waypoints={route.waypoints} />
                <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{route.name}</span>
                <span style={{ fontSize: 12, color: 'var(--stone)' }}>
                  {route.distanceKm.toFixed(1)} km{route.city ? ` · ${route.city}` : ''}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
