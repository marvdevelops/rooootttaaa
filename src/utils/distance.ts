import { LatLng, RouteSegment } from '../types/route';

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function pathDistance(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineDistance(path[i - 1], path[i]);
  }
  return total;
}

export function totalRouteDistance(segments: RouteSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.distanceMeters, 0);
}

export function metersToKm(meters: number): number {
  return meters / 1000;
}

export interface KilometerMarker {
  coordinate: LatLng;
  km: number;
}

/** Finds the point along the path at each whole-kilometer mark, interpolating between the two nearest path points. */
export function kilometerMarkers(path: LatLng[]): KilometerMarker[] {
  if (path.length < 2) return [];

  const markers: KilometerMarker[] = [];
  let cumulative = 0;
  let nextTargetMeters = 1000;

  for (let i = 1; i < path.length; i++) {
    const segmentStart = path[i - 1];
    const segmentEnd = path[i];
    const segmentLength = haversineDistance(segmentStart, segmentEnd);

    while (cumulative + segmentLength >= nextTargetMeters) {
      const remaining = nextTargetMeters - cumulative;
      const t = segmentLength === 0 ? 0 : remaining / segmentLength;
      markers.push({
        coordinate: {
          latitude: segmentStart.latitude + t * (segmentEnd.latitude - segmentStart.latitude),
          longitude: segmentStart.longitude + t * (segmentEnd.longitude - segmentStart.longitude),
        },
        km: nextTargetMeters / 1000,
      });
      nextTargetMeters += 1000;
    }

    cumulative += segmentLength;
  }

  return markers;
}
