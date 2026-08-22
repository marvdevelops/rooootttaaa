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
        <div className="profile-page-layout">
          {isOwn && (
            <nav className="profile-settings-rail">
              <div className="profile-settings-item" data-active="true">
                Profile
              </div>
              {['Account', 'Notifications', 'Privacy', 'Units & display', 'Plan & billing'].map((item) => (
                <div key={item} className="profile-settings-item" data-disabled="true" title="Coming soon">
                  {item}
                </div>
              ))}
            </nav>
          )}

          <main className="profile-content">
          {loading && <span style={{ color: 'var(--stone)', display: 'block', padding: 32 }}>Loading…</span>}
          {error && <span style={{ color: 'var(--danger)', display: 'block', padding: 32 }}>{error}</span>}

          {profile && (
            <div className="profile-body">
              <div className="profile-hero">
                <div className="profile-banner" />
                <div className="profile-hero-content">
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatarUrl} alt={profile.username} className="profile-avatar-lg" />
                  ) : (
                    <div className="profile-avatar-lg">{profile.username.slice(0, 1).toUpperCase()}</div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h1 style={{ fontSize: 21, fontWeight: 800 }}>{profile.username}</h1>
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
                  {profile.bio && !editing && <p style={{ fontSize: 14, color: 'var(--stone)', lineHeight: 1.5 }}>{profile.bio}</p>}
                  <span style={{ fontSize: 12, color: 'var(--mist)' }}>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                  {isOwn && !editing && (
                    <button onClick={() => setEditing(true)} style={secondaryBtnStyle}>
                      Edit profile
                    </button>
                  )}
                </div>
              </div>

              <div className="discover-stat-grid">
                <div className="discover-stat-tile">
                  <span className="discover-stat-value">{routes.length}</span>
                  <span className="discover-stat-label">Routes</span>
                </div>
                <div className="discover-stat-tile" data-tone="gain">
                  <span className="discover-stat-value">{routes.reduce((s, r) => s + r.distanceKm, 0).toFixed(0)} km</span>
                  <span className="discover-stat-label">Distance</span>
                </div>
                <div className="discover-stat-tile" data-tone="peak">
                  <span className="discover-stat-value">{activity.length}</span>
                  <span className="discover-stat-label">Runs logged</span>
                </div>
                <div className="discover-stat-tile" style={{ background: 'var(--sage)' }}>
                  <span className="discover-stat-value" style={{ color: 'var(--white)' }}>
                    {routes.reduce((s, r) => s + r.savesCount, 0)}
                  </span>
                  <span className="discover-stat-label" style={{ color: 'rgba(255,255,255,.82)' }}>
                    Saves
                  </span>
                </div>
              </div>

              {isOwn && editing && (
                <div className="route-detail-card">
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Edit profile
                  </span>
                  <div className="profile-form-grid" style={{ marginTop: 12 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--stone)' }}>Username</span>
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} placeholder="Username" />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--stone)' }}>City</span>
                      <input type="text" style={{ ...inputStyle, opacity: 0.5 }} placeholder="Coming soon" disabled />
                    </label>
                    <label className="span-2" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--stone)' }}>Bio</span>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical' }}
                        placeholder="Tell other runners about yourself"
                      />
                    </label>
                  </div>
                  {saveError && <span style={{ fontSize: 13, color: 'var(--danger)', display: 'block', marginTop: 10 }}>{saveError}</span>}
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                    <button onClick={() => setEditing(false)} style={secondaryBtnStyle}>
                      Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              )}

              {isOwn && profile.tier !== 'paid' && (
                <div className="profile-pro-banner">
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>Go Pro</span>
                    <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--stone)' }}>Unlock GPX import, unlimited group runs, and more.</p>
                  </div>
                  <span className="discover-run-btn" style={{ width: 'auto', padding: '9px 16px' }}>
                    Upgrade
                  </span>
                </div>
              )}

              <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>Routes</h2>
                {routes.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--stone)' }}>No public routes yet.</span>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                    {routes.map((route) => (
                      <Link key={route.id} href={`/routes/${route.id}`} className="route-detail-card" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14 }}>
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
                        className="route-detail-card"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}
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
