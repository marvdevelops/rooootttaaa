import { LatLng } from '../types/route';

interface Point2D {
  x: number;
  y: number;
}

// Local equirectangular projection centered on the path's own latitude —
// accurate enough at route scale (a few km to tens of km), and much cheaper
// than a real geodesic distance for every point on every recursion.
function toPlanar(p: LatLng, refLat: number): Point2D {
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((refLat * Math.PI) / 180);
  return { x: p.longitude * metersPerDegLng, y: p.latitude * metersPerDegLat };
}

function perpendicularDistanceMeters(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }

  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

/**
 * Ramer-Douglas-Peucker simplification. Keeps a point only if it deviates
 * more than `toleranceMeters` from the straight line between its
 * surrounding kept neighbors — so a sharp turn stays sharp (the point at
 * the corner is exactly what "deviates" from the straight line cutting
 * through it) while long straight/gently-curving stretches get thinned
 * out. Unlike fixed-interval decimation (keep every Nth point regardless
 * of shape), this can't smooth away a real corner just because it happened
 * to fall between two kept samples.
 */
export function simplifyPath<T extends LatLng>(path: T[], toleranceMeters: number): T[] {
  if (path.length <= 2) return path;

  const refLat = path[0].latitude;
  const planar = path.map((p) => toPlanar(p, refLat));
  const keep = new Array<boolean>(path.length).fill(false);
  keep[0] = true;
  keep[path.length - 1] = true;

  // Iterative stack instead of recursion — a pathological input (e.g. a
  // perfectly straight recorded track) could otherwise recurse close to
  // path.length deep.
  const stack: [number, number][] = [[0, path.length - 1]];
  while (stack.length > 0) {
    const [startIdx, endIdx] = stack.pop()!;
    if (endIdx <= startIdx + 1) continue;

    let maxDist = 0;
    let maxIdx = -1;
    for (let i = startIdx + 1; i < endIdx; i++) {
      const dist = perpendicularDistanceMeters(planar[i], planar[startIdx], planar[endIdx]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > toleranceMeters && maxIdx !== -1) {
      keep[maxIdx] = true;
      stack.push([startIdx, maxIdx], [maxIdx, endIdx]);
    }
  }

  return path.filter((_, i) => keep[i]);
}
