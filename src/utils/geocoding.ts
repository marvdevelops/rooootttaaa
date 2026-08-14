import { LatLng } from '../types/route';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export interface LngLatBounds {
  sw: [number, number];
  ne: [number, number];
}

/**
 * Reverse-geocodes a point to its city name via Mapbox, for tagging routes
 * at save time so Discover can filter by city. Returns null on any failure
 * (missing token, network error, no place found) — city is a nice-to-have,
 * never worth blocking a route save over.
 */
export async function reverseGeocodeCity(point: LatLng): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.longitude},${point.latitude}.json` +
      `?types=place&limit=1&access_token=${MAPBOX_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const place = data.features?.[0];
    return typeof place?.text === 'string' ? place.text : null;
  } catch {
    return null;
  }
}

/**
 * Reverse-geocodes a point to the bounding box of the country it's in, so
 * the Discover map can open zoomed out to the whole country instead of a
 * single city. Returns null on any failure (missing token, network error,
 * no bbox in the response) — callers should fall back to a fixed zoom level.
 */
export async function reverseGeocodeCountryBounds(point: LatLng): Promise<LngLatBounds | null> {
  if (!MAPBOX_TOKEN) return null;

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.longitude},${point.latitude}.json` +
      `?types=country&limit=1&access_token=${MAPBOX_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const bbox = data.features?.[0]?.bbox;
    if (!Array.isArray(bbox) || bbox.length !== 4) return null;
    const [w, s, e, n] = bbox;
    return { sw: [w, s], ne: [e, n] };
  } catch {
    return null;
  }
}
