'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ClubAvatar from '../../components/ClubAvatar';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../lib/AuthContext';
import { listMyClubs } from '../../lib/clubsApi';
import { listUpcomingGroupRuns } from '../../lib/groupRunsApi';
import { GroupRun, RunClub } from '../../lib/types';

function isToday(ts: number): boolean {
  const d = new Date(ts);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

const PAGE_SIZE = 20;

export default function RunsPage() {
  const { session } = useAuth();
  const [runs, setRuns] = useState<GroupRun[]>([]);
  const [myClubs, setMyClubs] = useState<RunClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    listUpcomingGroupRuns(200).then(setRuns).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (session) listMyClubs().then(setMyClubs);
    else setMyClubs([]);
  }, [session]);

  const featured = runs.find((r) => isToday(r.scheduledAt)) ?? runs[0] ?? null;
  const rest = featured ? runs.filter((r) => r.id !== featured.id) : runs;
  const thisMonthCount = runs.filter((r) => {
    const d = new Date(r.scheduledAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content" style={{ overflowY: 'auto' }}>
        <div className="runs-page-body">
          <div className="runs-main">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ fontSize: 22, fontWeight: 800 }}>Group runs</h1>
              <Link href="/runs/new" className="discover-run-btn" style={{ width: 'auto', padding: '10px 18px' }}>
                Schedule a run
              </Link>
            </div>

            <div className="discover-segmented" style={{ maxWidth: 340 }}>
              <button className="discover-segmented-item" data-active="true">
                Upcoming
              </button>
              <span className="discover-segmented-item mymaps-segmented-disabled" title="Coming soon">
                Hosting
              </span>
              <span className="discover-segmented-item mymaps-segmented-disabled" title="Coming soon">
                Past
              </span>
            </div>

            {loading && <span style={{ color: 'var(--stone)' }}>Loading…</span>}
            {!loading && runs.length === 0 && <span style={{ color: 'var(--stone)' }}>No upcoming group runs yet.</span>}

            {featured && (
              <Link href={`/runs/${featured.id}`} className="runs-featured-card">
                <div className="runs-featured-thumb" />
                <div className="runs-featured-body">
                  <span className="runs-featured-badge">{isToday(featured.scheduledAt) ? 'Happening today' : 'Next up'}</span>
                  <span style={{ fontWeight: 800, fontSize: 19 }}>{featured.title}</span>
                  <span style={{ fontSize: 13.5, opacity: 0.92 }}>
                    {new Date(featured.scheduledAt).toLocaleString()} · {featured.routeName} ({featured.routeDistanceKm.toFixed(1)} km)
                  </span>
                  <span style={{ fontSize: 12.5, opacity: 0.8 }}>Hosted by {featured.hostUsername}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <span className="runs-attendee-badge">
                      {featured.rsvpCount}
                      {featured.maxParticipants ? `/${featured.maxParticipants}` : ''} going
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{featured.isRsvpedByMe ? 'Manage run →' : 'Join run →'}</span>
                  </div>
                </div>
              </Link>
            )}

            {rest.slice(0, visibleCount).map((run) => (
              <Link key={run.id} href={`/runs/${run.id}`} className="runs-row">
                <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{run.title}</span>
                <span style={{ fontSize: 12.5, color: 'var(--stone)' }}>
                  {new Date(run.scheduledAt).toLocaleString()} · {run.routeName} ({run.routeDistanceKm.toFixed(1)} km)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--mist)' }}>
                    Hosted by {run.hostUsername} · {run.rsvpCount}
                    {run.maxParticipants ? `/${run.maxParticipants}` : ''} going
                  </span>
                  {run.isRsvpedByMe && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sage)' }}>Joined</span>
                  )}
                </div>
              </Link>
            ))}

            {rest.length > visibleCount && (
              <button onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} className="builder-toolbar-btn">
                Load more ({rest.length - visibleCount} more)
              </button>
            )}

            {!loading && runs.length > 0 && (
              <Link href="/explore" className="mymaps-add-tile" style={{ minHeight: 64, flexDirection: 'row', gap: 8 }}>
                Find more runs near you
              </Link>
            )}
          </div>

          <div className="runs-rail">
            {session && (
              <div className="route-detail-card">
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  This month
                </span>
                <div style={{ marginTop: 8, fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>{thisMonthCount}</div>
                <span style={{ fontSize: 12.5, color: 'var(--stone)' }}>group runs scheduled</span>
              </div>
            )}

            {session && myClubs.length > 0 && (
              <div className="route-detail-card">
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Your clubs
                </span>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {myClubs.slice(0, 5).map((club) => (
                    <Link
                      key={club.id}
                      href={`/clubs/${club.id}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}
                    >
                      <ClubAvatar club={club} size={30} />
                      {club.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
