'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ClubAvatar from '../../../components/ClubAvatar';
import Sidebar from '../../../components/Sidebar';
import { useAuth } from '../../../lib/AuthContext';
import {
  ClubFullError,
  getClub,
  joinClub,
  leaveClub,
  listClubMembers,
  listClubRoutes,
  uploadClubAvatar,
  updateClub,
} from '../../../lib/clubsApi';
import { listClubEvents } from '../../../lib/groupRunsApi';
import { ClubMember, ClubRouteSummary, GroupRun, RunClub } from '../../../lib/types';

type Tab = 'events' | 'routes' | 'members';

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [club, setClub] = useState<RunClub | null>(null);
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<GroupRun[]>([]);
  const [routes, setRoutes] = useState<ClubRouteSummary[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const isAdmin = club?.myRole === 'owner' || club?.myRole === 'admin';

  useEffect(() => {
    getClub(id)
      .then(setClub)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setTabLoading(true);
    const load =
      tab === 'events' ? listClubEvents(id).then(setEvents) : tab === 'routes' ? listClubRoutes(id).then(setRoutes) : listClubMembers(id).then(setMembers);
    load.finally(() => setTabLoading(false));
  }, [id, tab]);

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

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !club) return;
    setUploadingAvatar(true);
    try {
      const avatarUrl = await uploadClubAvatar(club.id, file);
      await updateClub(club.id, { avatarUrl });
      setClub({ ...club, avatarUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-content" style={{ overflowY: 'auto' }}>
        {loading && <span style={{ color: 'var(--stone)', display: 'block', padding: 32 }}>Loading…</span>}
        {error && !club && <span style={{ color: 'var(--danger)', display: 'block', padding: 32 }}>{error}</span>}

        {club && (
          <div className="club-body">
            <div className="route-detail-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                {isAdmin ? (
                  <div className="club-avatar-upload" onClick={() => fileInputRef.current?.click()}>
                    <ClubAvatar club={club} size={72} />
                    <div className="club-avatar-upload-overlay">{uploadingAvatar ? '…' : 'Change'}</div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: 'none' }} />
                  </div>
                ) : (
                  <ClubAvatar club={club} size={72} />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 21, fontWeight: 800 }}>{club.name}</h1>
                  <span style={{ fontSize: 13, color: 'var(--stone)' }}>
                    {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
                    {club.city ? ` · ${club.city}` : ''}
                    {club.isPrivate ? ' · Private' : ''}
                  </span>
                </div>
              </div>

              {club.description && <p style={{ fontSize: 14, color: 'var(--stone)', lineHeight: 1.5 }}>{club.description}</p>}

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

            <div className="club-tabs">
              {(['events', 'routes', 'members'] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className="club-tab" data-active={tab === t}>
                  {t === 'events' ? 'Events' : t === 'routes' ? 'Routes' : 'Members'}
                </button>
              ))}
            </div>

            {tabLoading && <span style={{ fontSize: 13, color: 'var(--stone)' }}>Loading…</span>}

            {!tabLoading && tab === 'events' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {events.length === 0 && <span style={{ fontSize: 13, color: 'var(--stone)' }}>No upcoming events.</span>}
                {events.map((run) => (
                  <Link key={run.id} href={`/runs/${run.id}`} className="club-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{run.title}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--stone)' }}>
                      {new Date(run.scheduledAt).toLocaleString()} · {run.routeName} ({run.routeDistanceKm.toFixed(1)} km)
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {!tabLoading && tab === 'routes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {routes.length === 0 && <span style={{ fontSize: 13, color: 'var(--stone)' }}>No routes added yet.</span>}
                {routes.map((route) => (
                  <Link key={route.id} href={`/routes/${route.id}`} className="club-row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{route.name}</span>
                      <div style={{ fontSize: 12, color: 'var(--stone)' }}>
                        {route.distanceKm.toFixed(1)} km · +{Math.round(route.elevationGainM)}m · by {route.ownerUsername}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {!tabLoading && tab === 'members' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {members.length === 0 && <span style={{ fontSize: 13, color: 'var(--stone)' }}>No members to show.</span>}
                {members.map((member) => (
                  <Link key={member.userId} href={`/profile/${member.userId}`} className="club-row">
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatarUrl} alt={member.username} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: 'var(--sheet-bg)',
                          color: 'var(--coral)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 14,
                        }}
                      >
                        {member.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{member.username}</span>
                    {member.role !== 'member' && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase' }}>{member.role}</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
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
