'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../lib/AuthContext';
import { createClub } from '../../../lib/clubsApi';

export default function NewClubPage() {
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) router.push('/login?next=/clubs/new');
  }, [authLoading, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const club = await createClub({ name: name.trim(), description, city, isPrivate });
      router.push(`/clubs/${club.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create club.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !session) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
      <main style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', justifyContent: 'center' }}>
        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            maxWidth: 440,
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
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>Start a club</h1>
          <input type="text" placeholder="Club name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <input type="text" placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            Private club (members must be approved)
          </label>

          {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}

          <button type="submit" disabled={saving || !name.trim()} style={primaryBtnStyle}>
            {saving ? 'Creating…' : 'Create club'}
          </button>
        </form>
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
  padding: '12px 18px',
  borderRadius: 'var(--radius-pill)',
  border: 'none',
  background: 'var(--coral)',
  color: 'var(--white)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
};
