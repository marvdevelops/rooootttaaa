import { CloudRoute } from '../types/route';

export type FlybyStyleKey = 'satellite' | 'outdoors' | 'streets';

interface FlybyStyleConfig {
  url: string;
  label: string;
  icon: string;
  routeColor: string;
  routeCasingColor: string;
  routeWidth: number;
  terrainExaggeration: number;
}

export const FLYBY_STYLES: Record<FlybyStyleKey, FlybyStyleConfig> = {
  satellite: {
    url: 'mapbox://styles/mapbox/satellite-streets-v12',
    label: 'Satellite',
    icon: '🛰',
    routeColor: '#FF3B30',
    routeCasingColor: 'rgba(0,0,0,0.4)',
    routeWidth: 5,
    terrainExaggeration: 1.6,
  },
  outdoors: {
    url: 'mapbox://styles/mapbox/outdoors-v12',
    label: 'Terrain',
    icon: '🏔',
    routeColor: '#E05252',
    routeCasingColor: 'rgba(0,0,0,0.35)',
    routeWidth: 4,
    terrainExaggeration: 1.8,
  },
  streets: {
    url: 'mapbox://styles/mapbox/streets-v12',
    label: 'Map',
    icon: '🗺',
    routeColor: '#E05252',
    routeCasingColor: 'rgba(0,0,0,0.3)',
    routeWidth: 4,
    terrainExaggeration: 1.2,
  },
};

const DENSE_URBAN_CITIES = new Set(['Makati', 'Taguig', 'Manila', 'Pasig', 'Mandaluyong', 'Quezon City', 'Cebu City']);

function isDenseUrban(city: string | null): boolean {
  return city ? DENSE_URBAN_CITIES.has(city) : false;
}

/** Pre-selects the style most likely to look good for this route — the user can still override via the style picker. */
export function defaultStyleForRoute(route: Pick<CloudRoute, 'isTrail' | 'elevationGainM' | 'city'>): FlybyStyleKey {
  if (route.isTrail) return 'satellite';
  if (route.elevationGainM > 200) return 'satellite';
  if (route.elevationGainM < 50 && isDenseUrban(route.city)) return 'streets';
  return 'satellite';
}
