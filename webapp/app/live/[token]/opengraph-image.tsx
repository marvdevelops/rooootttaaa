import { ogSize, renderLiveOg } from '../liveOg';

export const size = ogSize;
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return renderLiveOg(token);
}
