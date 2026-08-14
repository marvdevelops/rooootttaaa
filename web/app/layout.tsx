import type { Metadata } from 'next';
import { Archivo_Black, Space_Grotesk } from 'next/font/google';
import './globals.css';

const archivoBlack = Archivo_Black({
  variable: '--font-display',
  weight: '400',
  subsets: ['latin'],
});

const spaceGrotesk = Space_Grotesk({
  variable: '--font-body',
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
    <html lang="en" className={`${archivoBlack.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
