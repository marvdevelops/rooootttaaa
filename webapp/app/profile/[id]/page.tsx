'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../lib/AuthContext';
import { listCompletionActivity } from '../../../lib/completionsApi';
import { getProfile, updateProfile } from '../../../lib/profilesApi';
import { listRoutesByOwner } from '../../../lib/routesApi';
import { CloudRoute, PublicProfile, RouteCompletionActivityItem } from '../../../lib/types';

const ACTIVITY_LABEL: Record<string, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const isOwn = session?.user.id === id;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [routes, setRoutes] = useState<CloudRoute[]>([]);
  const [activity, setActivity] = useState<RouteCompletionActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getProfile(id)
      .then((p) => {
        setProfile(p);
        setUsername(p.username);
        setBio(p.bio);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    listRoutesByOwner(id).then(setRoutes);
    listCompletionActivity(id, 20).then(setActivity);
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile({ username: username.trim(), bio: bio.trim() });
      setProfile((p) => (p ? { ...p, username: username.trim(), bio: bio.trim() } : p));
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
        <main style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: 32 }}>
          {loading && <span style={{ color: 'var(--stone)' }}>Loading…</span>}
          {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}

          {profile && (
            <div style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 28,
                  boxShadow: 'var(--elevation-card)',
                }}
              >
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt={profile.username}
                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'var(--sheet-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 800,
                      color: 'var(--coral)',
                    }}
                  >
                    {profile.username.slice(0, 1).toUpperCase()}
                  </div>
                )}

                {editing ? (
                  <>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      style={inputStyle}
                      placeholder="Username"
                    />
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }}
                      placeholder="Bio"
                    />
                    {saveError && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{saveError}</span>}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={() => setEditing(false)} style={secondaryBtnStyle}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h1 style={{ fontSize: 22, fontWeight: 800 }}>{profile.username}</h1>
                      {profile.tier === 'paid' && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: 'var(--coral)',
                            color: 'var(--white)',
                          }}
                        >
                          PRO
                        </span>
                      )}
                    </div>
                    {profile.bio && <p style={{ fontSize: 14, color: 'var(--stone)', lineHeight: 1.5 }}>{profile.bio}</p>}
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ fontSize: 12, color: 'var(--mist)' }}>
                        <strong style={{ color: 'var(--ink)' }}>{routes.length}</strong> routes
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--mist)' }}>
                        <strong style={{ color: 'var(--ink)' }}>{activity.length}</strong> runs logged
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--mist)' }}>
                        Joined {new Date(profile.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {isOwn && (
                      <button onClick={() => setEditing(true)} style={secondaryBtnStyle}>
                        Edit profile
                      </button>
                    )}
                  </>
                )}
              </div>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>Routes</h2>
                {routes.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--stone)' }}>No public routes yet.</span>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                    {routes.map((route) => (
                      <Link
                        key={route.id}
                        href={`/routes/${route.id}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          padding: 14,
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface)',
                          boxShadow: 'var(--elevation-subtle)',
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{route.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--stone)' }}>{route.distanceKm.toFixed(1)} km</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: 'rgba(0,0,0,.06)' }}>
                            {ACTIVITY_LABEL[route.activityType] ?? route.activityType}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>Activity</h2>
                {activity.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--stone)' }}>No logged runs yet.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activity.map((item) => (
                      <Link
                        key={item.id}
                        href={`/routes/${item.routeId}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--surface)',
                          boxShadow: 'var(--elevation-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{item.routeName}</span>
                          <span style={{ fontSize: 12, color: 'var(--stone)' }}>
                            {item.routeDistanceKm.toFixed(1)} km{item.routeCity ? ` · ${item.routeCity}` : ''}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--mist)' }}>{formatDate(item.completedAt)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
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
  padding: '10px 18px',
  borderRadius: 'var(--radius-pill)',
  border: 'none',
  background: 'var(--coral)',
  color: 'var(--white)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid rgba(0,0,0,.1)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
