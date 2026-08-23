'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  removeClubMember,
  respondToClubJoinRequest,
  setClubMemberRole,
  uploadClubAvatar,
  updateClub,
} from '../../../lib/clubsApi';
import { listClubEvents } from '../../../lib/groupRunsApi';
import { ClubMember, ClubRouteSummary, GroupRun, RunClub } from '../../../lib/types';

type Tab = 'events' | 'routes' | 'members';

export default function ClubDetailClient({ id }: { id: string }) {
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
  const [managing, setManaging] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pending, setPending] = useState<ClubMember[]>([]);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPrivate, setEditPrivate] = useState(false);

  const isAdmin = club?.myRole === 'owner' || club?.myRole === 'admin';

  useEffect(() => {
    getClub(id)
      .then((c) => {
        setClub(c);
        setEditName(c.name);
        setEditDescription(c.description ?? '');
        setEditCity(c.city ?? '');
        setEditPrivate(c.isPrivate);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setTabLoading(true);
    const load =
      tab === 'events' ? listClubEvents(id).then(setEvents) : tab === 'routes' ? listClubRoutes(id).then(setRoutes) : listClubMembers(id).then(setMembers);
    load.finally(() => setTabLoading(false));
  }, [id, tab]);

  useEffect(() => {
    if (!isAdmin) return;
    listClubMembers(id, 'pending').then(setPending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdmin, tab]);

  async function handleSaveSettings() {
    if (!club || !editName.trim()) return;
    setSavingSettings(true);
    setError(null);
    try {
      await updateClub(club.id, { name: editName, description: editDescription, city: editCity, isPrivate: editPrivate });
      setClub({ ...club, name: editName.trim(), description: editDescription.trim() || null, city: editCity.trim() || null, isPrivate: editPrivate });
      setManaging(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleRespond(userId: string, approve: boolean) {
    if (!club) return;
    await respondToClubJoinRequest(club.id, userId, approve);
    setPending((p) => p.filter((m) => m.userId !== userId));
    if (approve) setClub({ ...club, memberCount: club.memberCount + 1 });
    if (tab === 'members') listClubMembers(id).then(setMembers);
  }

  async function handlePromote(member: ClubMember) {
    if (!club) return;
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    await setClubMemberRole(club.id, member.userId, nextRole);
    setMembers((ms) => ms.map((m) => (m.userId === member.userId ? { ...m, role: nextRole } : m)));
  }

  async function handleRemoveMember(member: ClubMember) {
    if (!club) return;
    await removeClubMember(club.id, member.userId);
    setMembers((ms) => ms.filter((m) => m.userId !== member.userId));
    setClub({ ...club, memberCount: club.memberCount - 1 });
  }

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

              {!managing && club.description && <p style={{ fontSize: 14, color: 'var(--stone)', lineHeight: 1.5 }}>{club.description}</p>}

              {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}

              {managing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input type="text" placeholder="Club name" value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} />
                  <textarea
                    placeholder="Description (optional)"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                  <input type="text" placeholder="City (optional)" value={editCity} onChange={(e) => setEditCity(e.target.value)} style={inputStyle} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input type="checkbox" checked={editPrivate} onChange={(e) => setEditPrivate(e.target.checked)} />
                    Private club (members must be approved)
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleSaveSettings} disabled={savingSettings || !editName.trim()} style={primaryBtnStyle}>
                      {savingSettings ? 'Saving…' : 'Save changes'}
                    </button>
                    <button onClick={() => setManaging(false)} style={secondaryBtnStyle}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {club.myStatus === 'active' ? (
                    <button onClick={handleLeave} disabled={busy} style={secondaryBtnStyle}>
                      {club.myRole === 'owner' ? 'Leave (transfers ownership)' : 'Leave club'}
                    </button>
                  ) : club.myStatus === 'pending' ? (
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>Request pending approval</span>
                  ) : (
                    <button onClick={handleJoin} disabled={busy} style={primaryBtnStyle}>
                      {club.isPrivate ? 'Request to join' : 'Join club'}
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => setManaging(true)} style={secondaryBtnStyle}>
                      Manage club
                    </button>
                  )}
                </div>
              )}
            </div>

            {isAdmin && pending.length > 0 && (
              <div className="route-detail-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Pending requests
                </span>
                {pending.map((member) => (
                  <div key={member.userId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{member.username}</span>
                    <button onClick={() => handleRespond(member.userId, true)} className="builder-toolbar-btn">
                      Approve
                    </button>
                    <button onClick={() => handleRespond(member.userId, false)} className="builder-toolbar-btn">
                      Deny
                    </button>
                  </div>
                ))}
              </div>
            )}

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
                    {isAdmin && member.userId !== session?.user.id && member.role !== 'owner' && (
                      <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.preventDefault()}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handlePromote(member);
                          }}
                          className="builder-toolbar-btn"
                        >
                          {member.role === 'admin' ? 'Demote' : 'Make admin'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleRemoveMember(member);
                          }}
                          className="builder-toolbar-btn"
                        >
                          Remove
                        </button>
                      </div>
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
