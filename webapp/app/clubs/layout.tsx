import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Run clubs near you',
  description: 'Find and join running clubs across the Philippines, or start your own on Rootah.',
  alternates: { canonical: 'https://app.rootah.com/clubs' },
};

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
