'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { unblockUser, listBlockedUsers } from '../lib/blocksApi';
import { getNotificationPreferences, updateNotificationPreferences } from '../lib/notificationPreferencesApi';
import { BlockedUser, NotificationPreferences, PublicProfile } from '../lib/types';
import PaywallModal from './PaywallModal';

export type SettingsTab = 'account' | 'notifications' | 'privacy' | 'plan';

const cardStyle: React.CSSProperties = {
  background: 'var(--panel, #fff)',
  borderRadius: 'var(--radius-md, 14px)',
  padding: 22,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const dangerBtnStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid rgba(220,60,50,.3)',
  background: 'transparent',
  color: 'var(--danger, #dc3c32)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid rgba(0,0,0,.1)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  alignSelf: 'flex-start',
};

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }}>
      <span style={{ fontSize: 14, color: 'var(--ink)' }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, cursor: 'pointer' }} />
    </label>
  );
}

function AccountTab({ userId }: { userId: string }) {
  const { signOut, deleteAccount } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const { error } = await deleteAccount();
    if (error) {
      setError(error);
      setDeleting(false);
      return;
    }
    router.push('/');
  }

  return (
    <div style={cardStyle}>
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Account</span>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--stone)' }}>User ID: {userId}</p>
      </div>

      <button onClick={() => signOut()} style={secondaryBtnStyle}>
        Sign out
      </button>

      <div style={{ borderTop: '1px solid rgba(0,0,0,.08)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger, #dc3c32)' }}>Danger zone</span>
        {!confirming ? (
          <button onClick={() => setConfirming(true)} style={dangerBtnStyle}>
            Delete account
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, color: 'var(--stone)' }}>
              This permanently deletes your account, routes, and activity. This can&apos;t be undone.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirming(false)} style={secondaryBtnStyle} disabled={deleting}>
                Cancel
              </button>
              <button onClick={handleDelete} style={dangerBtnStyle} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, delete my account'}
              </button>
            </div>
          </div>
        )}
        {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}
      </div>
    </div>
  );
}

function NotificationsTab({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNotificationPreferences(userId).then(setPrefs).catch((err) => setError(err.message));
  }, [userId]);

  async function toggle(key: keyof NotificationPreferences, value: boolean) {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: value });
    try {
      await updateNotificationPreferences(userId, { [key]: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.');
      setPrefs(prefs);
    }
  }

  return (
    <div style={cardStyle}>
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Notifications
        </span>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--stone)' }}>
          Controls push notifications sent to your phone via the Rootah mobile app.
        </p>
      </div>

      {!prefs ? (
        <span style={{ fontSize: 13, color: 'var(--stone)' }}>Loading…</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ToggleRow label="Likes on your routes" checked={prefs.likesEnabled} onChange={(v) => toggle('likesEnabled', v)} />
          <ToggleRow label="RSVPs to your group runs" checked={prefs.rsvpsEnabled} onChange={(v) => toggle('rsvpsEnabled', v)} />
          <ToggleRow label="Comments on your runs" checked={prefs.commentsEnabled} onChange={(v) => toggle('commentsEnabled', v)} />
          <ToggleRow label="Replies to your comments" checked={prefs.repliesEnabled} onChange={(v) => toggle('repliesEnabled', v)} />
        </div>
      )}
      {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}

function PrivacyTab() {
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBlockedUsers()
      .then(setBlocked)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleUnblock(userId: string) {
    try {
      await unblockUser(userId);
      setBlocked((b) => b.filter((u) => u.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unblock.');
    }
  }

  return (
    <div style={cardStyle}>
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Blocked users
        </span>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--stone)' }}>People you&apos;ve blocked won&apos;t be able to see your activity or interact with you.</p>
      </div>

      {loading && <span style={{ fontSize: 13, color: 'var(--stone)' }}>Loading…</span>}
      {!loading && blocked.length === 0 && <span style={{ fontSize: 13, color: 'var(--stone)' }}>You haven&apos;t blocked anyone.</span>}
      {blocked.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {blocked.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{u.username}</span>
              <button onClick={() => handleUnblock(u.id)} style={secondaryBtnStyle}>
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}
    </div>
  );
}

function PlanTab({ profile }: { profile: PublicProfile }) {
  const [showPaywall, setShowPaywall] = useState(false);
  return (
    <div style={cardStyle}>
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Plan & billing
        </span>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--stone)' }}>
          Current plan: <strong style={{ color: 'var(--ink)' }}>{profile.tier === 'paid' ? 'Rootah Pro' : 'Free'}</strong>
        </p>
      </div>
      {profile.tier !== 'paid' ? (
        <button onClick={() => setShowPaywall(true)} className="discover-run-btn" style={{ width: 'auto', alignSelf: 'flex-start', padding: '10px 20px' }}>
          Upgrade to Pro
        </button>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--stone)' }}>Subscriptions are managed through the Rootah mobile app (App Store).</p>
      )}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
    </div>
  );
}

export default function AccountSettingsPanel({ tab, profile }: { tab: SettingsTab; profile: PublicProfile }) {
  if (tab === 'account') return <AccountTab userId={profile.id} />;
  if (tab === 'notifications') return <NotificationsTab userId={profile.id} />;
  if (tab === 'privacy') return <PrivacyTab />;
  return <PlanTab profile={profile} />;
}
