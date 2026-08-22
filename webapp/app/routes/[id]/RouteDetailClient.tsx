'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ElevationChart from '../../../components/ElevationChart';
import Sidebar from '../../../components/Sidebar';
import RoutePathMap from '../../../components/RoutePathMap';
import RouteSocial from '../../../components/RouteSocial';
import { useAuth } from '../../../lib/AuthContext';
import { listRouteCompletions } from '../../../lib/completionsApi';
import { buildElevationProfile } from '../../../lib/elevationProfile';
import { getRoute, toggleLike, toggleSave } from '../../../lib/routesApi';
import { CloudRoute, CompletionParticipant } from '../../../lib/types';

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

export default function RouteDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { session } = useAuth();
  const [route, setRoute] = useState<CloudRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finishers, setFinishers] = useState<CompletionParticipant[]>([]);

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
    listRouteCompletions(id, 8).then(setFinishers);
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
              <RoutePathMap waypoints={route.waypoints} segments={route.segments} notes={route.notes} interactive />
            </div>

            <div className="route-detail-body">
              <div className="route-detail-main">
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,.06)',
                      color: 'var(--ink)',
                      marginBottom: 8,
                    }}
                  >
                    {ACTIVITY_LABEL[route.activityType] ?? route.activityType}
                  </span>
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
                  <div className="discover-stat-tile" data-tone="gain">
                    <span className="discover-stat-value">+{Math.round(route.elevationGainM)}m</span>
                    <span className="discover-stat-label">Gain</span>
                  </div>
                  {profile && (
                    <div className="discover-stat-tile" data-tone="peak">
                      <span className="discover-stat-value">{Math.round(profile.maxElevation)}m</span>
                      <span className="discover-stat-label">Peak</span>
                    </div>
                  )}
                  <div className="discover-stat-tile" data-tone="neutral">
                    <span className="discover-stat-value">{formatEstTime(route.distanceKm)}</span>
                    <span className="discover-stat-label">Est. time</span>
                  </div>
                </div>

                {profile && (
                  <div className="route-detail-card">
                    <ElevationChart path={route.elevationProfile} height={100} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
                      <LegendDot color="#2ecc71" label="Flat" />
                      <LegendDot color="#f39c12" label="Rolling" />
                      <LegendDot color="#e74c3c" label="Climb" />
                      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--stone)', fontWeight: 600 }}>
                        Low {Math.round(profile.minElevation)}m · Peak {Math.round(profile.maxElevation)}m
                      </span>
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

                {route.isOwnedByMe ? (
                  <Link href={`/build?edit=${route.id}`} className="discover-run-btn" style={{ textAlign: 'center' }}>
                    Edit route
                  </Link>
                ) : (
                  session && (
                    <Link href={`/build?from=${route.id}`} className="discover-run-btn" style={{ textAlign: 'center' }}>
                      Save your own copy
                    </Link>
                  )
                )}

                {route.completionCount > 0 && (
                  <span style={{ fontSize: 13, color: 'var(--stone)', padding: '0 4px' }}>
                    Ran by {route.completionCount} {route.completionCount === 1 ? 'person' : 'people'}
                  </span>
                )}

                <RouteSocial routeId={route.id} onLogged={() => setRoute({ ...route, completionCount: route.completionCount + 1 })} />

                {finishers.length > 0 && (
                  <div>
                    <span
                      style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mist)' }}
                    >
                      Recent finishers
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                      {finishers.map((f) => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {f.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.avatarUrl} alt={f.username} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                background: 'var(--sheet-bg)',
                                color: 'var(--coral)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: 13,
                                flexShrink: 0,
                              }}
                            >
                              {f.username.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{f.username}</span>
                            <span style={{ fontSize: 11.5, color: 'var(--stone)' }}>{relativeTime(f.completedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function relativeTime(ms: number): string {
  const diffDays = Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--stone)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {label}
    </span>
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
