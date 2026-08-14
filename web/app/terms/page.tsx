import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms & Conditions — Rootah',
  description: 'Terms and conditions for using the Rootah app and website.',
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

export default function TermsPage() {
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

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, marginBottom: 6 }}>Terms &amp; Conditions</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 32 }}>Last updated: {LAST_UPDATED}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={sectionStyle}>
            <p style={bodyStyle}>
              Welcome to Rootah. These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of the
              Rootah mobile application and website (together, the &quot;Service&quot;), operated by the Rootah team
              (&quot;Rootah&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or otherwise using the
              Service, you agree to these Terms. If you do not agree, please do not use the Service.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>1. Eligibility &amp; accounts</h2>
            <p style={bodyStyle}>
              You must be at least 13 years old to use Rootah. You&apos;re responsible for maintaining the
              confidentiality of your account credentials and for all activity that happens under your account. Let
              us know right away if you suspect unauthorized use of your account.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>2. Your content</h2>
            <p style={bodyStyle}>
              Routes, route names and descriptions, waypoint notes, profile information, comments, and anything else
              you create or upload (&quot;User Content&quot;) remain yours. By posting User Content that you mark
              public, you grant Rootah a worldwide, non-exclusive, royalty-free license to host, store, display,
              reproduce, and distribute it as needed to operate and promote the Service — for example, showing your
              public routes on the Discover map or generating a shareable preview page. You&apos;re responsible for
              your User Content and confirm you have the right to share it.
            </p>
            <p style={bodyStyle}>
              We may remove User Content that violates these Terms or that we reasonably believe is unlawful,
              harmful, or infringing, without prior notice.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>3. Rootah Pro subscriptions</h2>
            <p style={bodyStyle}>
              Rootah offers an optional auto-renewing subscription, Rootah Pro, that unlocks additional features on
              top of the free Service. Subscriptions are purchased and billed entirely through the Apple App Store
              or Google Play — Rootah never processes or stores your payment details.
            </p>
            <ul style={listStyle}>
              <li>
                Your subscription automatically renews for the same length and price unless you cancel at least 24
                hours before the current period ends.
              </li>
              <li>
                Manage or cancel your subscription anytime in your Apple ID or Google Play account settings — not
                through Rootah directly. Canceling stops future renewals; you keep Pro access through the end of the
                period you&apos;ve already paid for.
              </li>
              <li>
                Payment is charged to your Apple or Google account at confirmation of purchase, and again at the
                start of each renewal period.
              </li>
              <li>
                Refunds are handled by Apple or Google under their own refund policies — Rootah cannot issue refunds
                directly for App Store or Play Store purchases.
              </li>
              <li>
                If we change subscription pricing, we&apos;ll do so consistent with Apple&apos;s and Google&apos;s
                own requirements for notifying existing subscribers.
              </li>
              <li>All core route-building, saving, and sharing features remain free — Pro is an optional add-on.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>4. Acceptable use</h2>
            <p style={bodyStyle}>You agree not to use the Service to:</p>
            <ul style={listStyle}>
              <li>Post content that is illegal, harassing, hateful, defamatory, or sexually explicit;</li>
              <li>Impersonate another person or misrepresent your affiliation with anyone;</li>
              <li>Upload routes, notes, or comments intended to mislead, endanger, or harass other users;</li>
              <li>Attempt to interfere with, disrupt, or gain unauthorized access to the Service or other users&apos; accounts;</li>
              <li>Scrape, reverse-engineer, or use automated means to extract data beyond normal use of the Service;</li>
              <li>Use the Service for any commercial purpose we haven&apos;t authorized.</li>
            </ul>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>5. Group runs &amp; other users</h2>
            <p style={bodyStyle}>
              Rootah lets users schedule group runs and comment on them. Rootah is not a party to, and is not
              responsible for, any in-person meetup, group run, or interaction between users. You&apos;re solely
              responsible for your own safety and conduct when meeting or running with other users, and for
              exercising good judgment about who you meet and where.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>6. Outdoor activity &amp; safety disclaimer</h2>
            <p style={bodyStyle}>
              Routes on Rootah are generated using third-party mapping and routing data and may not reflect current
              road, trail, or traffic conditions, closures, construction, weather, or hazards. Running, cycling, and
              other outdoor activity carry inherent risk. You assume full responsibility for your own safety,
              fitness, and judgment when following or creating any route, and for complying with all applicable
              traffic laws and local rules. Rootah is not a substitute for situational awareness — always run or
              ride within your ability and stay alert to your surroundings.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>7. Location data &amp; third-party services</h2>
            <p style={bodyStyle}>
              To build and display routes, Rootah uses your device&apos;s location (with your permission) and relies
              on third-party services, including Mapbox for maps, directions, and geocoding, Open-Meteo for
              elevation data, Supabase for account and data storage, and RevenueCat plus Apple/Google for processing
              Rootah Pro subscriptions. Your use of the Service is also subject to those providers&apos; own terms
              where applicable. See our{' '}
              <Link href="/privacy" style={{ color: 'var(--rust)' }}>
                Privacy Policy
              </Link>{' '}
              for details on what data we collect and how it&apos;s used.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>8. Termination</h2>
            <p style={bodyStyle}>
              You may stop using the Service and delete your account at any time. We may suspend or terminate your
              access to the Service if we believe you&apos;ve violated these Terms or created risk or legal exposure
              for Rootah or other users.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>9. Disclaimers &amp; limitation of liability</h2>
            <p style={bodyStyle}>
              The Service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any
              kind, express or implied, including accuracy, reliability, or fitness for a particular purpose. To the
              fullest extent permitted by law, Rootah will not be liable for any indirect, incidental, or
              consequential damages, or for any injury, loss, or damage arising from your use of the Service,
              reliance on route data, or interactions with other users.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>10. Changes to these Terms</h2>
            <p style={bodyStyle}>
              We may update these Terms from time to time. If we make material changes, we&apos;ll update the
              &quot;Last updated&quot; date above and, where appropriate, notify you in the app. Continuing to use
              the Service after changes take effect means you accept the updated Terms.
            </p>
          </div>

          <div style={sectionStyle}>
            <h2 style={headingStyle}>11. Contact</h2>
            <p style={bodyStyle}>
              Questions about these Terms? Reach out to us at{' '}
              <a href="mailto:support@rootah.com" style={{ color: 'var(--rust)' }}>
                support@rootah.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
