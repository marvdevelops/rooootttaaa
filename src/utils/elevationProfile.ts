import { PathPoint } from '../types/route';
import { classifyGradeRuns } from './grade';
import { haversineDistance } from './distance';

export interface ChartPoint {
  km: number;
  elevation: number;
}

export interface ElevationSegment {
  startKm: number;
  endKm: number;
  gainM: number;
  lossM: number;
  color: string;
}

export interface ElevationProfile {
  points: ChartPoint[];
  segments: ElevationSegment[];
  minElevation: number;
  maxElevation: number;
  totalKm: number;
}

/** Downsamples a path before persisting it (e.g. as a route's stored elevation profile) to keep payload size reasonable. */
export function downsampleForStorage(path: PathPoint[], maxPoints = 150): PathPoint[] {
  if (path.length <= maxPoints) return path;
  const step = (path.length - 1) / (maxPoints - 1);
  const result: PathPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(path[Math.round(i * step)]);
  }
  return result;
}

const EMPTY_PROFILE: ElevationProfile = {
  points: [],
  segments: [],
  minElevation: 0,
  maxElevation: 0,
  totalKm: 0,
};

/**
 * Builds chart-ready data from an elevation-annotated path: a distance/
 * elevation point series (full resolution, for the line itself), plus
 * contiguous grade-colored segments (flat vs moderate/steep climb, smoothed
 * and merged via classifyGradeRuns so the segment bar isn't speckled) with
 * their gain/loss, for the elevation profile UI.
 */
export function buildElevationProfile(path: PathPoint[]): ElevationProfile {
  const withElevation = path.filter((p): p is PathPoint & { elevation: number } => typeof p.elevation === 'number');
  if (withElevation.length < 2) return EMPTY_PROFILE;

  const points: ChartPoint[] = [{ km: 0, elevation: withElevation[0].elevation }];
  let cumulativeM = 0;
  let minElevation = withElevation[0].elevation;
  let maxElevation = withElevation[0].elevation;

  for (let i = 1; i < withElevation.length; i++) {
    const distM = haversineDistance(withElevation[i - 1], withElevation[i]);
    cumulativeM += distM;
    points.push({ km: cumulativeM / 1000, elevation: withElevation[i].elevation });
    minElevation = Math.min(minElevation, withElevation[i].elevation);
    maxElevation = Math.max(maxElevation, withElevation[i].elevation);
  }

  const { runs } = classifyGradeRuns(path);
  const segments: ElevationSegment[] = runs.map((run) => {
    let gainM = 0;
    let lossM = 0;
    for (let i = run.startIdx + 1; i <= run.endIdx; i++) {
      const delta = withElevation[i].elevation - withElevation[i - 1].elevation;
      if (delta > 0) gainM += delta;
      else lossM += -delta;
    }
    return { startKm: points[run.startIdx].km, endKm: points[run.endIdx].km, gainM, lossM, color: run.color };
  });

  return { points, segments, minElevation, maxElevation, totalKm: cumulativeM / 1000 };
}

export interface GainLossGrade {
  gainM: number;
  lossM: number;
  /** Steepest single-step gradient, as a percentage (rise/run * 100) — trail routes care about this beyond total gain. */
  maxGradePercent: number;
}

/** Total elevation gain/loss and steepest grade — for the trail-route "↑800m · ↓200m" stat and "Max grade: 28%" label. */
export function elevationGainLossGrade(path: PathPoint[]): GainLossGrade {
  const withElevation = path.filter((p): p is PathPoint & { elevation: number } => typeof p.elevation === 'number');
  if (withElevation.length < 2) return { gainM: 0, lossM: 0, maxGradePercent: 0 };

  let gainM = 0;
  let lossM = 0;
  let maxGradePercent = 0;

  for (let i = 1; i < withElevation.length; i++) {
    const distM = haversineDistance(withElevation[i - 1], withElevation[i]);
    const delta = withElevation[i].elevation - withElevation[i - 1].elevation;
    if (delta > 0) gainM += delta;
    else lossM += -delta;
    if (distM > 1) {
      maxGradePercent = Math.max(maxGradePercent, (Math.abs(delta) / distM) * 100);
    }
  }

  return { gainM, lossM, maxGradePercent };
}
