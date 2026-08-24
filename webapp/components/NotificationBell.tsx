'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { countUnreadNotifications, listNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/notificationsApi';
import { AppNotification } from '../lib/types';

const POLL_MS = 30_000;

/** Maps a notification's structured `data` payload to where it should navigate — mirrors the mobile push-tap deep-link routing so the two stay in sync. */
function linkFor(n: AppNotification): string {
  const data = n.data as Record<string, unknown>;
  switch (n.type) {
    case 'route_liked':
      return `/routes/${data.route_id}`;
    case 'group_run_join_request':
    case 'group_run_rsvp_decision':
    case 'club_new_run':
      return `/runs/${data.run_id}`;
    case 'club_join_request':
      return `/clubs/${data.club_id}`;
    default:
      return '#';
  }
}

function relativeTime(ms: number): string {
  const diffMin = Math.round((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    countUnreadNotifications().catch(() => {});
    const poll = setInterval(() => {
      countUnreadNotifications().then(setUnreadCount).catch(() => {});
    }, POLL_MS);
    countUnreadNotifications().then(setUnreadCount).catch(() => {});
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const list = await listNotifications();
      setNotifications(list);
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  async function handleNotificationClick(n: AppNotification) {
    if (!n.isRead) {
      await markNotificationRead(n.id);
      setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button onClick={handleToggle} aria-label="Notifications" className="sidebar-nav-item" style={{ border: 'none', cursor: 'pointer', background: 'none', width: '100%' }}>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M6 10a6 6 0 1112 0c0 3.2 1 5 2 6.5H4c1-1.5 2-3.3 2-6.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -6,
                minWidth: 15,
                height: 15,
                borderRadius: 8,
                background: 'var(--coral)',
                color: '#fff',
                fontSize: 9.5,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        <span>Notifications</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 320,
            maxHeight: 420,
            overflowY: 'auto',
            background: 'var(--panel, #fff)',
            borderRadius: 'var(--radius-md, 14px)',
            boxShadow: 'var(--shadow-card, 0 8px 24px rgba(0,0,0,.18))',
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(0,0,0,.06)' }}>
            <span style={{ fontWeight: 800, fontSize: 13.5 }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--coral)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--stone)', textAlign: 'center' }}>No notifications yet.</div>}

          {notifications.map((n) => (
            <Link
              key={n.id}
              href={linkFor(n)}
              onClick={() => handleNotificationClick(n)}
              style={{
                display: 'block',
                padding: '12px 14px',
                textDecoration: 'none',
                color: 'inherit',
                background: n.isRead ? 'none' : 'rgba(232,75,42,.06)',
                borderBottom: '1px solid rgba(0,0,0,.05)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: n.isRead ? 500 : 700, color: 'var(--ink)' }}>{n.body}</div>
              <div style={{ fontSize: 11, color: 'var(--mist)', marginTop: 3 }}>{relativeTime(n.createdAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
