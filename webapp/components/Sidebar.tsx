'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Logo from './Logo';
import { useAuth } from '../lib/AuthContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function DiscoverIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 8.5L13 13L8.5 15.5L11 11L15.5 8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21L16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RunsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5H20.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 2.5V6.5M16 2.5V6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClubsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 19c0-3 2.5-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 13.2c2 .2 3.8 1.9 3.8 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Discover', icon: <DiscoverIcon /> },
  { href: '/explore', label: 'Explore', icon: <ExploreIcon /> },
  { href: '/runs', label: 'Group runs', icon: <RunsIcon /> },
  { href: '/clubs', label: 'Clubs', icon: <ClubsIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { session, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Desktop: icon rail */}
      <aside className="sidebar-desktop">
        <Link href="/" style={{ marginBottom: 8 }}>
          <Logo size={38} />
        </Link>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="sidebar-icon-btn" data-active={active} title={item.label}>
                {item.icon}
              </Link>
            );
          })}
        </nav>

        {!loading &&
          (session ? (
            <>
              <Link href="/build" className="sidebar-icon-btn sidebar-icon-btn-accent" title="Build a route">
                <PlusIcon />
              </Link>
              <Link href={`/profile/${session.user.id}`} className="sidebar-avatar" title="Profile">
                {(session.user.email ?? '?').slice(0, 1).toUpperCase()}
              </Link>
              <button onClick={() => signOut()} className="sidebar-icon-btn" title="Sign out" style={{ border: 'none', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M16 16l4-4-4-4M20 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          ) : (
            <Link href="/login" className="sidebar-icon-btn sidebar-icon-btn-accent" title="Sign in">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M8 8l-4 4 4 4M4 12h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ))}
      </aside>

      {/* Mobile: top bar with hamburger */}
      <header className="sidebar-mobile-header">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setMenuOpen(false)}>
          <Logo size={32} />
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.3px' }}>rootah</span>
        </Link>
        <button className="sidebar-mobile-menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((v) => !v)}>
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
      </header>

      {menuOpen && (
        <div className="sidebar-mobile-menu">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="sidebar-mobile-link" onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          {!loading &&
            (session ? (
              <>
                <Link href="/build" className="sidebar-mobile-link" style={{ color: 'var(--coral)' }} onClick={() => setMenuOpen(false)}>
                  Build a route
                </Link>
                <Link href={`/profile/${session.user.id}`} className="sidebar-mobile-link" onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    signOut();
                  }}
                  className="sidebar-mobile-link"
                  style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="sidebar-mobile-link" style={{ color: 'var(--coral)' }} onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
            ))}
        </div>
      )}
    </>
  );
}
