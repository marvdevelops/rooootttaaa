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

/**
 * A note pinned somewhere along a route (e.g. "water stop", "turn here",
 * a race-day instruction) — a standalone entity, not tied to any Waypoint.
 * Waypoints exist only to draw/route the line; moving, adding, or deleting
 * one never touches notes, and vice versa.
 */
export interface RouteNote extends LatLng {
  id: string;
  text: string;
}

export type ActivityType = 'run' | 'trail_run' | 'hike' | 'bike' | 'walk' | 'other';

export type TrailSurface = 'paved' | 'gravel' | 'dirt' | 'rock' | 'mixed';
export type TrailDifficulty = 'easy' | 'moderate' | 'hard' | 'expert';

export interface TrailInfo {
  surface: TrailSurface | null;
  technicalDifficulty: TrailDifficulty | null;
  hasWaterCrossing: boolean;
  hasStream: boolean;
  isShaded: boolean;
  isDogFriendly: boolean;
  requiresPermit: boolean;
  conditionNote: string | null;
  conditionUpdatedAt: number | null;
}

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
  notes: RouteNote[];
  distanceKm: number;
  elevationGainM: number;
  elevationProfile: PathPoint[];
  city: string | null;
  isPublic: boolean;
  savesCount: number;
  likesCount: number;
  completionCount: number;
  reviewCount: number;
  photoCount: number;
  /** Sum of all review ratings — average = ratingSum / reviewCount. Only meaningful for display once reviewCount >= 3. */
  ratingSum: number;
  isOwnedByMe: boolean;
  isSavedByMe: boolean;
  isLikedByMe: boolean;
  /** Only set when this route came from a saved-routes/activity query. */
  savedAt?: number;
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
  /** Set when this run is tagged to a run club — null for regular events. */
  clubId: string | null;
  clubName: string | null;
  clubAvatarUrl: string | null;
  /** Set when this occurrence belongs to a recurring series — null for one-off runs. */
  seriesId: string | null;
  /** 'race' events get day-of-gated "Run This Race" tracking, branding, and a live-tracking link — everything else behaves like a normal group run. */
  category: 'training' | 'race';
  /** 'club' = visible only to members of `clubId` (and the host / people already in). 'public' = discoverable by anyone. */
  visibility: 'public' | 'club';
}

export interface RaceDetails {
  groupRunId: string;
  raceDate: string; // YYYY-MM-DD, in raceTimezone
  raceTimezone: string;
  /** Shown on the finish share card (and organizer branding row) — kept distinct from eventLogoUrl, which is the race event's own mark. */
  organizerLogoUrl: string | null;
  organizerName: string | null;
  eventBannerUrl: string | null;
  eventLogoUrl: string | null;
  brandPrimaryColor: string;
  brandAccentColor: string;
  /** Shared across every distance category of one multi-distance event (5K/10K/21K…) — the first category's own group_run_id, self-referenced. Null for a standalone, single-distance race. */
  eventGroupId: string | null;
  /** Shared display name for the event ("Milo Marathon 2026") — distinct from this category's own group_runs.title, which is just its distance label ("10K"). Falls back to the category's own title for pre-existing single-category races. */
  eventTitle: string | null;
}

/** One distance option within a multi-distance race event — for the "pick your distance" picker and the sibling-categories chip row. */
export interface RaceCategorySummary {
  groupRunId: string;
  title: string;
  routeDistanceKm: number;
  scheduledAt: number;
}

/** One multi-distance event grouped for display — the discover/browse screens show one of these per event instead of one card per distance category. */
export interface RaceEventSummary {
  eventGroupId: string;
  eventTitle: string;
  /** The soonest-scheduled category's group_run_id — where a tap lands; its own detail page shows the full distance picker. */
  primaryGroupRunId: string;
  scheduledAt: number;
  rsvpCount: number;
  categories: RaceCategorySummary[];
}

export type RsvpStatus = 'pending' | 'approved' | 'declined';

export interface GroupRunParticipant {
  userId: string;
  username: string;
  avatarUrl: string | null;
  status: RsvpStatus;
  requestedAt: number;
}

/** The current user's own RSVP on a race, including race-run state — null fields until they actually start running. */
export interface RaceRsvp {
  id: string;
  groupRunId: string;
  status: RsvpStatus;
  startedAt: number | null;
  finishedAt: number | null;
  finishTimeSeconds: number | null;
  recordedRunId: string | null;
  shareCardStoragePath: string | null;
  liveShareToken: string | null;
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
