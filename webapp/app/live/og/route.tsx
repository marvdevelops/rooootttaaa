import { renderLiveOg } from '../liveOg';

// The share-card image for /live links. Referenced from buildLiveMetadata()'s
// openGraph.images — a route handler rather than a file-based opengraph-image
// because the live routes are a catch-all ([...path]) and Next won't allow a
// metadata file after a catch-all segment.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  return renderLiveOg(token);
}
