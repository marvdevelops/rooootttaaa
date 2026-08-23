'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import RoutePathMap from '../../../components/RoutePathMap';
import ShareButton from '../../../components/ShareButton';
import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../lib/AuthContext';
import { FreeJoinLimitError, getGroupRun, incrementGroupRunShareCount, setGroupRunRsvp } from '../../../lib/groupRunsApi';
import { getRoute } from '../../../lib/routesApi';
import { CloudRoute, GroupRun } from '../../../lib/types';

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Ride',
  walk: 'Walk',
  other: 'Route',
};

export default function RunDetailClient({ id }: { id: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const [run, setRun] = useState<GroupRun | null>(null);
  const [route, setRoute] = useState<CloudRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getGroupRun(id)
      .then((r) => {
        setRun(r);
        return getRoute(r.routeId);
      })
      .then((r) => setRoute(r))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRsvp() {
    if (!run) return;
    if (!session) {
      router.push(`/login?next=/runs/${id}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setGroupRunRsvp(run.id, !run.isRsvpedByMe);
      setRun({
        ...run,
        isRsvpedByMe: !run.isRsvpedByMe,
        myRsvpStatus: run.isRsvpedByMe ? null : 'approved',
        rsvpCount: run.rsvpCount + (run.isRsvpedByMe ? -1 : 1),
      });
    } catch (err) {
      if (err instanceof FreeJoinLimitError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Failed to RSVP.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--stone)' }}>Loading…</span>
          </div>
        )}
        {error && !run && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--danger)' }}>{error}</span>
          </div>
        )}

        {run && (
          <div className="route-detail-scroll">
            <div className="route-detail-hero">
              <Link href="/runs" className="route-detail-back">
                ← Group runs
              </Link>
              {route ? (
                <RoutePathMap waypoints={route.waypoints} segments={route.segments} notes={route.notes} interactive />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--map-land)' }} />
              )}
            </div>

            <div className="route-detail-body">
              <div className="route-detail-main">
                <div>
                  {run.clubName && (
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: 'rgba(75,171,184,.14)',
                        color: 'var(--teal)',
                        marginBottom: 8,
                      }}
                    >
                      {run.clubName} event
                    </span>
                  )}
                  <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.4px' }}>{run.title}</h1>
                  <span style={{ fontSize: 13, color: 'var(--stone)' }}>
                    Hosted by <strong style={{ color: 'var(--ink)' }}>{run.hostUsername}</strong>
                    {run.city ? ` · ${run.city}` : ''}
                  </span>
                </div>

                <div className="discover-stat-grid">
                  <div className="discover-stat-tile">
                    <span className="discover-stat-value">{new Date(run.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className="discover-stat-label">Date</span>
                  </div>
                  <div className="discover-stat-tile">
                    <span className="discover-stat-value">{new Date(run.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="discover-stat-label">Time</span>
                  </div>
                  <div className="discover-stat-tile" data-tone="gain">
                    <span className="discover-stat-value">{run.routeDistanceKm.toFixed(1)} km</span>
                    <span className="discover-stat-label">Distance</span>
                  </div>
                  <div className="discover-stat-tile" data-tone="neutral">
                    <span className="discover-stat-value">
                      {run.rsvpCount}
                      {run.maxParticipants ? `/${run.maxParticipants}` : ''}
                    </span>
                    <span className="discover-stat-label">Going</span>
                  </div>
                </div>

                <Link href={`/routes/${run.routeId}`} className="route-detail-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{run.routeName}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--coral)', fontWeight: 700 }}>
                    {route ? (ACTIVITY_LABEL[route.activityType] ?? route.activityType) : 'View route'} →
                  </span>
                </Link>

                {run.description && (
                  <div className="route-detail-card">
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      About this run
                    </span>
                    <p style={{ marginTop: 8, fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>{run.description}</p>
                  </div>
                )}
              </div>

              <div className="route-detail-rail">
                {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}

                {run.isHostedByMe ? (
                  <span className="route-detail-card" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--sage)' }}>
                    You&apos;re hosting this run
                  </span>
                ) : (
                  <button onClick={handleRsvp} disabled={busy} className="discover-run-btn" style={{ background: run.isRsvpedByMe ? 'var(--sage)' : 'var(--coral)' }}>
                    {run.isRsvpedByMe ? "I'm going ✓" : 'RSVP'}
                  </button>
                )}

                <ShareButton
                  title={run.title}
                  text={`${run.title} — ${new Date(run.scheduledAt).toLocaleString()} on Rootah`}
                  url={typeof window !== 'undefined' ? window.location.href : `https://app.rootah.com/runs/${run.id}`}
                  count={run.shareCount}
                  onShare={() => {
                    incrementGroupRunShareCount(run.id);
                    setRun({ ...run, shareCount: run.shareCount + 1 });
                  }}
                  className="route-detail-card"
                  style={{ textAlign: 'center', fontWeight: 700, cursor: 'pointer', border: 'none', fontSize: 13.5, color: 'var(--ink)' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
