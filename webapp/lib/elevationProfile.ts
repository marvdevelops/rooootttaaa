import { haversineDistance } from './distance';
import { PathPoint } from './types';

export interface ChartPoint {
  km: number;
  elevation: number;
}

export interface ElevationProfile {
  points: ChartPoint[];
  minElevation: number;
  maxElevation: number;
}

const EMPTY_PROFILE: ElevationProfile = { points: [], minElevation: 0, maxElevation: 0 };

/** Downsamples a path before persisting it (as a route's stored elevation profile) to keep payload size reasonable. */
export function downsampleForStorage(path: PathPoint[], maxPoints = 150): PathPoint[] {
  if (path.length <= maxPoints) return path;
  const step = (path.length - 1) / (maxPoints - 1);
  const result: PathPoint[] = [];
  for (let i = 0; i < maxPoints; i++) result.push(path[Math.round(i * step)]);
  return result;
}

/** Builds chart-ready distance/elevation points from an elevation-annotated path. */
export function buildElevationProfile(path: PathPoint[]): ElevationProfile {
  const withElevation = path.filter((p): p is PathPoint & { elevation: number } => typeof p.elevation === 'number');
  if (withElevation.length < 2) return EMPTY_PROFILE;

  const points: ChartPoint[] = [{ km: 0, elevation: withElevation[0].elevation }];
  let cumulativeM = 0;
  let minElevation = withElevation[0].elevation;
  let maxElevation = withElevation[0].elevation;

  for (let i = 1; i < withElevation.length; i++) {
    cumulativeM += haversineDistance(withElevation[i - 1], withElevation[i]);
    points.push({ km: cumulativeM / 1000, elevation: withElevation[i].elevation });
    minElevation = Math.min(minElevation, withElevation[i].elevation);
    maxElevation = Math.max(maxElevation, withElevation[i].elevation);
  }

  return { points, minElevation, maxElevation };
}
