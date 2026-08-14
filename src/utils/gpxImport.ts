import { PathPoint } from '../types/route';

export class GpxParseError extends Error {}

export interface ParsedGpx {
  name: string | null;
  points: PathPoint[];
}

const NAME_RE = /<name>\s*([\s\S]*?)\s*<\/name>/i;
const LAT_RE = /\blat\s*=\s*"([^"]+)"/i;
const LON_RE = /\blon\s*=\s*"([^"]+)"/i;
const ELE_RE = /<ele>\s*([-\d.]+)\s*<\/ele>/i;

type PointTag = 'trkpt' | 'rtept' | 'wpt';

/**
 * Parses track points out of a GPX file's XML with targeted regexes rather
 * than a full XML parser — GPX's point elements are simple and consistent
 * enough across generators (Garmin, Strava, Komoot) that this is reliable,
 * and it avoids pulling in a new parsing dependency for one file format.
 * Prefers <trkpt> (recorded tracks), then <rtept> (planned routes), then
 * <wpt> (bare waypoint lists) — whichever the file actually has.
 */
export function parseGpx(xml: string): ParsedGpx {
  const points = extractPoints(xml, 'trkpt') || extractPoints(xml, 'rtept') || extractPoints(xml, 'wpt');

  if (!points || points.length < 2) {
    throw new GpxParseError("This GPX file doesn't have enough track points to build a route.");
  }

  const nameMatch = xml.match(NAME_RE);
  const name = nameMatch ? decodeXmlEntities(nameMatch[1].trim()) || null : null;

  return { name, points };
}

function extractPoints(xml: string, tag: PointTag): PathPoint[] | null {
  const re = new RegExp(`<${tag}\\b([^>]*)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g');
  const points: PathPoint[] = [];
  let match: RegExpExecArray | null;

  while ((match = re.exec(xml))) {
    const attrs = match[1];
    const inner = match[2] ?? '';
    const latMatch = attrs.match(LAT_RE);
    const lonMatch = attrs.match(LON_RE);
    if (!latMatch || !lonMatch) continue;

    const latitude = Number(latMatch[1]);
    const longitude = Number(lonMatch[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const eleMatch = inner.match(ELE_RE);
    const elevation = eleMatch ? Number(eleMatch[1]) : undefined;
    points.push(elevation !== undefined && Number.isFinite(elevation) ? { latitude, longitude, elevation } : { latitude, longitude });
  }

  return points.length > 0 ? points : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Total elevation gain (sum of positive deltas) for points that already have elevation. */
export function computeGpxGain(points: PathPoint[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].elevation;
    const curr = points[i].elevation;
    if (prev === undefined || curr === undefined) continue;
    const delta = curr - prev;
    if (delta > 0) gain += delta;
  }
  return gain;
}
