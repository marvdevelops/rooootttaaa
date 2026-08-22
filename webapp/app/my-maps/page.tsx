'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import RouteThumb from '../../components/RouteThumb';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../lib/AuthContext';
import { listRoutesByOwner } from '../../lib/routesApi';
import { CloudRoute } from '../../lib/types';

export default function MyMapsPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !session) router.push('/login?next=/my-maps');
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    listRoutesByOwner(session.user.id)
      .then(setRoutes)
      .finally(() => setLoading(false));
  }, [session]);

  if (authLoading || !session) return null;

  const totalKm = routes.reduce((sum, r) => sum + r.distanceKm, 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content" style={{ overflowY: 'auto' }}>
        <div className="mymaps-body">
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>My maps</h1>
          <span style={{ fontSize: 13, color: 'var(--stone)' }}>
            {routes.length} route{routes.length === 1 ? '' : 's'} · {totalKm.toFixed(1)} km total
          </span>

          {loading && <div style={{ marginTop: 20, color: 'var(--stone)', fontSize: 13 }}>Loading…</div>}

          <div className="mymaps-grid">
            <Link href="/build" className="mymaps-add-tile">
              <span style={{ fontSize: 22 }}>+</span>
              Build a route
            </Link>

            {routes.map((route) => (
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
