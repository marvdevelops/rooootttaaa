import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore running routes, clubs & group runs',
  description:
    'Browse running and trail routes, run clubs, and upcoming group runs across the Philippines — Manila, Cebu, Davao, and more. Free to browse, no sign-up required.',
  alternates: { canonical: 'https://app.rootah.com/explore' },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
