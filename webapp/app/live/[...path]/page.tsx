import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildLiveMetadata, renderLivePage } from '../liveShared';

// Catch-all so both /live/<token> and /live/<username>/<token> resolve — the
// username segment is cosmetic; the last segment is always the token, which
// is the entire access control.
interface Props {
  params: Promise<{ path: string[] }>;
}

function tokenFrom(path: string[]): string | null {
  return path.length >= 1 && path.length <= 2 ? path[path.length - 1] : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const token = tokenFrom(path);
  return token ? buildLiveMetadata(token) : { robots: { index: false, follow: false } };
}

export default async function LiveTrackingPage({ params }: Props) {
  const { path } = await params;
  const token = tokenFrom(path);
  if (!token) notFound();
  return renderLivePage(token);
}
