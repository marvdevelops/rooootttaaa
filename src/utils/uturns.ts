import { LatLng, RouteSegment } from '../types/route';
import { haversineDistance } from './distance';

/**
 * A u-turn matters for route-aware recording because the flattened path
 * physically overlaps itself there — the runner's position at the turn is
 * spatially close to both the outbound and return leg. getRouteProgress's
 * windowed continuity search (routeProgress.ts) handles that at recording
 * time; this is the companion "show it on the map" half, so a runner
 * scanning the route beforehand can see where the out-and-back actually
 * turns around, not just infer it from the line doubling back.
 */

// How far ahead/behind (in meters) to sample the incoming/outgoing
// direction — short enough to catch a tight turnaround, long enough that
// per-point GPS jitter in an imported track doesn't read as a fake u-turn.
const BEARING_SAMPLE_METERS = 12;
// Below this angle-between-directions, it's just a sharp corner, not a
// turnaround — a real u-turn reverses direction almost entirely.
const U_TURN_MIN_ANGLE_DEGREES = 150;
// Detections within this distance of each other are the same physical
// turnaround (several path points cluster around one turn) — keep only
// the sharpest.
const MERGE_RADIUS_METERS = 20;

function bearing(a: LatLng, b: LatLng): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function angleBetweenBearings(b1: number, b2: number): number {
  const diff = Math.abs(b1 - b2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export interface UTurnPoint {
  coordinate: LatLng;
  /** How sharp the reversal is — 180 is a perfect turnaround. Used to pick the sharpest point when merging nearby detections. */
  angleDegrees: number;
}

/** Scans a route's flattened path for points where the direction of travel reverses sharply — u-turns and out-and-back turnarounds. */
export function findUTurns(segments: RouteSegment[]): UTurnPoint[] {
  const points = segments.flatMap((s) => s.path);
  if (points.length < 3) return [];

  const candidates: UTurnPoint[] = [];

  for (let i = 1; i < points.length - 1; i++) {
    // Walk backward from i until BEARING_SAMPLE_METERS away, for the incoming direction.
    let back = i;
    let backDist = 0;
    while (back > 0 && backDist < BEARING_SAMPLE_METERS) {
      backDist += haversineDistance(points[back - 1], points[back]);
      back--;
    }
    // Walk forward from i for the outgoing direction.
    let fwd = i;
    let fwdDist = 0;
    while (fwd < points.length - 1 && fwdDist < BEARING_SAMPLE_METERS) {
      fwdDist += haversineDistance(points[fwd], points[fwd + 1]);
      fwd++;
    }
    if (back === i || fwd === i) continue;

    const incoming = bearing(points[back], points[i]);
    const outgoing = bearing(points[i], points[fwd]);
    const angle = angleBetweenBearings(incoming, outgoing);

    if (angle >= U_TURN_MIN_ANGLE_DEGREES) {
      candidates.push({ coordinate: points[i], angleDegrees: angle });
    }
  }

  // Merge clustered detections (the same physical turnaround usually
  // trips several consecutive points) down to one, keeping the sharpest.
  const merged: UTurnPoint[] = [];
  for (const candidate of candidates) {
    const nearby = merged.find((m) => haversineDistance(m.coordinate, candidate.coordinate) <= MERGE_RADIUS_METERS);
    if (!nearby) {
      merged.push(candidate);
    } else if (candidate.angleDegrees > nearby.angleDegrees) {
      nearby.coordinate = candidate.coordinate;
      nearby.angleDegrees = candidate.angleDegrees;
    }
  }

  return merged;
}
