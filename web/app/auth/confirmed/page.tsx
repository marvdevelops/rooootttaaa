'use client';

import { useEffect, useState } from 'react';

type Status = 'checking' | 'confirmed' | 'error';

export default function EmailConfirmedPage() {
  const [status, setStatus] = useState<Status>('checking');
  const [errorDescription, setErrorDescription] = useState<string | null>(null);

  useEffect(() => {
    // Supabase redirects here with the result in the URL fragment (#...),
    // which never reaches the server — has to be read client-side.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const error = hash.get('error') || hash.get('error_description');
    if (error) {
      setStatus('error');
      setErrorDescription(hash.get('error_description'));
    } else {
      setStatus('confirmed');
    }
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          background: status === 'error' ? 'var(--red)' : 'var(--rust)',
          border: '3px solid var(--ink)',
        }}
      />

      {status === 'checking' && <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>Checking…</h1>}

      {status === 'confirmed' && (
        <>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>Email confirmed</h1>
          <p style={{ color: 'var(--muted)', maxWidth: 340 }}>
            Your account is verified. Head back to the Rootah app and log in to start building routes.
          </p>
        </>
      )}

      {status === 'error' && (
        <>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>Link expired</h1>
          <p style={{ color: 'var(--muted)', maxWidth: 340 }}>
            {errorDescription
              ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
              : 'This confirmation link is invalid or has expired.'}{' '}
            Open the Rootah app and request a new confirmation email.
          </p>
        </>
      )}
    </main>
  );
}
