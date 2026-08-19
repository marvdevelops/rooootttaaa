'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Header from '../../../components/Header';
import { useAuth } from '../../../lib/AuthContext';
import { createGroupRun } from '../../../lib/groupRunsApi';
import { listPublicRoutes } from '../../../lib/routesApi';
import { CloudRoute } from '../../../lib/types';

export default function NewRunPage() {
  return (
    <Suspense fallback={null}>
      <NewRunForm />
    </Suspense>
  );
}

function NewRunForm() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeIdParam = searchParams.get('routeId');

  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [routeId, setRouteId] = useState(routeIdParam ?? '');
  const [routeQuery, setRouteQuery] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('06:00');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.push('/login?next=/runs/new');
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!routeIdParam) listPublicRoutes({ limit: 100 }).then(setRoutes);
  }, [routeIdParam]);

  const filteredRoutes = useMemo(() => {
    const q = routeQuery.trim().toLowerCase();
    if (!q) return routes.slice(0, 20);
    return routes.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 20);
  }, [routes, routeQuery]);

  const selectedRoute = routes.find((r) => r.id === routeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!routeId || !title.trim() || !date) return;
    setSaving(true);
    setError(null);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`);
      const run = await createGroupRun({
        routeId,
        title: title.trim(),
        description: description.trim(),
        scheduledAt,
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      });
      router.push(`/runs/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule run.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !session) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <main style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', justifyContent: 'center' }}>
        <form
          onSubmit={handleSubmit}
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
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Schedule a group run</h1>

          {!routeIdParam && !selectedRoute && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                placeholder="Search routes…"
                value={routeQuery}
                onChange={(e) => setRouteQuery(e.target.value)}
                style={inputStyle}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                {filteredRoutes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRouteId(r.id)}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'var(--sheet-bg)',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {r.name} · {r.distanceKm.toFixed(1)} km
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedRoute && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--sheet-bg)' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{selectedRoute.name}</span>
              {!routeIdParam && (
                <button type="button" onClick={() => setRouteId('')} style={{ background: 'none', border: 'none', color: 'var(--coral)', fontSize: 12, cursor: 'pointer' }}>
                  Change
                </button>
              )}
            </div>
          )}

          <input type="text" placeholder="Run title" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <input
            type="number"
            placeholder="Max participants (optional)"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            style={inputStyle}
          />

          {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}

          <button type="submit" disabled={saving || !routeId || !title.trim() || !date} style={primaryBtnStyle}>
            {saving ? 'Scheduling…' : 'Schedule run'}
          </button>
        </form>
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '11px 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(0,0,0,.1)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 'var(--radius-pill)',
  border: 'none',
  background: 'var(--coral)',
  color: 'var(--white)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
