'use client';

import Link from 'next/link';
import Logo from './Logo';
import { useAuth } from '../lib/AuthContext';

const navLinkStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--ink)' };

export default function Header() {
  const { session, loading, signOut } = useAuth();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 20px',
        background: 'var(--surface)',
        boxShadow: 'var(--elevation-subtle)',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={32} />
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>rootah</span>
        </Link>
        {session && (
          <nav style={{ display: 'flex', gap: 18 }}>
            <Link href="/runs" style={navLinkStyle}>
              Group runs
            </Link>
            <Link href="/clubs" style={navLinkStyle}>
              Clubs
            </Link>
          </nav>
        )}
      </div>

      {!loading &&
        (session ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              href="/build"
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--coral)',
                color: 'var(--white)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              Build a route
            </Link>
            <Link href={`/profile/${session.user.id}`} style={navLinkStyle}>
              Profile
            </Link>
            <button
              onClick={() => signOut()}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid rgba(0,0,0,.1)',
                background: 'var(--surface)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--coral)',
              color: 'var(--white)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Sign in
          </Link>
        ))}
    </header>
  );
}
