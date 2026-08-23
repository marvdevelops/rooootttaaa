'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import DiscoverMap from '../components/DiscoverMap';
import ElevationSparkline from '../components/ElevationSparkline';
import RouteListCard from '../components/RouteListCard';
import Sidebar from '../components/Sidebar';
import { listPublicRoutes } from '../lib/routesApi';
import { CloudRoute } from '../lib/types';

type PanelTab = 'routes' | 'runs';
const PAGE_SIZE = 20;

export default function Home() {
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>('routes');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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

  const selected = filtered.find((r) => r.id === selectedId) ?? null;
  const rest = selected ? filtered.filter((r) => r.id !== selected.id) : filtered;
  const visibleRest = rest.slice(0, visibleCount);
  const city = selected?.city ?? filtered.find((r) => r.city)?.city ?? null;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
        <div className="discover-layout">
          <main className="discover-map">
            <div className="discover-search">
              <input
                type="text"
                placeholder="Search routes or city…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="discover-search-input"
              />
            </div>
            <DiscoverMap routes={filtered} selectedId={selectedId} onSelect={setSelectedId} fitToResults={query.trim().length > 0} />
          </main>

          <aside className="discover-panel">
            <div className="discover-panel-header">
              <div className="discover-panel-title">Discover</div>
              <div className="discover-panel-subtitle">
                {city ? `${city} · ` : ''}
                {filtered.length} route{filtered.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="discover-segmented">
              <button className="discover-segmented-item" data-active={tab === 'routes'} onClick={() => setTab('routes')}>
                Routes
              </button>
              <Link href="/runs" className="discover-segmented-item" data-active={false} style={{ display: 'block' }}>
                Group runs
              </Link>
            </div>

            {loading && <span style={{ padding: '4px 20px', fontSize: 13, color: 'var(--stone)' }}>Loading routes…</span>}
            {error && <span style={{ padding: '4px 20px', fontSize: 13, color: 'var(--danger)' }}>{error}</span>}
            {!loading && !error && filtered.length === 0 && (
              <span style={{ padding: '4px 20px', fontSize: 13, color: 'var(--stone)' }}>
                {query.trim() ? `No routes found for "${query.trim()}".` : 'No routes found.'}
              </span>
            )}

            {selected && (
              <div className="discover-selected-card">
                <div>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>{selected.name}</span>
                  <div style={{ marginTop: 2, fontSize: 12, color: 'var(--stone)' }}>
                    by @{selected.ownerUsername} · {selected.savesCount} saves
                  </div>
                </div>

                <div className="discover-stat-grid">
                  <div className="discover-stat-tile">
                    <span className="discover-stat-value">{selected.distanceKm.toFixed(1)} km</span>
                    <span className="discover-stat-label">Distance</span>
                  </div>
                  <div className="discover-stat-tile" data-tone="gain">
                    <span className="discover-stat-value">+{Math.round(selected.elevationGainM)}m</span>
                    <span className="discover-stat-label">Gain</span>
                  </div>
                  {selected.elevationProfile.length > 0 && (
                    <div className="discover-stat-tile" data-tone="peak">
                      <span className="discover-stat-value">
                        {Math.round(Math.max(...selected.elevationProfile.map((p) => p.elevation ?? 0)))}m
                      </span>
                      <span className="discover-stat-label">Peak</span>
                    </div>
                  )}
                </div>

                {selected.elevationProfile.length > 1 && <ElevationSparkline profile={selected.elevationProfile} />}

                <Link href={`/routes/${selected.id}`} className="discover-run-btn" style={{ textAlign: 'center' }}>
                  Run this route
                </Link>
              </div>
            )}

            {rest.length > 0 && <span className="discover-section-label">{selected ? 'More in this area' : 'All routes'}</span>}

            <div className="discover-panel-list">
              {visibleRest.map((route) => (
                <RouteListCard key={route.id} route={route} active={route.id === selectedId} onClick={() => setSelectedId(route.id)} />
              ))}
              {rest.length > visibleCount && (
                <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="builder-toolbar-btn" style={{ width: '100%' }}>
                  Load more ({rest.length - visibleCount} more)
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
