# Rootah Backlog

Deferred feature plans — not scheduled yet, kept here so they aren't lost.

## Race Mode — HIGH PRIORITY

Full plan: `docs/race-mode-plan.md`. A race is just a group run with
`category = 'race'` (official account only, for now) — reuses the existing
join/RSVP flow and group run screens entirely, no new browse UI. Adds:
race-day-gated "Run This Race" (unlocks at midnight in the race's own
timezone), route-aware run tracking (builds on T3 Activity Recording),
auto-detected finish with confirmation, a branded finish share card (race +
Rootah branding, stats overlay, selfie), and a public unique link so
friends/family can watch a runner's live position, pace, and distance on
the course during the race. Supersedes the "Live athlete tracking" entry
below — the live spectator page is being built as
part of this instead.

## Live athlete tracking

> **Superseded by Race Mode** (see `docs/race-mode-plan.md`) — the live
> spectator page described below is being built as part of that feature
> instead, scoped to race participants rather than any run. Left here for
> the general-purpose (non-race) version, in case that's still wanted later.

Athlete starts a live-tracking session (mobile), gets a unique unguessable
share link, anyone with the link watches live position/progress/safety
status on a public web page — no login required.

**Data model (Supabase)**
- `live_sessions`: id, athlete_id, route_id (nullable), share_token (random,
  unguessable — this *is* the access control, no listing endpoint anywhere),
  status (active/paused/ended/emergency), target_distance_km, started_at,
  ended_at, expires_at, last_lat/last_lng/last_updated_at (denormalized).
- `live_location_pings`: session_id, lat, lng, recorded_at, speed, accuracy —
  breadcrumb trail.
- `live_session_events`: session_id, type (emergency/off_course/resumed/...),
  created_at, metadata — audit trail.
- Retention: auto-expire sessions ~12h; purge raw pings after ~30 days.

**Off-course detection**: reuse mobile's `nearestPointOnPath.ts` — compare
live pings to the route's segment path; flag off_course if distance exceeds
~50-75m for several consecutive pings.

**Emergency (SOS)**: long-press button (not tap, to prevent accidental
triggers) sets status=emergency, logs an event, pushes instantly to every
open viewer via Supabase Realtime (red banner + sound/vibration). Phase 2:
push notification to viewers with the tab closed, SMS to a pre-set emergency
contact (Twilio — bigger scope).

**Live transport**: Supabase Realtime channel scoped to one session id.
Mobile posts a ping every ~5-10s or ~20m moved via expo-location background
updates (same permission model as existing run recording).

**Web viewer** — `app.rootah.com/live/[token]`, public, no auth, `noindex`
(must never be crawlable/searchable). Full-bleed map, athlete name/avatar,
route line with a live-moving marker, progress vs. target distance,
pace/ETA, elapsed time, "last updated Xs ago" staleness indicator,
off-course banner, emergency banner.

**Mobile changes**: "Share live location" toggle on the run/build screen
(generates link + share sheet + QR), prominent Emergency button while
active, manual "Stop sharing" + auto-stop on completion, explicit consent
copy ("Anyone with this link can see your live location until you stop
sharing or it expires").

**Extra recommendations to fold in when built**:
- Staleness indicator for viewers (GPS drop-out shouldn't look "still fine")
- ETA to finish from current pace + remaining distance
- Post-run handoff: link auto-shows a summary card after finish instead of
  going dead — conversion moment for viewers without the app
- Tie into Group runs/Clubs: auto-notify members when a hosted run goes live
- "Stopped moving" secondary safety signal, distinct from explicit SOS

**Phased rollout**
1. MVP: schema + RLS, mobile start/stop + background pings, public web
   viewer, off-course banner, emergency flag + realtime banner, auto-expiry.
2. Push notifications to viewers (tab closed), QR sharing, club/group-run
   integration, post-run summary handoff.
3. SMS emergency contacts (Twilio), historical playback, multi-athlete
   tracking for group runs.
