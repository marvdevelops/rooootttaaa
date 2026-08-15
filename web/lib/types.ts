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

export interface PublicGroupRunParticipant {
  username: string;
  avatarUrl: string | null;
}

export interface PublicGroupRun {
  id: string;
  title: string;
  description: string;
  scheduledAt: string;
  city: string | null;
  status: 'scheduled' | 'active' | 'archived';
  hostUsername: string;
  routeId: string;
  /** All null when the underlying route isn't public — the page still renders without route details or a map. */
  routeName: string | null;
  routeDistanceKm: number | null;
  routeElevationGainM: number | null;
  routeWaypoints: Waypoint[] | null;
  routeSegments: RouteSegment[] | null;
  rsvpCount: number;
  participants: PublicGroupRunParticipant[];
}
