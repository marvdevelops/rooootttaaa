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

export type ActivityType = 'run' | 'bike' | 'walk' | 'other';

export interface CloudRoute {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerAvatarUrl: string | null;
  name: string;
  description: string;
  activityType: ActivityType;
  createdAt: number;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  distanceKm: number;
  elevationGainM: number;
  elevationProfile: PathPoint[];
  city: string | null;
  isPublic: boolean;
  savesCount: number;
  likesCount: number;
  isOwnedByMe: boolean;
  isSavedByMe: boolean;
  isLikedByMe: boolean;
  /** Only set when this route came from a saved-routes/activity query. */
  savedAt?: number;
}

export type GroupRunStatus = 'scheduled' | 'active' | 'archived';

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
  /** Host-chosen RSVP cap — null means open to all (paid hosts only; free hosts are still capped at 10 server-side regardless). */
  maxParticipants: number | null;
  /** Approved attendee count only — pending requests don't count until the host approves them. */
  rsvpCount: number;
  isHostedByMe: boolean;
  /** True only once the host has approved the current user's request. */
  isRsvpedByMe: boolean;
  /** The current user's own request status, or null if they've never requested to join. */
  myRsvpStatus: RsvpStatus | null;
  /** Only set when this run came from a profile events query (created + joined merged into one list). */
  myRole?: 'host' | 'participant';
  /** Copied from the route at creation time — null for runs created before 0015_runs_near_you_radius.sql. */
  startLat: number | null;
  startLng: number | null;
}

export type RsvpStatus = 'pending' | 'approved' | 'declined';

export interface GroupRunParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: RsvpStatus;
  requestedAt: number;
}

export interface GroupRunComment {
  id: string;
  groupRunId: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  parentCommentId: string | null;
  /** 0 = top-level, 1 = reply, 2 = reply-to-reply (max depth). */
  depth: number;
  body: string;
  createdAt: number;
  isOwnedByMe: boolean;
  replies: GroupRunComment[];
}
