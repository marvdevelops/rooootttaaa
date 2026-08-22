'use client';

import Link from 'next/link';
import { useState } from 'react';
import Logo from './Logo';
import { useAuth } from '../lib/AuthContext';

const navLinkStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--ink)' };

export default function Header() {
  const { session, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setMenuOpen(false)}>
          <Logo size={32} />
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>rootah</span>
        </Link>

        <nav className="header-nav-desktop" style={{ display: 'flex', gap: 18 }}>
          <Link href="/explore" style={navLinkStyle}>
            Explore
          </Link>
          <Link href="/runs" style={navLinkStyle}>
            Group runs
          </Link>
          <Link href="/clubs" style={navLinkStyle}>
            Clubs
          </Link>
        </nav>

        {!loading && (
          <div className="header-actions-desktop" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {session ? (
              <>
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
              </>
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
            )}
          </div>
        )}

        <button
          className="header-menu-button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: 'none',
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-icon)',
            border: 'none',
            background: 'var(--sheet-bg)',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            {menuOpen ? (
              <path d="M1 1L17 13M17 1L1 13" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <>
                <path d="M0 1H18" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                <path d="M0 7H18" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
                <path d="M0 13H18" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="header-menu-mobile" style={{ display: 'flex', flexDirection: 'column', padding: '4px 20px 16px', gap: 4 }}>
          <Link href="/explore" style={mobileLinkStyle} onClick={() => setMenuOpen(false)}>
            Explore
          </Link>
          <Link href="/runs" style={mobileLinkStyle} onClick={() => setMenuOpen(false)}>
            Group runs
          </Link>
          <Link href="/clubs" style={mobileLinkStyle} onClick={() => setMenuOpen(false)}>
            Clubs
          </Link>
          {!loading &&
            (session ? (
              <>
                <Link href="/build" style={{ ...mobileLinkStyle, color: 'var(--coral)' }} onClick={() => setMenuOpen(false)}>
                  Build a route
                </Link>
                <Link href={`/profile/${session.user.id}`} style={mobileLinkStyle} onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  style={{ ...mobileLinkStyle, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" style={{ ...mobileLinkStyle, color: 'var(--coral)' }} onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
            ))}
        </div>
      )}
    </header>
  );
}

const mobileLinkStyle: React.CSSProperties = {
  padding: '12px 4px',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--ink)',
  borderTop: '1px solid rgba(0,0,0,.06)',
};
