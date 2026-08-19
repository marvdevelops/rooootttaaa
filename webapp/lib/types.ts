// Mirrors src/types/route.ts on mobile — a small subset, just what Discover needs.

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface PathPoint extends LatLng {
  elevation?: number;
}

export interface Waypoint extends LatLng {
  id: string;
  note?: string;
}

export interface RouteSegment {
  fromId: string;
  toId: string;
  path: PathPoint[];
  distanceMeters: number;
}

export type ActivityType = 'run' | 'trail_run' | 'hike' | 'bike' | 'walk' | 'other';

export interface CloudRoute {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerAvatarUrl: string | null;
  name: string;
  description: string;
  activityType: ActivityType;
  isTrail: boolean;
  createdAt: number;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distanceKm: number;
  elevationGainM: number;
  city: string | null;
  savesCount: number;
  likesCount: number;
  completionCount: number;
  isOwnedByMe: boolean;
  isSavedByMe: boolean;
  isLikedByMe: boolean;
}

export interface CreateRouteInput {
  name: string;
  description: string;
  activityType: ActivityType;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distanceKm: number;
  elevationGainM: number;
  city: string | null;
}
