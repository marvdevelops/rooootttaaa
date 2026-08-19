'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Header from '../../../components/Header';
import { useAuth } from '../../../lib/AuthContext';
import { getProfile, updateProfile } from '../../../lib/profilesApi';
import { PublicProfile } from '../../../lib/types';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const isOwn = session?.user.id === id;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />

      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: 32 }}>
        {loading && <span style={{ color: 'var(--stone)' }}>Loading…</span>}
        {error && <span style={{ color: 'var(--danger)' }}>{error}</span>}

        {profile && (
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 28,
              boxShadow: 'var(--elevation-card)',
              height: 'fit-content',
            }}
          >
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
                <span style={{ fontSize: 12, color: 'var(--mist)' }}>
                  Joined {new Date(profile.createdAt).toLocaleDateString()}
                </span>
                {isOwn && (
                  <button onClick={() => setEditing(true)} style={secondaryBtnStyle}>
                    Edit profile
                  </button>
                )}
              </>
            )}
          </div>
        )}
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
