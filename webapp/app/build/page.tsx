'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import RoutePathMap from '../../components/RoutePathMap';
import { useAuth } from '../../lib/AuthContext';
import { metersToKm } from '../../lib/distance';
import { createRoute } from '../../lib/routesApi';
import { routeBetween, straightLineFallback } from '../../lib/routing';
import { ActivityType, RouteSegment, Waypoint } from '../../lib/types';

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'trail_run', label: 'Trail run' },
  { value: 'hike', label: 'Hike' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
];

export default function BuildPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [routing, setRouting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.push('/login?next=/build');
  }, [authLoading, session, router]);

  const distanceKm = metersToKm(segments.reduce((sum, s) => sum + s.distanceMeters, 0));

  async function handleMapClick(point: { lat: number; lng: number }) {
    const newPoint: Waypoint = { id: crypto.randomUUID(), latitude: point.lat, longitude: point.lng };
    const prev = waypoints[waypoints.length - 1];
    setWaypoints((w) => [...w, newPoint]);

    if (!prev) return;

    setRouting(true);
    try {
      const routed = await routeBetween(
        { latitude: prev.latitude, longitude: prev.longitude },
        { latitude: newPoint.latitude, longitude: newPoint.longitude },
      );
      setSegments((s) => [
        ...s,
        { fromId: prev.id, toId: newPoint.id, path: routed.path, distanceMeters: routed.distanceMeters },
      ]);
    } catch {
      const fallback = straightLineFallback(
        { latitude: prev.latitude, longitude: prev.longitude },
        { latitude: newPoint.latitude, longitude: newPoint.longitude },
      );
      setSegments((s) => [
        ...s,
        { fromId: prev.id, toId: newPoint.id, path: fallback.path, distanceMeters: fallback.distanceMeters },
      ]);
    } finally {
      setRouting(false);
    }
  }

  function handleUndo() {
    setWaypoints((w) => w.slice(0, -1));
    setSegments((s) => s.slice(0, -1));
  }

  function handleClear() {
    setWaypoints([]);
    setSegments([]);
  }

  async function handleSave() {
    if (!name.trim() || waypoints.length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const route = await createRoute({
        name: name.trim(),
        description: description.trim(),
        activityType,
        waypoints,
        segments,
        distanceKm,
        elevationGainM: 0,
        city: null,
      });
      router.push(`/routes/${route.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save route.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !session) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{
            width: 360,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            padding: 20,
            overflowY: 'auto',
            background: 'var(--cream)',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Build a route</h1>
          <p style={{ fontSize: 13, color: 'var(--stone)', lineHeight: 1.5 }}>
            Tap the map to drop your start point, then keep tapping to add stops. Rootah routes between each one
            along real streets.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Stat label={`${distanceKm.toFixed(2)} km`} />
            <Stat label={`${waypoints.length} ${waypoints.length === 1 ? 'point' : 'points'}`} />
            {routing && <Stat label="Routing…" />}
          </div>

          {waypoints.length > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleUndo} style={secondaryBtnStyle}>
                Undo last point
              </button>
              <button onClick={handleClear} style={secondaryBtnStyle}>
                Clear
              </button>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,.08)' }} />

          <input
            type="text"
            placeholder="Route name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
          <select value={activityType} onChange={(e) => setActivityType(e.target.value as ActivityType)} style={inputStyle}>
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}

          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || waypoints.length < 2}
            style={{
              ...primaryBtnStyle,
              opacity: saving || !name.trim() || waypoints.length < 2 ? 0.5 : 1,
              cursor: saving || !name.trim() || waypoints.length < 2 ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save route'}
          </button>
        </aside>

        <main style={{ flex: 1, position: 'relative' }}>
          <RoutePathMap waypoints={waypoints} segments={segments} onMapClick={handleMapClick} />
        </main>
      </div>
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

const inputStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(0,0,0,.1)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  background: 'var(--surface)',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '13px 20px',
  borderRadius: 'var(--radius-pill)',
  border: 'none',
  background: 'var(--coral)',
  color: 'var(--white)',
  fontWeight: 700,
  fontSize: 15,
  boxShadow: 'var(--elevation-primary-btn)',
};

const secondaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid rgba(0,0,0,.1)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};
