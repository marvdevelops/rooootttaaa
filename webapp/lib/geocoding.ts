export interface PlaceResult {
  id: string;
  name: string;
  fullName: string;
  latitude: number;
  longitude: number;
}

interface MapboxFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
}

/**
 * Forward place search via Mapbox's Geocoding API, biased toward the
 * Philippines where Rootah's userbase is. `proximity` (if given — e.g. the
 * route's last waypoint, or the map's current center) ranks nearby results
 * first, so a generic query like "hotel" doesn't return a match from the
 * other side of the country.
 */
export async function searchPlaces(query: string, proximity?: { latitude: number; longitude: number }): Promise<PlaceResult[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || query.trim().length < 2) return [];

  const proximityParam = proximity ? `&proximity=${proximity.longitude},${proximity.latitude}` : '';
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=6&country=ph${proximityParam}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: MapboxFeature[] };

  return (data.features ?? []).map((f) => ({
    id: f.id,
    name: f.text,
    fullName: f.place_name,
    latitude: f.center[1],
    longitude: f.center[0],
  }));
}
