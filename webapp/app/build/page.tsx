'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import ElevationChart from '../../components/ElevationChart';
import Sidebar from '../../components/Sidebar';
import RoutePathMap from '../../components/RoutePathMap';
import { useAuth } from '../../lib/AuthContext';
import { metersToKm } from '../../lib/distance';
import { annotateElevation } from '../../lib/elevation';
import { downsampleForStorage } from '../../lib/elevationProfile';
import { createRoute, getRoute, updateRoute } from '../../lib/routesApi';
import { routeBetween, straightLineFallback } from '../../lib/routing';
import { ActivityType, PathPoint, RouteNote, RouteSegment, Waypoint } from '../../lib/types';

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'trail_run', label: 'Trail run' },
  { value: 'hike', label: 'Hike' },
  { value: 'bike', label: 'Bike' },
  { value: 'walk', label: 'Walk' },
];

export default function BuildPage() {
  return (
    <Suspense fallback={null}>
      <BuildForm />
    </Suspense>
  );
}

function BuildForm() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRouteId = searchParams.get('edit');
  const fromRouteId = searchParams.get('from');

  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [segments, setSegments] = useState<RouteSegment[]>([]);
  const [notes, setNotes] = useState<RouteNote[]>([]);
  const [noteMode, setNoteMode] = useState(false);
  const [routing, setRouting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elevationPath, setElevationPath] = useState<PathPoint[]>([]);
  const [elevationGainM, setElevationGainM] = useState(0);
  const [elevationLoading, setElevationLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(!!(editRouteId || fromRouteId));

  useEffect(() => {
    if (!authLoading && !session) router.push('/login?next=/build');
  }, [authLoading, session, router]);

  useEffect(() => {
    const sourceId = editRouteId ?? fromRouteId;
    if (!sourceId || !session) {
      setPrefilling(false);
      return;
    }
    getRoute(sourceId)
      .then((route) => {
        if (!route) {
          setError('Route not found.');
          return;
        }
        if (editRouteId && !route.isOwnedByMe) {
          router.push(`/routes/${editRouteId}`);
          return;
        }
        setWaypoints(route.waypoints);
        setSegments(route.segments);
        setNotes(route.notes);
        setName(fromRouteId ? `${route.name} (copy)` : route.name);
        setDescription(route.description);
        setActivityType(route.activityType);
        setElevationPath(route.elevationProfile);
        setElevationGainM(Math.round(route.elevationGainM));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load route.'))
      .finally(() => setPrefilling(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRouteId, fromRouteId, session]);

  const distanceKm = metersToKm(segments.reduce((sum, s) => sum + s.distanceMeters, 0));
  const fullPath = segments.flatMap((s) => s.path);

  useEffect(() => {
    if (fullPath.length < 2) return;
    let cancelled = false;
    setElevationLoading(true);
    annotateElevation(fullPath)
      .then(({ path, gainMeters }) => {
        if (cancelled) return;
        setElevationPath(path);
        setElevationGainM(Math.round(gainMeters));
      })
      .catch(() => {
        if (!cancelled) {
          setElevationPath([]);
          setElevationGainM(0);
        }
      })
      .finally(() => {
        if (!cancelled) setElevationLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  async function handleMapClick(point: { lat: number; lng: number }) {
    if (noteMode) {
      setNotes((n) => [...n, { id: crypto.randomUUID(), latitude: point.lat, longitude: point.lng, text: '' }]);
      return;
    }

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

  async function handleRemoveWaypoint(id: string) {
    const idx = waypoints.findIndex((w) => w.id === id);
    if (idx === -1) return;
    const prev = waypoints[idx - 1];
    const next = waypoints[idx + 1];
    // Position of the prev→removed segment in the *current* segments array —
    // captured now so the bridge segment (once routed) can be spliced back
    // into the same spot, keeping segment order (and therefore the drawn
    // line) correct instead of just appending it at the end.
    const insertAt = segments.findIndex((seg) => seg.toId === id);

    setWaypoints((w) => w.filter((wp) => wp.id !== id));
    setSegments((s) => s.filter((seg) => seg.fromId !== id && seg.toId !== id));

    if (!prev || !next) return;

    setRouting(true);
    try {
      let bridge: RouteSegment;
      try {
        const routed = await routeBetween(
          { latitude: prev.latitude, longitude: prev.longitude },
          { latitude: next.latitude, longitude: next.longitude },
        );
        bridge = { fromId: prev.id, toId: next.id, path: routed.path, distanceMeters: routed.distanceMeters };
      } catch {
        const fallback = straightLineFallback(
          { latitude: prev.latitude, longitude: prev.longitude },
          { latitude: next.latitude, longitude: next.longitude },
        );
        bridge = { fromId: prev.id, toId: next.id, path: fallback.path, distanceMeters: fallback.distanceMeters };
      }
      setSegments((s) => {
        const copy = [...s];
        copy.splice(Math.min(insertAt, copy.length), 0, bridge);
        return copy;
      });
    } finally {
      setRouting(false);
    }
  }

  function handleClear() {
    setWaypoints([]);
    setSegments([]);
    setNotes([]);
  }

  function updateNoteText(id: string, text: string) {
    setNotes((n) => n.map((note) => (note.id === id ? { ...note, text } : note)));
  }

  function removeNote(id: string) {
    setNotes((n) => n.filter((note) => note.id !== id));
  }

  async function handleSave() {
    if (!name.trim() || waypoints.length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        description: description.trim(),
        activityType,
        waypoints,
        segments,
        notes,
        distanceKm,
        elevationGainM,
        elevationProfile: downsampleForStorage(elevationPath),
        city: null,
      };
      const route = editRouteId ? await updateRoute(editRouteId, input) : await createRoute(input);
      router.push(`/routes/${route.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save route.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !session || prefilling) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
        <div className="builder-toolbar">
          <button onClick={() => router.push('/')} className="builder-toolbar-btn">
            Cancel
          </button>
          <div className="builder-toolbar-actions">
            <button onClick={() => setNoteMode((v) => !v)} className="builder-toolbar-btn" style={noteMode ? { background: 'var(--coral)', color: 'var(--white)' } : undefined}>
              {noteMode ? 'Adding notes…' : '+ Note'}
            </button>
            <button onClick={handleUndo} disabled={waypoints.length === 0} className="builder-toolbar-btn">
              Undo
            </button>
            <button onClick={handleClear} disabled={waypoints.length === 0 && notes.length === 0} className="builder-toolbar-btn">
              Clear all
            </button>
          </div>
        </div>

        <div className="split-layout">
          <aside className="split-sidebar">
            <div className="route-detail-card" style={{ padding: 14 }}>
              <h1 style={{ fontSize: 17, fontWeight: 800 }}>{editRouteId ? 'Edit route' : 'Build a route'}</h1>
              <p style={{ marginTop: 6, fontSize: 12.5, color: 'var(--stone)', lineHeight: 1.5 }}>
                {noteMode
                  ? 'Tap the map to drop a note pin, then describe it below.'
                  : 'Tap the map (+) to add a stop — Rootah routes between each one along real streets. Tap an existing point (−) to remove it.'}
              </p>
            </div>

            <div className="discover-stat-grid">
              <div className="discover-stat-tile">
                <span className="discover-stat-value">{distanceKm.toFixed(2)} km</span>
                <span className="discover-stat-label">Distance</span>
              </div>
              <div className="discover-stat-tile">
                <span className="discover-stat-value">{waypoints.length}</span>
                <span className="discover-stat-label">Points</span>
              </div>
              {elevationGainM > 0 && (
                <div className="discover-stat-tile">
                  <span className="discover-stat-value">+{elevationGainM}m</span>
                  <span className="discover-stat-label">Gain</span>
                </div>
              )}
            </div>

            {(routing || elevationLoading) && (
              <span style={{ fontSize: 12, color: 'var(--stone)' }}>{routing ? 'Routing…' : 'Reading elevation…'}</span>
            )}

            {elevationPath.length > 1 && (
              <div className="route-detail-card">
                <ElevationChart path={elevationPath} height={80} />
              </div>
            )}

            {waypoints.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {waypoints.map((wp, i) => (
                  <div key={wp.id} className="builder-point-row">
                    <span className="builder-point-index">{i + 1}</span>
                    <span>{i === 0 ? 'Start' : i === waypoints.length - 1 ? 'End' : `Waypoint ${i}`}</span>
                  </div>
                ))}
              </div>
            )}

            {notes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="discover-section-label" style={{ padding: 0 }}>
                  Notes
                </span>
                {notes.map((note) => (
                  <div key={note.id} style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      placeholder="e.g. water stop"
                      value={note.text}
                      onChange={(e) => updateNoteText(note.id, e.target.value)}
                      style={{ ...inputStyle, flex: 1, padding: '8px 10px', fontSize: 12.5 }}
                    />
                    <button onClick={() => removeNote(note.id)} className="builder-toolbar-btn" aria-label="Remove note">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="route-detail-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            </div>

            {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}

            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || waypoints.length < 2}
              className="discover-run-btn"
              style={{
                opacity: saving || !name.trim() || waypoints.length < 2 ? 0.5 : 1,
                cursor: saving || !name.trim() || waypoints.length < 2 ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : editRouteId ? 'Save changes' : 'Save route'}
            </button>
          </aside>

          <main className="split-main">
            <RoutePathMap waypoints={waypoints} segments={segments} notes={notes} onMapClick={handleMapClick} onRemoveWaypoint={handleRemoveWaypoint} />
          </main>
        </div>
      </div>
    </div>
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
