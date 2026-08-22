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
  elevationProfile: PathPoint[];
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
  elevationProfile: PathPoint[];
  city: string | null;
}

export interface PublicProfile {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: number;
  tier: 'free' | 'paid';
}

export interface RouteCompletion {
  id: string;
  userId: string;
  routeId: string;
  groupRunId: string | null;
  completedAt: number;
  durationSeconds: number | null;
  notes: string | null;
  source: 'manual' | 'recording' | 'group_run' | 'notification';
}

export interface RouteCompletionActivityItem extends RouteCompletion {
  routeName: string;
  routeDistanceKm: number;
  routeCity: string | null;
  groupRunTitle: string | null;
}

export interface CompletionParticipant {
  id: string;
  username: string;
  avatarUrl: string | null;
  completedAt: number;
  durationSeconds: number | null;
}

export interface RouteReview {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  routeId: string;
  completionId: string | null;
  groupRunId: string | null;
  groupRunTitle: string | null;
  rating: number;
  body: string | null;
  source: 'solo' | 'group_run';
  createdAt: number;
  isOwnedByMe: boolean;
}

export type GroupRunStatus = 'scheduled' | 'active' | 'archived' | 'cancelled';
export type RsvpStatus = 'pending' | 'approved' | 'declined';

export interface GroupRun {
  id: string;
  routeId: string;
  routeName: string;
  routeDistanceKm: number;
  hostId: string;
  hostUsername: string;
  title: string;
  description: string;
  scheduledAt: number;
  createdAt: number;
  status: GroupRunStatus;
  city: string | null;
  maxParticipants: number | null;
  rsvpCount: number;
  isHostedByMe: boolean;
  isRsvpedByMe: boolean;
  myRsvpStatus: RsvpStatus | null;
  clubId: string | null;
  clubName: string | null;
  clubAvatarUrl: string | null;
  seriesId: string | null;
}

export interface CreateGroupRunInput {
  routeId: string;
  title: string;
  description: string;
  scheduledAt: Date;
  maxParticipants: number | null;
  clubId?: string | null;
}

export type ClubRole = 'member' | 'admin' | 'owner';
export type ClubMembershipStatus = 'active' | 'pending' | 'removed';

export interface RunClub {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  isPrivate: boolean;
  memberCount: number;
  createdBy: string;
  createdAt: number;
  myRole: ClubRole | null;
  myStatus: ClubMembershipStatus | null;
}

export interface CreateClubInput {
  name: string;
  description: string;
  city: string;
  isPrivate: boolean;
}
