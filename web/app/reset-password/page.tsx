'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseBrowser';

type Status = 'checking' | 'ready' | 'submitting' | 'success' | 'invalid' | 'error';

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Supabase's recovery link puts the session tokens in the URL hash and
  // the SDK exchanges them automatically (detectSessionInUrl) — this just
  // waits for that to land as a PASSWORD_RECOVERY event, or falls back to
  // checking for an existing session in case the event already fired
  // before this listener attached.
  useEffect(() => {
    const { data: subscription } = supabaseBrowser.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready');
    });

    supabaseBrowser.auth.getSession().then(({ data }) => {
      setStatus((prev) => (prev === 'checking' ? (data.session ? 'ready' : 'invalid') : prev));
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setStatus('submitting');
    const { error } = await supabaseBrowser.auth.updateUser({ password });
    if (error) {
      setErrorMsg(error.message);
      setStatus('ready');
      return;
    }
    setStatus('success');
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '32px 20px 80px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40, textDecoration: 'none' }}>
          <img
            src="/icon.png"
            alt="Rootah"
            width={32}
            height={32}
            style={{ width: 32, height: 32, borderRadius: 10, border: '3px solid var(--ink)', objectFit: 'cover' }}
          />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>rootah</span>
        </Link>

        {status === 'checking' && (
          <div style={{ textAlign: 'center', color: 'var(--muted)' }}>Checking your reset link…</div>
        )}

        {status === 'invalid' && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 10 }}>Link expired</h1>
            <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.6 }}>
              This password reset link is invalid or has expired. Open Rootah and tap &quot;Forgot password?&quot;
              on the login screen to request a new one.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 10 }}>Password updated</h1>
            <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
              Your password has been changed. Return to the Rootah app and log in with your new password.
            </p>
            <a
              href="rootah://login?reset=success"
              className="brutal-btn"
              style={
                {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 52,
                  width: '100%',
                  borderRadius: 14,
                  background: 'var(--rust)',
                  color: 'var(--sand)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  border: '3px solid var(--ink)',
                  boxShadow: '4px 4px 0px var(--ink)',
                  textDecoration: 'none',
                } as React.CSSProperties
              }
            >
              RETURN TO ROOTAH
            </a>
          </>
        )}

        {(status === 'ready' || status === 'submitting') && (
          <form onSubmit={handleSubmit}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 6 }}>Set a new password</h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
              Choose a password with at least 8 characters.
            </p>

            {errorMsg && (
              <div
                style={{
                  background: '#EC4624',
                  color: '#F2EEE2',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13.5,
                  marginBottom: 16,
                }}
              >
                {errorMsg}
              </div>
            )}

            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 6 }}>
              NEW PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              style={inputStyle}
              autoComplete="new-password"
            />

            <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.05em', color: 'var(--muted)', margin: '16px 0 6px' }}>
              CONFIRM PASSWORD
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              style={inputStyle}
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={status === 'submitting' || !password || !confirm}
              className="brutal-btn"
              style={
                {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 52,
                  width: '100%',
                  borderRadius: 14,
                  background: 'var(--rust)',
                  color: 'var(--sand)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  border: '3px solid var(--ink)',
                  boxShadow: '4px 4px 0px var(--ink)',
                  marginTop: 24,
                  cursor: 'pointer',
                  opacity: status === 'submitting' ? 0.6 : 1,
                } as React.CSSProperties
              }
            >
              {status === 'submitting' ? 'UPDATING…' : 'SET NEW PASSWORD'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--white, #fff)',
  border: '3px solid var(--ink)',
  borderRadius: 12,
  padding: '11px 14px',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--ink)',
};
