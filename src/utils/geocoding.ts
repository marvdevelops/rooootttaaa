import { LatLng } from '../types/route';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

export interface LngLatBounds {
  sw: [number, number];
  ne: [number, number];
}

export interface PlaceResult {
  id: string;
  name: string;
  fullName: string;
  latitude: number;
  longitude: number;
}

/**
 * Forward place search via Mapbox, biased toward the Philippines where
 * Rootah's userbase is. `proximity` (e.g. the route's last waypoint) ranks
 * nearby results first, so a generic query like "hotel" doesn't return a
 * match from the other side of the country.
 */
export async function searchPlaces(query: string, proximity?: LatLng): Promise<PlaceResult[]> {
  if (!MAPBOX_TOKEN || query.trim().length < 2) return [];

  try {
    const proximityParam = proximity ? `&proximity=${proximity.longitude},${proximity.latitude}` : '';
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${MAPBOX_TOKEN}&limit=6&country=ph${proximityParam}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    const features = Array.isArray(data.features) ? data.features : [];
    return features.map((f: { id: string; text: string; place_name: string; center: [number, number] }) => ({
      id: f.id,
      name: f.text,
      fullName: f.place_name,
      latitude: f.center[1],
      longitude: f.center[0],
    }));
  } catch {
    return [];
  }
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
