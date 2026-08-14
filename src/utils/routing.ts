import { LatLng, PathPoint } from '../types/route';
import { pathDistance } from './distance';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export class RoutingError extends Error {}

export interface RoutedSegment {
  path: PathPoint[];
  distanceMeters: number;
  /** Where the API actually snapped `from`/`to` to the road network — may differ from the tapped/dragged point. */
  snappedFrom: LatLng;
  snappedTo: LatLng;
}

/**
 * Fetches a walking-profile route between two points from the Mapbox
 * Directions API. Falls back to a straight line if the API call fails,
 * so a single flaky segment never blocks the rest of the route.
 *
 * Biased away from sidewalks/walkways and alleys (walkway_bias/alley_bias)
 * so the line prefers the main road instead of hopping onto a parallel
 * footpath and back — the default walking profile favors dedicated
 * pedestrian infrastructure over the road centerline, which reads as an
 * unwanted detour for runners/cyclists who just want to follow the road.
 */
export async function routeBetween(
  from: LatLng,
  to: LatLng,
): Promise<RoutedSegment> {
  if (!MAPBOX_TOKEN) {
    throw new RoutingError(
      'Missing EXPO_PUBLIC_MAPBOX_TOKEN — set it in .env before running the app.',
    );
  }

  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}` +
    `?geometries=geojson&overview=full&walkway_bias=-1&alley_bias=-1&access_token=${MAPBOX_TOKEN}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new RoutingError(`Mapbox Directions request failed (${response.status})`);
  }

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) {
    throw new RoutingError('No route found between these points.');
  }

  const path: PathPoint[] = route.geometry.coordinates.map(
    ([longitude, latitude]: [number, number]) => ({ latitude, longitude }),
  );

  const apiWaypoints: { location: [number, number] }[] | undefined = data.waypoints;
  const snappedFrom = apiWaypoints?.[0]
    ? { longitude: apiWaypoints[0].location[0], latitude: apiWaypoints[0].location[1] }
    : path[0] ?? from;
  const snappedTo = apiWaypoints?.[1]
    ? { longitude: apiWaypoints[1].location[0], latitude: apiWaypoints[1].location[1] }
    : path[path.length - 1] ?? to;

  return {
    path,
    distanceMeters: route.distance ?? pathDistance(path),
    snappedFrom,
    snappedTo,
  };
}

export function straightLineFallback(from: LatLng, to: LatLng): RoutedSegment {
  const path = [from, to];
  return { path, distanceMeters: pathDistance(path), snappedFrom: from, snappedTo: to };
}
