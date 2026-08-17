import { CloudRoute } from '../types/route';

export type FlybyStyleKey = 'satellite' | 'outdoors' | 'streets';

interface FlybyStyleConfig {
  url: string;
  label: string;
  routeColor: string;
  routeCasingColor: string;
  routeWidth: number;
  terrainExaggeration: number;
}

export const FLYBY_STYLES: Record<FlybyStyleKey, FlybyStyleConfig> = {
  satellite: {
    url: 'mapbox://styles/mapbox/satellite-streets-v12',
    label: 'Satellite',
    routeColor: '#FF3B30',
    routeCasingColor: 'rgba(0,0,0,0.4)',
    routeWidth: 5,
    terrainExaggeration: 1.6,
  },
  outdoors: {
    url: 'mapbox://styles/mapbox/outdoors-v12',
    label: 'Terrain',
    routeColor: '#E05252',
    routeCasingColor: 'rgba(0,0,0,0.35)',
    routeWidth: 4,
    terrainExaggeration: 1.8,
  },
  streets: {
    url: 'mapbox://styles/mapbox/streets-v12',
    label: 'Map',
    routeColor: '#E05252',
    routeCasingColor: 'rgba(0,0,0,0.3)',
    routeWidth: 4,
    terrainExaggeration: 1.2,
  },
};

/** Pre-selects the style shown when the flyby screen opens — the user can still override via the style picker. Defaults to the plain map style for everyone. */
export function defaultStyleForRoute(_route: Pick<CloudRoute, 'isTrail' | 'elevationGainM' | 'city'>): FlybyStyleKey {
  return 'streets';
}
