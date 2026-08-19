'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Header from '../../../components/Header';
import { useAuth } from '../../../lib/AuthContext';
import { FreeJoinLimitError, getGroupRun, setGroupRunRsvp } from '../../../lib/groupRunsApi';
import { GroupRun } from '../../../lib/types';

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [run, setRun] = useState<GroupRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getGroupRun(id)
      .then(setRun)
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <main style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', justifyContent: 'center' }}>
        {loading && <span style={{ color: 'var(--stone)' }}>Loading…</span>}
        {error && !run && <span style={{ color: 'var(--danger)' }}>{error}</span>}

        {run && (
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 28,
              boxShadow: 'var(--elevation-card)',
              height: 'fit-content',
            }}
          >
            {run.clubName && (
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)' }}>{run.clubName} event</span>
            )}
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{run.title}</h1>
            <span style={{ fontSize: 14, color: 'var(--stone)' }}>{new Date(run.scheduledAt).toLocaleString()}</span>

            <Link
              href={`/routes/${run.routeId}`}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--sheet-bg)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {run.routeName} · {run.routeDistanceKm.toFixed(1)} km
            </Link>

            {run.description && <p style={{ fontSize: 14, color: 'var(--stone)', lineHeight: 1.5 }}>{run.description}</p>}

            <span style={{ fontSize: 13, color: 'var(--stone)' }}>
              Hosted by <strong style={{ color: 'var(--ink)' }}>{run.hostUsername}</strong>
            </span>

            <span style={{ fontSize: 13, color: 'var(--stone)' }}>
              {run.rsvpCount}
              {run.maxParticipants ? `/${run.maxParticipants}` : ''} going
            </span>

            {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}

            {!run.isHostedByMe && (
              <button onClick={handleRsvp} disabled={busy} style={pillBtnStyle(run.isRsvpedByMe)}>
                {run.isRsvpedByMe ? "I'm going ✓" : 'RSVP'}
              </button>
            )}
            {run.isHostedByMe && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sage)' }}>You&apos;re hosting this run</span>}
          </div>
        )}
      </main>
    </div>
  );
}

function pillBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '12px 18px',
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    background: active ? 'var(--sage)' : 'var(--coral)',
    color: 'var(--white)',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  };
}
