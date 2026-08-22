import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Group runs near you',
  description: 'Find and join upcoming group runs across the Philippines, or schedule your own with a route from Rootah.',
  alternates: { canonical: 'https://app.rootah.com/runs' },
};

export default function RunsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
