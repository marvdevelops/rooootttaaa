import type { Metadata } from 'next';
import { buildLiveMetadata, renderLivePage } from '../liveShared';

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return buildLiveMetadata(token);
}

export default async function LiveTrackingPage({ params }: Props) {
  const { token } = await params;
  return renderLivePage(token);
}
