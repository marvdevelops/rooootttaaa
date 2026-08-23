'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import GroupRunComments from '../../../components/GroupRunComments';
import PaywallModal from '../../../components/PaywallModal';
import RoutePathMap from '../../../components/RoutePathMap';
import ShareButton from '../../../components/ShareButton';
import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../lib/AuthContext';
import {
  FreeJoinLimitError,
  getGroupRun,
  incrementGroupRunShareCount,
  listGroupRunParticipants,
  respondToJoinRequest,
  setGroupRunRsvp,
} from '../../../lib/groupRunsApi';
import { getRoute } from '../../../lib/routesApi';
import { CloudRoute, GroupRun, GroupRunParticipant } from '../../../lib/types';

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
  const [pending, setPending] = useState<GroupRunParticipant[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);

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

  useEffect(() => {
    if (!run?.isHostedByMe) return;
    listGroupRunParticipants(id).then((all) => setPending(all.filter((p) => p.status === 'pending')));
  }, [id, run?.isHostedByMe]);

  async function handleRsvp() {
    if (!run) return;
    if (!session) {
      router.push(`/login?next=/runs/${id}`);
      return;
    }
    const wasActive = run.myRsvpStatus === 'pending' || run.myRsvpStatus === 'approved';
    setBusy(true);
    setError(null);
    try {
      await setGroupRunRsvp(run.id, !wasActive);
      setRun({
        ...run,
        isRsvpedByMe: false,
        myRsvpStatus: wasActive ? null : 'pending',
        rsvpCount: run.rsvpCount + (run.myRsvpStatus === 'approved' && wasActive ? -1 : 0),
      });
    } catch (err) {
      if (err instanceof FreeJoinLimitError) setShowPaywall(true);
      else setError(err instanceof Error ? err.message : 'Failed to RSVP.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond(userId: string, approve: boolean) {
    if (!run) return;
    await respondToJoinRequest(run.id, userId, approve);
    setPending((p) => p.filter((r) => r.userId !== userId));
    if (approve) setRun({ ...run, rsvpCount: run.rsvpCount + 1 });
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
                <RoutePathMap waypoints={route.waypoints} segments={route.segments} notes={route.notes} interactive={false} />
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

                <div className="route-detail-card">
                  <GroupRunComments groupRunId={run.id} />
                </div>
              </div>

              <div className="route-detail-rail">
                {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}

                {run.isHostedByMe ? (
                  <span className="route-detail-card" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--sage)' }}>
                    You&apos;re hosting this run
                  </span>
                ) : (
                  <button
                    onClick={handleRsvp}
                    disabled={busy || run.myRsvpStatus === 'pending'}
                    className="discover-run-btn"
                    style={{ background: run.myRsvpStatus === 'approved' ? 'var(--sage)' : run.myRsvpStatus === 'pending' ? 'var(--mist)' : 'var(--coral)' }}
                  >
                    {run.myRsvpStatus === 'approved' ? "I'm going ✓" : run.myRsvpStatus === 'pending' ? 'Request pending approval' : 'RSVP'}
                  </button>
                )}

                {run.isHostedByMe && pending.length > 0 && (
                  <div className="route-detail-card">
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Pending requests
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                      {pending.map((p) => (
                        <div key={p.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{p.username}</span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handleRespond(p.userId, true)}
                              style={{ fontSize: 12, fontWeight: 700, color: 'var(--sage)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRespond(p.userId, false)}
                              style={{ fontSize: 12, fontWeight: 700, color: 'var(--stone)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
      {showPaywall && <PaywallModal trigger="group_run_join_limit" onClose={() => setShowPaywall(false)} />}
    </div>
  );
}
