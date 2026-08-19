import { PathPoint } from './types';

// Open-Meteo's elevation endpoint is free, keyless, and backed by a global
// DEM — same choice as mobile's elevation.ts, ported as-is.
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';
const MAX_SAMPLED_POINTS = 100;
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 15000;
const CACHE_PRECISION = 5;

export class ElevationError extends Error {}

const elevationCache = new Map<string, number>();

function cacheKey(point: PathPoint): string {
  return `${point.latitude.toFixed(CACHE_PRECISION)},${point.longitude.toFixed(CACHE_PRECISION)}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchElevations(points: PathPoint[]): Promise<number[]> {
  const lats = points.map((p) => p.latitude).join(',');
  const lngs = points.map((p) => p.longitude).join(',');
  const url = `${ELEVATION_URL}?latitude=${lats}&longitude=${lngs}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetchWithTimeout(url);
    } catch {
      if (attempt === MAX_RETRIES) throw new ElevationError('Elevation service timed out — check your connection and try again.');
      await sleep(500 * 2 ** attempt);
      continue;
    }

    if (response.status === 429) {
      if (attempt === MAX_RETRIES) throw new ElevationError('Elevation service is rate-limited — try again in a moment.');
      const retryAfterHeader = response.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
      await sleep(Number.isFinite(retryAfterMs) ? retryAfterMs : 500 * 2 ** attempt);
      continue;
    }

    if (!response.ok) throw new ElevationError(`Elevation request failed (${response.status})`);

    const data = await response.json();
    if (!Array.isArray(data.elevation)) throw new ElevationError('Elevation response was missing data.');
    return data.elevation;
  }

  throw new ElevationError('Elevation service is rate-limited — try again in a moment.');
}

async function queryElevations(points: PathPoint[]): Promise<number[]> {
  const results = new Array<number | undefined>(points.length);
  const uncachedIndices: number[] = [];

  points.forEach((point, i) => {
    const cached = elevationCache.get(cacheKey(point));
    if (cached !== undefined) results[i] = cached;
    else uncachedIndices.push(i);
  });

  if (uncachedIndices.length > 0) {
    const fetched = await fetchElevations(uncachedIndices.map((i) => points[i]));
    uncachedIndices.forEach((i, j) => {
      results[i] = fetched[j];
      elevationCache.set(cacheKey(points[i]), fetched[j]);
    });
  }

  return results as number[];
}

function downsample(path: PathPoint[], maxPoints: number): number[] {
  if (path.length <= maxPoints) return path.map((_, i) => i);
  const step = (path.length - 1) / (maxPoints - 1);
  const indices: number[] = [];
  for (let i = 0; i < maxPoints; i++) indices.push(Math.round(i * step));
  return indices;
}

function interpolateElevations(sampleIndices: number[], elevations: (number | undefined)[], length: number): number[] {
  const known = sampleIndices.map((idx) => ({ idx, ele: elevations[idx] })).filter((p): p is { idx: number; ele: number } => p.ele !== undefined);
  if (known.length === 0) return new Array(length).fill(0);

  const result = new Array<number>(length);
  for (let i = 0; i < length; i++) {
    let before = known[0];
    let after = known[known.length - 1];
    for (const point of known) {
      if (point.idx <= i) before = point;
      if (point.idx >= i) {
        after = point;
        break;
      }
    }
    result[i] = before.idx === after.idx ? before.ele : before.ele + ((i - before.idx) / (after.idx - before.idx)) * (after.ele - before.ele);
  }
  return result;
}

function computeGain(elevations: number[]): number {
  let gain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const delta = elevations[i] - elevations[i - 1];
    if (delta > 0) gain += delta;
  }
  return gain;
}

/**
 * Fetches elevation for a downsampled subset of the path and interpolates
 * the rest, returning the full path annotated with elevation plus total
 * gain in meters — same downsample-then-interpolate strategy as mobile.
 */
export async function annotateElevation(path: PathPoint[]): Promise<{ path: PathPoint[]; gainMeters: number }> {
  if (path.length === 0) return { path, gainMeters: 0 };

  const sampleIndices = downsample(path, MAX_SAMPLED_POINTS);
  const elevations = new Array<number | undefined>(path.length).fill(undefined);

  for (let i = 0; i < sampleIndices.length; i += BATCH_SIZE) {
    const batch = sampleIndices.slice(i, i + BATCH_SIZE);
    const results = await queryElevations(batch.map((idx) => path[idx]));
    batch.forEach((idx, j) => {
      elevations[idx] = results[j];
    });
  }

  const interpolated = interpolateElevations(sampleIndices, elevations, path.length);
  const annotated = path.map((point, i) => ({ ...point, elevation: interpolated[i] }));
  return { path: annotated, gainMeters: computeGain(interpolated) };
}
