import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Rootah',
  description: 'How Rootah collects, uses, and protects your data.',
};

const LAST_UPDATED = 'August 12, 2026';

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
  gap: 4,
};

export default function PrivacyPage() {
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

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 32 }}>Last updated: {LAST_UPDATED}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={sectionStyle}>
            <p style={bodyStyle}>
              This Privacy Policy explains what information Rootah (&quot;we&quot;, &quot;us&quot;) collects through
              the Rootah mobile app and website (together, the &quot;Service&quot;), why we collect it, and the
              choices you have. It should be read alongside our{' '}
              <Link href="/terms" style={{ color: 'var(--rust)' }}>
                Terms &amp; Conditions
              </Link>
              .
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>1. Information we collect</h2>
            <p style={bodyStyle}>We collect the following categories of information:</p>
            <ul style={listStyle}>
              <li>
                <strong>Account information</strong> — the email address and password you sign up with, and the
                username, bio, and profile photo you choose to add.
              </li>
              <li>
                <strong>Location data</strong> — if you grant permission, your device&apos;s current location, used
                to center the map and speed up route building. Location access is optional — you can browse and
                build routes without granting it.
              </li>
              <li>
                <strong>Route data</strong> — the waypoints, paths, names, descriptions, and notes of routes you
                create, along with distance, elevation, and activity type derived from them.
              </li>
              <li>
                <strong>Social activity</strong> — likes, saves, comments, group runs you create or RSVP to, and
                who you follow or are followed by, where applicable.
              </li>
              <li>
                <strong>Device &amp; usage information</strong> — basic technical data such as app version, device
                type, and crash/error logs, used to keep the Service running reliably.
              </li>
              <li>
                <strong>Subscription status</strong> — if you purchase Rootah Pro, we receive your subscription
                status (active, expired, cancelled) from Apple or Google via our subscription platform, RevenueCat,
                so we can unlock Pro features on your account. We never receive or store your card number or other
                payment details — those are handled entirely by Apple or Google.
              </li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>2. How we use your information</h2>
            <ul style={listStyle}>
              <li>To provide core functionality — building, routing, saving, and displaying routes and maps;</li>
              <li>To operate account features — authentication, your profile, and your saved/created routes;</li>
              <li>To power social features — Discover, likes, saves, comments, and group runs;</li>
              <li>To generate shareable public preview pages for routes you mark public;</li>
              <li>To unlock Rootah Pro features for subscribers and keep your subscription status current;</li>
              <li>To maintain, secure, and improve the Service, including diagnosing bugs and abuse.</li>
            </ul>
            <p style={bodyStyle}>We do not sell your personal information.</p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>3. What&apos;s public vs. private</h2>
            <p style={bodyStyle}>
              Your username, bio, and profile photo are visible to other users. Routes are private by default until
              you choose to make them public; public routes (including their name, path, stats, and your username)
              are visible to anyone on the Discover map and on their shareable web preview page. Comments and RSVPs
              on a group run are visible to other participants of that run.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>4. Third-party services</h2>
            <p style={bodyStyle}>We rely on the following third-party services to operate Rootah:</p>
            <ul style={listStyle}>
              <li>
                <strong>Supabase</strong> — hosts our database, authentication, and file storage (profile photos).
              </li>
              <li>
                <strong>Mapbox</strong> — provides maps, street-level routing/directions, and geocoding. Waypoint
                coordinates are sent to Mapbox to compute routes.
              </li>
              <li>
                <strong>Open-Meteo</strong> — provides elevation data for the coordinates along your routes.
              </li>
              <li>
                <strong>Railway</strong> — hosts the Rootah website, including public route preview pages.
              </li>
              <li>
                <strong>RevenueCat, Apple, and Google</strong> — process and manage Rootah Pro subscription
                purchases. Apple and Google handle all payment collection directly; RevenueCat relays your
                subscription status to us so we can grant Pro access. None of them receive any Rootah data beyond
                what&apos;s needed to identify your account and subscription.
              </li>
            </ul>
            <p style={bodyStyle}>
              These providers process data only as needed to deliver their service to us and are bound by their own
              privacy and security terms.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>5. Data retention &amp; deletion</h2>
            <p style={bodyStyle}>
              We keep your account and route data for as long as your account is active. You can delete individual
              routes at any time from within the app. You can also delete your account entirely, at any time, from
              Profile &rarr; Delete account in the app, or by following the instructions on our{' '}
              <Link href="/delete-account" style={{ color: 'var(--rust)' }}>
                account deletion page
              </Link>
              . Deleting your account removes your profile, routes, and associated data immediately, except where
              we&apos;re required to retain records for legal or security reasons.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>6. Your choices</h2>
            <ul style={listStyle}>
              <li>Location permission can be granted or revoked at any time in your device settings;</li>
              <li>Photo library access (for a profile picture) can likewise be granted or revoked at any time;</li>
              <li>You can edit or delete your profile information and routes directly in the app;</li>
              <li>You can mark any route private at any time to remove it from public/Discover visibility;</li>
              <li>
                You can delete your account at any time — see{' '}
                <Link href="/delete-account" style={{ color: 'var(--rust)' }}>
                  how to delete your account
                </Link>
                .
              </li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>7. Children&apos;s privacy</h2>
            <p style={bodyStyle}>
              Rootah is not directed at children under 13, and we do not knowingly collect personal information
              from anyone under 13. If you believe a child has provided us with personal information, contact us
              and we&apos;ll delete it.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>8. Changes to this policy</h2>
            <p style={bodyStyle}>
              We may update this Privacy Policy from time to time. If we make material changes, we&apos;ll update
              the &quot;Last updated&quot; date above and, where appropriate, notify you in the app.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>9. Contact</h2>
            <p style={bodyStyle}>
              Questions about this Privacy Policy, or want to access, correct, or delete your data? Reach out to us
              at{' '}
              <a href="mailto:privacy@rootah.com" style={{ color: 'var(--rust)' }}>
                privacy@rootah.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
