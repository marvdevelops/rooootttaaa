import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

const webBaseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL;

export const metadata: Metadata = {
  metadataBase: webBaseUrl ? new URL(webBaseUrl) : undefined,
  title: 'Rootah',
  description: 'Build and share running routes that follow real streets.',
  openGraph: {
    siteName: 'Rootah',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body>
        {children}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-4WT4HKQ6K0" strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-4WT4HKQ6K0');
          `}
        </Script>
      </body>
    </html>
  );
}
