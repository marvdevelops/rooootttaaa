import { LatLng, Waypoint } from './types';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const MAX_PATH_POINTS = 100;

function downsample(points: LatLng[], maxPoints: number): LatLng[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const result: LatLng[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}

/**
 * Builds a non-interactive Mapbox Static Images API URL for the public web
 * preview — a flat rendered image, not an embedded/pannable map, so viewers
 * without the app can only see an overview.
 */
export function buildStaticMapUrl(
  fullPath: LatLng[],
  waypoints: Waypoint[],
  { width = 1200, height = 630 }: { width?: number; height?: number } = {},
): string | null {
  if (!MAPBOX_TOKEN || fullPath.length < 2) return null;

  const sampled = downsample(fullPath, MAX_PATH_POINTS);

  const lineFeature = {
    type: 'Feature',
    properties: {
      stroke: '#EC4624',
      'stroke-width': 4,
      'stroke-opacity': 1,
    },
    geometry: {
      type: 'LineString',
      coordinates: sampled.map((p) => [p.longitude, p.latitude]),
    },
  };

  const geojsonOverlay = `geojson(${encodeURIComponent(JSON.stringify(lineFeature))})`;

  const start = waypoints[0];
  const end = waypoints[waypoints.length - 1];
  const markerOverlays: string[] = [];
  if (start) markerOverlays.push(`pin-s+3fa34d(${start.longitude},${start.latitude})`);
  if (end && end !== start) markerOverlays.push(`pin-s+e13a3a(${end.longitude},${end.latitude})`);

  const overlay = [geojsonOverlay, ...markerOverlays].join(',');

  return (
    `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/${overlay}/auto/${width}x${height}` +
    `?padding=40&access_token=${MAPBOX_TOKEN}`
  );
}
