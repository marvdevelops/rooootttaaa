/**
 * One-off bulk GPX importer — creates public routes owned by the official
 * "Rootah" account from a folder of .gpx files, auto-naming and describing
 * each one from its parsed geometry + reverse-geocoded start location.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx --env-file=.env scripts/bulkImportGpx.ts <folder-or-file> [...more]
 *
 * Uses the service-role key (bypasses RLS) so it can insert rows owned by
 * the official account without needing that account's password.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const OFFICIAL_ACCOUNT_ID = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f'; // "Rootah" official profile

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface Point {
  latitude: number;
  longitude: number;
  elevation?: number;
}

type ActivityType = 'run' | 'trail_run' | 'hike' | 'bike' | 'walk' | 'other';

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  hike: 'Hike',
  bike: 'Ride',
  walk: 'Walk',
  other: 'Route',
};

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistance(a: Point, b: Point): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

function pathDistanceMeters(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineDistance(points[i - 1], points[i]);
  return total;
}

function elevationGainMeters(points: Point[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].elevation;
    const cur = points[i].elevation;
    if (prev !== undefined && cur !== undefined && cur > prev) gain += cur - prev;
  }
  return gain;
}

/** Uniformly downsamples to keep stored payloads reasonable — mirrors the app's own cap on imported GPX point counts. */
function downsample<T>(points: T[], maxPoints: number): T[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i++) result.push(points[Math.round(i * step)]);
  return result;
}

interface ParsedGpx {
  points: Point[];
  trackName: string | null;
  type: string | null;
}

class GpxParseError extends Error {}

function parseGpx(xml: string): ParsedGpx {
  const cleaned = xml.replace(/<extensions[\s\S]*?<\/extensions>/g, '');

  function extractPoints(tag: 'trkpt' | 'rtept' | 'wpt'): Point[] {
    const re = new RegExp(`<${tag}\\s+lat="(-?\\d+\\.?\\d*)"\\s+lon="(-?\\d+\\.?\\d*)"[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
    const points: Point[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned))) {
      const eleMatch = m[3].match(/<ele>(-?\d+\.?\d*)<\/ele>/);
      points.push({ latitude: parseFloat(m[1]), longitude: parseFloat(m[2]), elevation: eleMatch ? parseFloat(eleMatch[1]) : undefined });
    }
    return points;
  }

  let points = extractPoints('trkpt');
  if (points.length < 2) points = extractPoints('rtept');
  if (points.length < 2) points = extractPoints('wpt');
  if (points.length < 2) throw new GpxParseError('Fewer than 2 track points found.');

  // Scoped to <trk>'s own direct <name> — an unscoped "first <name> anywhere"
  // match can land on a turn-by-turn cue's <name> (e.g. "Start on P") in
  // files that list <wpt> cues before the <trk> element.
  const trkNameMatch = cleaned.match(/<trk[^>]*>\s*<name>([^<]*)<\/name>/);
  const metaNameMatch = cleaned.match(/<metadata[^>]*>\s*<name>([^<]*)<\/name>/);
  const typeMatch = cleaned.match(/<trk[^>]*>[\s\S]*?<type>([^<]*)<\/type>/);

  return {
    points,
    trackName: (trkNameMatch ?? metaNameMatch)?.[1]?.trim() || null,
    type: typeMatch?.[1]?.trim() || null,
  };
}

/** Turn-by-turn cue text and other non-titles that shouldn't be used as a route name. */
function isGenericName(name: string | null): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  if (n.length < 3) return true;
  const genericPatterns = [
    /^start on/,
    /^keep (left|right)/,
    /^turn (slight|right|left)/,
    /^continue/,
    /^arrive/,
    /^waypoint/,
    /^\d+$/,
    /^morning run$/,
    /^night run$/,
    /^zone \d+$/,
    /^trail running$/,
  ];
  return genericPatterns.some((re) => re.test(n));
}

/** Cleans a filename into a human title when the GPX itself has no usable name. */
function titleFromFilename(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  return base
    .replace(/^\d{4}-\d{2}-\d{2}_\d+_?/, '') // strip leading export timestamps/ids
    .replace(/^\d+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function inferActivityType(name: string | null, type: string | null): ActivityType {
  const haystack = `${name ?? ''} ${type ?? ''}`.toLowerCase();
  if (haystack.includes('trail')) return 'trail_run';
  if (haystack.includes('hik')) return 'hike';
  if (haystack.includes('bik') || haystack.includes('cycl') || haystack.includes('ride')) return 'bike';
  if (haystack.includes('walk')) return 'walk';
  if (haystack.includes('run')) return 'run';
  return 'run'; // default — most of Rootah's official library is running routes
}

interface ReverseGeocodeResult {
  city: string | null;
}

async function reverseGeocodeCity(point: Point): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.longitude},${point.latitude}.json` +
      `?types=place&limit=1&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { text?: string }[] };
    return data.features?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

function buildNameAndDescription(
  trackName: string | null,
  filePath: string,
  city: string | null,
  activityType: ActivityType,
  distanceKm: number,
  elevationGainM: number,
): { name: string; description: string } {
  const activityLabel = ACTIVITY_LABEL[activityType];
  const usableTrackName = !isGenericName(trackName) ? trackName! : null;
  const base = usableTrackName ?? titleFromFilename(filePath) ?? `${city ?? 'Rootah'} ${activityLabel}`;

  const cityAlreadyMentioned = city && base.toLowerCase().includes(city.toLowerCase());
  const name = usableTrackName
    ? cityAlreadyMentioned || !city
      ? base
      : `${base} · ${city}`
    : `${city ? `${city} ` : ''}${activityLabel} — ${distanceKm.toFixed(1)}km`;

  const descriptionParts = [
    `${distanceKm.toFixed(1)}km ${activityLabel.toLowerCase()}${city ? ` in ${city}` : ''}`,
    elevationGainM > 20 ? `${Math.round(elevationGainM)}m of elevation gain` : null,
  ].filter(Boolean);

  const description = `${descriptionParts.join(' with ')}. Imported from a GPX route by the Rootah team.`;

  return { name, description };
}

function collectGpxFiles(inputs: string[]): string[] {
  const files: string[] = [];
  for (const input of inputs) {
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(input)) {
        if (entry.toLowerCase().endsWith('.gpx')) files.push(path.join(input, entry));
      }
    } else if (input.toLowerCase().endsWith('.gpx')) {
      files.push(input);
    }
  }
  return files;
}

async function importOne(filePath: string): Promise<{ file: string; name: string; id?: string; error?: string }> {
  const xml = fs.readFileSync(filePath, 'utf-8');
  let parsed: ParsedGpx;
  try {
    parsed = parseGpx(xml);
  } catch (err) {
    return { file: filePath, name: '(unparsed)', error: err instanceof Error ? err.message : 'Parse failed' };
  }

  const fullPoints = parsed.points;
  const distanceKm = pathDistanceMeters(fullPoints) / 1000;
  const elevationGainM = elevationGainMeters(fullPoints);
  const activityType = inferActivityType(parsed.trackName, parsed.type);
  const city = await reverseGeocodeCity(fullPoints[0]);
  const { name, description } = buildNameAndDescription(parsed.trackName, filePath, city, activityType, distanceKm, elevationGainM);

  const storedPath = downsample(fullPoints, 1000);
  const elevationProfile = downsample(fullPoints.filter((p) => p.elevation !== undefined), 300);
  const start = fullPoints[0];
  const end = fullPoints[fullPoints.length - 1];

  const waypoints = [
    { id: 'gpx-start', latitude: start.latitude, longitude: start.longitude },
    { id: 'gpx-end', latitude: end.latitude, longitude: end.longitude },
  ];
  const segments = [
    {
      fromId: 'gpx-start',
      toId: 'gpx-end',
      path: storedPath.map((p) => ({ latitude: p.latitude, longitude: p.longitude, elevation: p.elevation })),
      distanceMeters: pathDistanceMeters(fullPoints),
    },
  ];

  const { data, error } = await supabase
    .from('routes')
    .insert({
      owner_id: OFFICIAL_ACCOUNT_ID,
      name,
      description,
      activity_type: activityType,
      waypoints,
      segments,
      notes: [],
      distance_km: distanceKm,
      elevation_gain_m: elevationGainM,
      elevation_profile: elevationProfile.map((p) => ({ latitude: p.latitude, longitude: p.longitude, elevation: p.elevation })),
      city,
      is_public: true,
    })
    .select('id')
    .single();

  if (error) return { file: filePath, name, error: error.message };
  return { file: filePath, name, id: data.id as string };
}

async function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error('Usage: npx tsx --env-file=.env scripts/bulkImportGpx.ts <folder-or-file> [...more]');
    process.exit(1);
  }

  const files = collectGpxFiles(inputs);
  if (files.length === 0) {
    console.error('No .gpx files found in the given path(s).');
    process.exit(1);
  }

  console.log(`Found ${files.length} GPX file(s). Importing as the official Rootah account...\n`);

  for (const file of files) {
    const result = await importOne(file);
    if (result.error) {
      console.log(`✗ ${path.basename(file)} — ${result.error}`);
    } else {
      console.log(`✓ ${path.basename(file)} → "${result.name}" (${result.id})`);
    }
  }
}

main();
