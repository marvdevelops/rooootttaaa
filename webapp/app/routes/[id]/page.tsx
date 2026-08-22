'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ElevationChart from '../../../components/ElevationChart';
import Header from '../../../components/Header';
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />

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
        <div className="split-layout">
          <aside className="split-sidebar">
            <Link href="/" style={{ fontSize: 13, color: 'var(--stone)', fontWeight: 600 }}>
              ← Back to Discover
            </Link>

            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{route.name}</h1>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Stat label={ACTIVITY_LABEL[route.activityType] ?? route.activityType} />
              <Stat label={`${route.distanceKm.toFixed(1)} km`} />
              {route.elevationGainM > 0 && <Stat label={`↑ ${Math.round(route.elevationGainM)} m`} />}
              {route.city && <Stat label={route.city} />}
            </div>

            {route.elevationProfile.length > 1 && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: 12, boxShadow: 'var(--elevation-subtle)' }}>
                <ElevationChart path={route.elevationProfile} height={80} />
                {(() => {
                  const profile = buildElevationProfile(route.elevationProfile);
                  return profile.points.length > 1 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--stone)' }}>Low {Math.round(profile.minElevation)} m</span>
                      <span style={{ fontSize: 11, color: 'var(--stone)' }}>Peak {Math.round(profile.maxElevation)} m</span>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {route.description && <p style={{ fontSize: 14, color: 'var(--stone)', lineHeight: 1.5 }}>{route.description}</p>}

            <span style={{ fontSize: 13, color: 'var(--stone)' }}>
              By{' '}
              <Link href={`/profile/${route.ownerId}`} style={{ color: 'var(--ink)', fontWeight: 700 }}>
                {route.ownerUsername}
              </Link>
            </span>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleLike} disabled={busy} style={pillBtnStyle(route.isLikedByMe)}>
                ♥ {route.likesCount}
              </button>
              <button onClick={handleSave} disabled={busy} style={pillBtnStyle(route.isSavedByMe)}>
                {route.isSavedByMe ? 'Saved' : 'Save'} · {route.savesCount}
              </button>
            </div>

            {route.completionCount > 0 && (
              <span style={{ fontSize: 13, color: 'var(--stone)' }}>
                Ran by {route.completionCount} {route.completionCount === 1 ? 'person' : 'people'}
              </span>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,.08)', width: '100%' }} />

            <RouteSocial
              routeId={route.id}
              onLogged={() => setRoute({ ...route, completionCount: route.completionCount + 1 })}
            />
          </aside>

          <main className="split-main">
            <RoutePathMap waypoints={route.waypoints} segments={route.segments} interactive />
          </main>
        </div>
      )}
    </div>
  );
}

function Stat({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '5px 10px',
        borderRadius: 'var(--radius-xs)',
        background: 'rgba(0,0,0,.06)',
        color: 'var(--ink)',
      }}
    >
      {label}
    </span>
  );
}

function pillBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '9px 16px',
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    background: active ? 'var(--coral)' : 'var(--surface)',
    color: active ? 'var(--white)' : 'var(--ink)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: 'var(--elevation-subtle)',
  };
}
