import type { Metadata } from 'next';
import { buildLiveMetadata, renderLivePage } from '../../liveShared';

// The [handle] segment is cosmetic — it just makes shared links recognisable
// (app.rootah.com/live/marvin/…). The token is still the entire access control.
interface Props {
  params: Promise<{ handle: string; token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return buildLiveMetadata(token);
}

export default async function LiveTrackingWithHandlePage({ params }: Props) {
  const { token } = await params;
  return renderLivePage(token);
}
