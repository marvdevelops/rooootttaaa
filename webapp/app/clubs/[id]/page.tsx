'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ClubAvatar from '../../../components/ClubAvatar';
import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../lib/AuthContext';
import { ClubFullError, getClub, joinClub, leaveClub } from '../../../lib/clubsApi';
import { RunClub } from '../../../lib/types';

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const [club, setClub] = useState<RunClub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getClub(id)
      .then(setClub)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleJoin() {
    if (!club) return;
    if (!session) {
      router.push(`/login?next=/clubs/${id}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const status = await joinClub(club.id, club.isPrivate);
      setClub({ ...club, myStatus: status, myRole: 'member', memberCount: status === 'active' ? club.memberCount + 1 : club.memberCount });
    } catch (err) {
      if (err instanceof ClubFullError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Failed to join club.');
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!club) return;
    setBusy(true);
    try {
      await leaveClub(club.id);
      setClub({ ...club, myStatus: null, myRole: null, memberCount: club.memberCount - 1 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">
      <main style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', justifyContent: 'center' }}>
        {loading && <span style={{ color: 'var(--stone)' }}>Loading…</span>}
        {error && !club && <span style={{ color: 'var(--danger)' }}>{error}</span>}

        {club && (
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
            <ClubAvatar club={club} size={64} />
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>{club.name}</h1>
            {club.description && <p style={{ fontSize: 14, color: 'var(--stone)', lineHeight: 1.5 }}>{club.description}</p>}
            <span style={{ fontSize: 13, color: 'var(--stone)' }}>
              {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
              {club.city ? ` · ${club.city}` : ''}
              {club.isPrivate ? ' · Private' : ''}
            </span>

            {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}

            {club.myStatus === 'active' ? (
              <button onClick={handleLeave} disabled={busy} style={secondaryBtnStyle}>
                {club.myRole === 'owner' ? 'You own this club' : 'Leave club'}
              </button>
            ) : club.myStatus === 'pending' ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>Request pending approval</span>
            ) : (
              <button onClick={handleJoin} disabled={busy} style={primaryBtnStyle}>
                {club.isPrivate ? 'Request to join' : 'Join club'}
              </button>
            )}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 'var(--radius-pill)',
  border: 'none',
  background: 'var(--coral)',
  color: 'var(--white)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid rgba(0,0,0,.1)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};
