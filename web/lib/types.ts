export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface PathPoint extends LatLng {
  elevation?: number;
}

export interface Waypoint extends LatLng {
  id: string;
}

export interface RouteSegment {
  fromId: string;
  toId: string;
  path: PathPoint[];
  distanceMeters: number;
}

export type ActivityType = 'run' | 'bike' | 'walk' | 'other';

export interface PublicRoute {
  id: string;
  name: string;
  description: string;
  activityType: ActivityType;
  ownerUsername: string;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distanceKm: number;
  elevationGainM: number;
  elevationProfile: PathPoint[];
  savesCount: number;
  likesCount: number;
  createdAt: string;
}
