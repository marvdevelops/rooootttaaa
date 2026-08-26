import { LatLng, PathPoint, RouteSegment } from '../types/route';
import { haversineDistance } from './distance';
import { findNearestPointOnPath, NearestPointResult } from './nearestPointOnPath';

export interface RouteProgressIndex {
  points: PathPoint[];
  /** Cumulative distance from the route start to points[i], in meters. */
  cumulativeMeters: number[];
  totalMeters: number;
}

const MIN_CLIMB_GRADE = 0.05; // 5%
const MIN_CLIMB_LENGTH_METERS = 100;

/** Flattens a route's segments into one ordered point list with cumulative distance — built once per recording, not per GPS update. */
export function buildRouteProgressIndex(segments: RouteSegment[]): RouteProgressIndex {
  const points: PathPoint[] = [];
  for (const segment of segments) points.push(...segment.path);

  const cumulativeMeters: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumulativeMeters.push(cumulativeMeters[i - 1] + haversineDistance(points[i - 1], points[i]));
  }

  return { points, cumulativeMeters, totalMeters: cumulativeMeters[cumulativeMeters.length - 1] ?? 0 };
}

export interface RouteProgress {
  /** Perpendicular distance from the runner's current position to the route line. */
  deviationMeters: number;
  traveledMeters: number;
  remainingMeters: number;
  /** Index into the index's flattened point list nearest the runner's position — the scan-forward start point for findNextClimb. */
  nearestPointIndex: number;
}

// A pure global nearest-point search has no notion of "which pass" — on a
// route with a u-turn or a repeated loop, the runner's position near the
// turnaround/overlap is physically close to BOTH the outbound and return
// leg (or both lap 1 and lap 2), and picking whichever is spatially
// closest can snap onto the wrong one: traveled distance jumps backward,
// or finish detection fires early because the line near the loop's
// start/end reads as "near the finish" a lap too soon. Once we have a
// last-known position along the path (hintFlatIndex), searching only a
// window around it keeps continuity — the wrong-pass candidate is usually
// far away in path-order even though it's nearby in raw distance.
const WINDOW_METERS = 250;
// If the windowed search's best match is still this far from the runner,
// the hint is stale (GPS dropout, a genuine detour, or the very first fix)
// — fall back to the full global search rather than force a bad match.
const LOST_THRESHOLD_METERS = 150;

function nearestIndexInWindow(index: RouteProgressIndex, hintFlatIndex: number, position: LatLng): { flatIndex: number; distanceMeters: number } {
  const { points, cumulativeMeters } = index;
  const hintCum = cumulativeMeters[hintFlatIndex] ?? 0;
  let bestIdx = hintFlatIndex;
  let bestDist = haversineDistance(position, points[hintFlatIndex]);

  for (let i = hintFlatIndex + 1; i < points.length && cumulativeMeters[i] - hintCum <= WINDOW_METERS; i++) {
    const d = haversineDistance(position, points[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  for (let i = hintFlatIndex - 1; i >= 0 && hintCum - cumulativeMeters[i] <= WINDOW_METERS; i--) {
    const d = haversineDistance(position, points[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return { flatIndex: bestIdx, distanceMeters: bestDist };
}

/**
 * Projects the runner's current position onto the route and reports how
 * far along they are. Pass the previous call's `nearestPointIndex` back in
 * as `hintFlatIndex` to keep continuity through u-turns and repeated loops
 * (see WINDOW_METERS above) — omit it only for the first call.
 */
export function getRouteProgress(
  index: RouteProgressIndex,
  segments: RouteSegment[],
  position: LatLng,
  hintFlatIndex?: number | null,
): RouteProgress | null {
  if (hintFlatIndex != null && index.points[hintFlatIndex]) {
    const windowed = nearestIndexInWindow(index, hintFlatIndex, position);
    if (windowed.distanceMeters <= LOST_THRESHOLD_METERS) {
      const traveledMeters = index.cumulativeMeters[windowed.flatIndex] ?? 0;
      return {
        deviationMeters: windowed.distanceMeters,
        traveledMeters,
        remainingMeters: Math.max(0, index.totalMeters - traveledMeters),
        nearestPointIndex: windowed.flatIndex,
      };
    }
  }

  const nearest: NearestPointResult | null = findNearestPointOnPath(position, segments);
  if (!nearest) return null;

  // Map the nearest result's (segmentIndex, pathIndex) back to a flat index
  // into `index.points` — segments were concatenated in the same order.
  let flatIndex = 0;
  for (let s = 0; s < nearest.segmentIndex; s++) flatIndex += segments[s].path.length;
  flatIndex += nearest.pathIndex;

  const traveledMeters = index.cumulativeMeters[flatIndex] ?? 0;
  return {
    deviationMeters: nearest.distanceMeters,
    traveledMeters,
    remainingMeters: Math.max(0, index.totalMeters - traveledMeters),
    nearestPointIndex: flatIndex,
  };
}

export interface UpcomingClimb {
  distanceToClimbMeters: number;
  climbGainMeters: number;
  climbLengthMeters: number;
}

/** Scans forward from the runner's position for the next sustained climb (grade > 5% for > 100m). */
export function findNextClimb(index: RouteProgressIndex, fromPointIndex: number): UpcomingClimb | null {
  const { points, cumulativeMeters } = index;
  if (fromPointIndex >= points.length - 1) return null;

  let climbStart: number | null = null;

  for (let i = fromPointIndex; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (a.elevation === undefined || b.elevation === undefined) continue;

    const segMeters = cumulativeMeters[i + 1] - cumulativeMeters[i];
    if (segMeters <= 0) continue;
    const grade = (b.elevation - a.elevation) / segMeters;

    if (grade >= MIN_CLIMB_GRADE) {
      if (climbStart === null) climbStart = i;
    } else if (climbStart !== null) {
      const climbLengthMeters = cumulativeMeters[i] - cumulativeMeters[climbStart];
      if (climbLengthMeters >= MIN_CLIMB_LENGTH_METERS) {
        return {
          distanceToClimbMeters: cumulativeMeters[climbStart] - cumulativeMeters[fromPointIndex],
          climbGainMeters: Math.round((points[i].elevation ?? 0) - (points[climbStart].elevation ?? 0)),
          climbLengthMeters: Math.round(climbLengthMeters),
        };
      }
      climbStart = null;
    }
  }

  if (climbStart !== null) {
    const lastIdx = points.length - 1;
    const climbLengthMeters = cumulativeMeters[lastIdx] - cumulativeMeters[climbStart];
    if (climbLengthMeters >= MIN_CLIMB_LENGTH_METERS) {
      return {
        distanceToClimbMeters: cumulativeMeters[climbStart] - cumulativeMeters[fromPointIndex],
        climbGainMeters: Math.round((points[lastIdx].elevation ?? 0) - (points[climbStart].elevation ?? 0)),
        climbLengthMeters: Math.round(climbLengthMeters),
      };
    }
  }

  return null;
}
