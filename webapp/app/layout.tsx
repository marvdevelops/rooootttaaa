import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../lib/AuthContext';

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const SITE_URL = 'https://app.rootah.com';
const SITE_NAME = 'Rootah';
const SITE_DESCRIPTION =
  'Find running routes near you across the Philippines — Manila, Cebu, Davao, and beyond. Discover routes shared by runners, build your own with turn-by-turn elevation, and join group runs. Free to use.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — Running routes near you`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'running routes near me',
    'running routes in Manila',
    'running routes in Cebu',
    'running routes in the Philippines',
    'trail running routes',
    'route planner',
    'group runs',
    'run clubs',
    'hiking trails near me',
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Running routes near you`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: '/icon.png', width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary',
    title: `${SITE_NAME} — Running routes near you`,
    description: SITE_DESCRIPTION,
    images: ['/icon.png'],
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body>
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
