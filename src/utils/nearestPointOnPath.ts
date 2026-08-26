import { LatLng, RouteSegment } from '../types/route';

interface Point2D {
  x: number;
  y: number;
}

// Same local equirectangular projection as simplifyPath.ts — accurate
// enough at route scale, cheap to run per-tap over every path point.
function toPlanar(p: LatLng, refLat: number): Point2D {
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((refLat * Math.PI) / 180);
  return { x: p.longitude * metersPerDegLng, y: p.latitude * metersPerDegLat };
}

function toLatLng(pt: Point2D, refLat: number): LatLng {
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((refLat * Math.PI) / 180);
  return { latitude: pt.y / metersPerDegLat, longitude: pt.x / metersPerDegLng };
}

export interface NearestPointResult {
  segmentIndex: number;
  /** Insert the new point between segment.path[pathIndex] and segment.path[pathIndex + 1]. */
  pathIndex: number;
  /** The tapped point projected onto the line — same "snap to the road" idea as dragging a marker. */
  point: LatLng;
  distanceMeters: number;
}

/**
 * Finds the closest point lying ON the route's line (not just the closest
 * existing vertex) to a tapped coordinate, by projecting onto each straight
 * sub-segment between consecutive path points and clamping to that
 * sub-segment's extent. Works whether the underlying path is a dense
 * GPX-imported track or a sparse 2-point straight-line/Directions leg.
 */
export function findNearestPointOnPath(coord: LatLng, segments: RouteSegment[]): NearestPointResult | null {
  let best: NearestPointResult | null = null;
  const refLat = coord.latitude;
  const target = toPlanar(coord, refLat);

  segments.forEach((segment, segIdx) => {
    const path = segment.path;
    for (let i = 0; i < path.length - 1; i++) {
      const a = toPlanar(path[i], refLat);
      const b = toPlanar(path[i + 1], refLat);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lengthSq = dx * dx + dy * dy;
      let t = lengthSq === 0 ? 0 : ((target.x - a.x) * dx + (target.y - a.y) * dy) / lengthSq;
      t = Math.max(0, Math.min(1, t));
      const projX = a.x + t * dx;
      const projY = a.y + t * dy;
      const distanceMeters = Math.hypot(target.x - projX, target.y - projY);

      if (!best || distanceMeters < best.distanceMeters) {
        best = { segmentIndex: segIdx, pathIndex: i, point: toLatLng({ x: projX, y: projY }, refLat), distanceMeters };
      }
    }
  });

  return best;
}
