'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import { listUpcomingGroupRuns } from '../../lib/groupRunsApi';
import { GroupRun } from '../../lib/types';

export default function RunsPage() {
  const [runs, setRuns] = useState<GroupRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listUpcomingGroupRuns().then(setRuns).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />

      <main style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>Group runs</h1>
            <Link href="/runs/new" style={primaryBtnStyle}>
              Schedule a run
            </Link>
          </div>

          {loading && <span style={{ color: 'var(--stone)' }}>Loading…</span>}
          {!loading && runs.length === 0 && <span style={{ color: 'var(--stone)' }}>No upcoming group runs yet.</span>}

          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: 18,
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                boxShadow: 'var(--elevation-card)',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 15 }}>{run.title}</span>
              <span style={{ fontSize: 13, color: 'var(--stone)' }}>
                {new Date(run.scheduledAt).toLocaleString()} · {run.routeName} ({run.routeDistanceKm.toFixed(1)} km)
              </span>
              <span style={{ fontSize: 12, color: 'var(--mist)' }}>
                Hosted by {run.hostUsername} · {run.rsvpCount}
                {run.maxParticipants ? `/${run.maxParticipants}` : ''} going
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 'var(--radius-pill)',
  background: 'var(--coral)',
  color: 'var(--white)',
  fontWeight: 700,
  fontSize: 13,
};
