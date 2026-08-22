'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ElevationChart from '../../../components/ElevationChart';
import Sidebar from '../../../components/Sidebar';
import RoutePathMap from '../../../components/RoutePathMap';
import RouteSocial from '../../../components/RouteSocial';
import { useAuth } from '../../../lib/AuthContext';
import { buildElevationProfile } from '../../../lib/elevationProfile';
import { getRoute, toggleLike, toggleSave } from '../../../lib/routesApi';
import { CloudRoute } from '../../../lib/types';

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

// Rough pace assumption for the "Est. time" tile — matches the mobile app's
// estimate (6 min/km jogging pace), not a per-user configurable value yet.
const EST_MIN_PER_KM = 6;

function formatEstTime(distanceKm: number): string {
  const totalMin = Math.round(distanceKm * EST_MIN_PER_KM);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [route, setRoute] = useState<CloudRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRoute(id)
      .then((r) => {
        if (!r) {
          setError('Route not found.');
          return;
        }
        setRoute(r);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleLike() {
    if (!route) return;
    if (!session) {
      router.push('/login');
      return;
    }
    setBusy(true);
    try {
      await toggleLike(route.id, route.isLikedByMe);
      setRoute({
        ...route,
        isLikedByMe: !route.isLikedByMe,
        likesCount: route.likesCount + (route.isLikedByMe ? -1 : 1),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!route) return;
    if (!session) {
      router.push('/login');
      return;
    }
    setBusy(true);
    try {
      await toggleSave(route.id, route.isSavedByMe);
      setRoute({
        ...route,
        isSavedByMe: !route.isSavedByMe,
        savesCount: route.savesCount + (route.isSavedByMe ? -1 : 1),
      });
    } finally {
      setBusy(false);
    }
  }

  const profile = route && route.elevationProfile.length > 1 ? buildElevationProfile(route.elevationProfile) : null;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--stone)' }}>Loading route…</span>
          </div>
        )}

        {error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--danger)' }}>{error}</span>
          </div>
        )}

        {route && (
          <div className="route-detail-scroll">
            <div className="route-detail-hero">
              <Link href="/" className="route-detail-back">
                ← Discover
              </Link>
              <RoutePathMap waypoints={route.waypoints} segments={route.segments} interactive />
            </div>

            <div className="route-detail-body">
              <div className="route-detail-main">
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.4px' }}>{route.name}</h1>
                  <span style={{ fontSize: 13, color: 'var(--stone)' }}>
                    By{' '}
                    <Link href={`/profile/${route.ownerId}`} style={{ color: 'var(--ink)', fontWeight: 700 }}>
                      {route.ownerUsername}
                    </Link>
                    {route.city ? ` · ${route.city}` : ''}
                  </span>
                </div>

                <div className="discover-stat-grid">
                  <div className="discover-stat-tile">
                    <span className="discover-stat-value">{route.distanceKm.toFixed(1)} km</span>
                    <span className="discover-stat-label">Distance</span>
                  </div>
                  <div className="discover-stat-tile">
                    <span className="discover-stat-value">+{Math.round(route.elevationGainM)}m</span>
                    <span className="discover-stat-label">Gain</span>
                  </div>
                  <div className="discover-stat-tile">
                    <span className="discover-stat-value">{ACTIVITY_LABEL[route.activityType] ?? route.activityType}</span>
                    <span className="discover-stat-label">Type</span>
                  </div>
                  <div className="discover-stat-tile">
                    <span className="discover-stat-value">{formatEstTime(route.distanceKm)}</span>
                    <span className="discover-stat-label">Est. time</span>
                  </div>
                </div>

                {profile && (
                  <div className="route-detail-card">
                    <ElevationChart path={route.elevationProfile} height={100} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--stone)', fontWeight: 600 }}>Low {Math.round(profile.minElevation)} m</span>
                      <span style={{ fontSize: 11.5, color: 'var(--stone)', fontWeight: 600 }}>Peak {Math.round(profile.maxElevation)} m</span>
                    </div>
                  </div>
                )}

                {route.description && (
                  <div className="route-detail-card">
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      About this route
                    </span>
                    <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{route.description}</p>
                  </div>
                )}
              </div>

              <div className="route-detail-rail">
                <div className="route-detail-card" style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleLike} disabled={busy} style={pillBtnStyle(route.isLikedByMe)}>
                    ♥ {route.likesCount}
                  </button>
                  <button onClick={handleSave} disabled={busy} style={pillBtnStyle(route.isSavedByMe)}>
                    {route.isSavedByMe ? 'Saved' : 'Save'} · {route.savesCount}
                  </button>
                </div>

                {route.completionCount > 0 && (
                  <span style={{ fontSize: 13, color: 'var(--stone)', padding: '0 4px' }}>
                    Ran by {route.completionCount} {route.completionCount === 1 ? 'person' : 'people'}
                  </span>
                )}

                <RouteSocial routeId={route.id} onLogged={() => setRoute({ ...route, completionCount: route.completionCount + 1 })} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function pillBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '9px 16px',
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    background: active ? 'var(--coral)' : 'var(--sheet-bg)',
    color: active ? 'var(--white)' : 'var(--ink)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    flex: 1,
  };
}
