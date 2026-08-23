'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ClubAvatar from '../../components/ClubAvatar';
import Sidebar from '../../components/Sidebar';
import { listNearbyClubs } from '../../lib/clubsApi';
import { RunClub } from '../../lib/types';

const PAGE_SIZE = 20;

export default function ClubsPage() {
  const [clubs, setClubs] = useState<RunClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    listNearbyClubs(null, 200).then(setClubs).finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content">

      <main style={{ flex: 1, overflowY: 'auto', padding: 32, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>Clubs</h1>
            <Link href="/clubs/new" style={primaryBtnStyle}>
              Start a club
            </Link>
          </div>

          {loading && <span style={{ color: 'var(--stone)' }}>Loading…</span>}
          {!loading && clubs.length === 0 && <span style={{ color: 'var(--stone)' }}>No clubs yet.</span>}

          {clubs.slice(0, visibleCount).map((club) => (
            <Link
              key={club.id}
              href={`/clubs/${club.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: 18,
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                boxShadow: 'var(--elevation-card)',
              }}
            >
              <ClubAvatar club={club} size={48} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{club.name}</span>
                {club.description && <span style={{ fontSize: 13, color: 'var(--stone)' }}>{club.description}</span>}
                <span style={{ fontSize: 12, color: 'var(--mist)' }}>
                  {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
                  {club.city ? ` · ${club.city}` : ''}
                </span>
              </div>
            </Link>
          ))}

          {clubs.length > visibleCount && (
            <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="builder-toolbar-btn">
              Load more ({clubs.length - visibleCount} more)
            </button>
          )}
        </div>
      </main>
      </div>
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
