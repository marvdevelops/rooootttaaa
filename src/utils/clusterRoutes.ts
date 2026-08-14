import { CloudRoute, LatLng } from '../types/route';

export interface RouteCluster {
  center: LatLng;
  routes: CloudRoute[];
}

/**
 * Greedily groups routes whose start points fall within `pixelRadius` of
 * each other at the given zoom, so overlapping/near-identical starting
 * points collapse into one pin instead of hiding each other. Approximate
 * (degrees-per-pixel at the equator, adjusted for latitude) — good enough
 * for deciding whether pins would visually overlap, not for precision.
 */
export function clusterRoutesByStart(routes: CloudRoute[], zoom: number, pixelRadius = 28): RouteCluster[] {
  const withStart = routes
    .map((route) => ({ route, start: route.waypoints[0] }))
    .filter((r): r is { route: CloudRoute; start: Exclude<typeof r.start, undefined> } => !!r.start);

  const clusters: RouteCluster[] = [];

  for (const { route, start } of withStart) {
    const degreesPerPixel = (360 / (256 * Math.pow(2, zoom))) / Math.max(0.2, Math.cos((start.latitude * Math.PI) / 180));
    const thresholdDeg = degreesPerPixel * pixelRadius;

    const existing = clusters.find(
      (c) => Math.abs(c.center.latitude - start.latitude) < thresholdDeg && Math.abs(c.center.longitude - start.longitude) < thresholdDeg,
    );

    if (existing) {
      existing.routes.push(route);
      // Re-anchor to the running average so the cluster pin sits in the
      // middle of its members rather than drifting toward whichever
      // route happened to be first.
      const n = existing.routes.length;
      existing.center = {
        latitude: existing.center.latitude + (start.latitude - existing.center.latitude) / n,
        longitude: existing.center.longitude + (start.longitude - existing.center.longitude) / n,
      };
    } else {
      clusters.push({ center: start, routes: [route] });
    }
  }

  return clusters;
}
