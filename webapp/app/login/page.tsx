'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Logo from '../../components/Logo';
import { useAuth } from '../../lib/AuthContext';

export default function LoginPage() {
  const { signInWithPassword, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signInWithPassword(email, password);
      setLoading(false);
      if (error) {
        setError(error);
        return;
      }
      router.push('/');
      return;
    }

    const { error, needsConfirmation } = await signUp(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    if (needsConfirmation) {
      setNotice('Check your email to confirm your account, then sign in.');
      setMode('signin');
      return;
    }
    router.push('/');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
      }}
    >
      <Logo size={48} />

      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 28,
          boxShadow: 'var(--elevation-card)',
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800, textAlign: 'center' }}>
          {mode === 'signin' ? 'Sign in' : 'Create your account'}
        </h1>

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}
        {notice && <span style={{ fontSize: 13, color: 'var(--sage)' }}>{notice}</span>}

        <button type="submit" disabled={loading} style={primaryBtnStyle}>
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>

        <button type="button" onClick={() => signInWithGoogle()} style={secondaryBtnStyle}>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setNotice(null);
          }}
          style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--stone)', cursor: 'pointer', marginTop: 4 }}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(0,0,0,.1)',
  fontSize: 15,
  fontFamily: 'inherit',
  outline: 'none',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '13px 20px',
  borderRadius: 'var(--radius-pill)',
  border: 'none',
  background: 'var(--coral)',
  color: 'var(--white)',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
  boxShadow: 'var(--elevation-primary-btn)',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '13px 20px',
  borderRadius: 'var(--radius-pill)',
  border: '1px solid rgba(0,0,0,.1)',
  background: 'var(--surface)',
  color: 'var(--ink)',
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
};
