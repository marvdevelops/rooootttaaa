'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import ClubAvatar from './ClubAvatar';
import Logo from './Logo';
import { useAuth } from '../lib/AuthContext';
import { listMyClubs } from '../lib/clubsApi';
import { RunClub } from '../lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function DiscoverIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 8.5L13 13L8.5 15.5L11 11L15.5 8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ExploreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 21L16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RunsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5H20.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 2.5V6.5M16 2.5V6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MyMapsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3.5 6L9 4L15 6L20.5 4V18L15 20L9 18L3.5 20V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 4V18M15 6V20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ClubsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 19c0-3 2.5-5 5-5s5 2 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 13.2c2 .2 3.8 1.9 3.8 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Discover', icon: <DiscoverIcon /> },
  { href: '/explore', label: 'Explore', icon: <ExploreIcon /> },
  { href: '/my-maps', label: 'My maps', icon: <MyMapsIcon /> },
  { href: '/runs', label: 'Group runs', icon: <RunsIcon /> },
  { href: '/clubs', label: 'Clubs', icon: <ClubsIcon /> },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { session, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [myClubs, setMyClubs] = useState<RunClub[]>([]);

  useEffect(() => {
    if (session) listMyClubs().then(setMyClubs);
    else setMyClubs([]);
  }, [session]);

  return (
    <>
      {/* Desktop: full sidebar */}
      <aside className="sidebar-desktop">
        <Link href="/" className="sidebar-logo-lockup">
          <Logo size={38} />
          <span className="sidebar-wordmark">rootah</span>
        </Link>

        {session && (
          <Link href="/build" className="sidebar-cta">
            <PlusIcon />
            Build a route
          </Link>
        )}

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="sidebar-nav-item" data-active={active}>
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {session && myClubs.length > 0 && (
          <div className="sidebar-crews">
            <span className="sidebar-section-label">Your clubs</span>
            {myClubs.slice(0, 5).map((club) => (
              <Link key={club.id} href={`/clubs/${club.id}`} className="sidebar-crew-row">
                <ClubAvatar club={club} size={26} />
                <span>{club.name}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="sidebar-spacer" />

        {!loading &&
          (session ? (
            <div className="sidebar-account-row">
              <Link href={`/profile/${session.user.id}`} className="sidebar-account-link">
                <div className="sidebar-account-avatar">{(session.user.email ?? '?').slice(0, 1).toUpperCase()}</div>
                <div className="sidebar-account-text">
                  <span className="sidebar-account-name">{session.user.email?.split('@')[0]}</span>
                  <span className="sidebar-account-plan">Free plan</span>
                </div>
                <ChevronIcon />
              </Link>
              <button onClick={() => signOut()} className="sidebar-signout" title="Sign out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M16 16l4-4-4-4M20 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : (
            <Link href="/login" className="sidebar-cta">
              Sign in
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
