import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Delete Your Account — Rootah',
  description: 'How to delete your Rootah account and data.',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 18,
};

const bodyStyle: React.CSSProperties = {
  color: 'var(--ink)',
  lineHeight: 1.65,
  fontSize: 15,
};

const listStyle: React.CSSProperties = {
  ...bodyStyle,
  paddingLeft: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

export default function DeleteAccountPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 680, padding: '32px 20px 80px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, textDecoration: 'none' }}>
          <img
            src="/icon.png"
            alt="Rootah"
            width={32}
            height={32}
            style={{ width: 32, height: 32, borderRadius: 10, border: '3px solid var(--ink)', objectFit: 'cover' }}
          />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>rootah</span>
        </Link>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginBottom: 6 }}>Delete your account</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 32 }}>
          Two ways to permanently delete your Rootah account and data.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={sectionStyle}>
            <h2 style={headingStyle}>Option 1: Delete in the app</h2>
            <p style={bodyStyle}>
              This is the fastest way and takes effect immediately.
            </p>
            <ol style={listStyle}>
              <li>Open Rootah and sign in.</li>
              <li>Go to your Profile (tap your avatar).</li>
              <li>Scroll down and tap <strong>Delete account</strong>.</li>
              <li>Confirm twice — deletion is immediate and cannot be undone.</li>
            </ol>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>Option 2: Request deletion by email</h2>
            <p style={bodyStyle}>
              If you can&apos;t access the app, email us from the address associated with your account and we&apos;ll
              delete it for you.
            </p>
            <p style={bodyStyle}>
              <a href="mailto:privacy@rootah.com?subject=Delete%20my%20Rootah%20account" style={{ color: 'var(--rust)' }}>
                privacy@rootah.com
              </a>
            </p>
            <p style={bodyStyle}>We aim to complete email requests within 7 days.</p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>What gets deleted</h2>
            <p style={bodyStyle}>Deleting your account permanently removes:</p>
            <ul style={listStyle}>
              <li>Your profile — username, bio, and profile photo;</li>
              <li>All routes you created, public or private;</li>
              <li>Your saves, likes, comments, and group runs (created or RSVP&apos;d);</li>
              <li>Your account credentials and login access.</li>
            </ul>
            <p style={bodyStyle}>
              This cannot be undone. See our{' '}
              <Link href="/privacy" style={{ color: 'var(--rust)' }}>
                Privacy Policy
              </Link>{' '}
              for details on data retention.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
