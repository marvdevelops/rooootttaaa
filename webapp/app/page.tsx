'use client';

import { useEffect, useMemo, useState } from 'react';
import DiscoverMap from '../components/DiscoverMap';
import Header from '../components/Header';
import RouteListCard from '../components/RouteListCard';
import { listPublicRoutes } from '../lib/routesApi';
import { CloudRoute } from '../lib/types';

export default function Home() {
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    listPublicRoutes()
      .then(setRoutes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter((r) => r.name.toLowerCase().includes(q) || r.city?.toLowerCase().includes(q));
  }, [routes, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: 340,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 16,
            overflowY: 'auto',
            background: 'var(--cream)',
          }}
        >
          <input
            type="text"
            placeholder="Search routes or city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              padding: '11px 16px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              boxShadow: 'var(--elevation-subtle)',
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />

          {loading && <span style={{ fontSize: 13, color: 'var(--stone)' }}>Loading routes…</span>}
          {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}
          {!loading && !error && filtered.length === 0 && (
            <span style={{ fontSize: 13, color: 'var(--stone)' }}>No routes found.</span>
          )}

          {filtered.map((route) => (
            <RouteListCard
              key={route.id}
              route={route}
              active={route.id === selectedId}
              onClick={() => setSelectedId(route.id)}
            />
          ))}
        </aside>

        <main style={{ flex: 1, position: 'relative' }}>
          <DiscoverMap routes={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </main>
      </div>
    </div>
  );
}
