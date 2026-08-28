# Rootah — App Functionality

Rootah is a route-planning and running-community app for the Philippines
(iOS & Android, closed testing), built with Expo/React Native and a
Supabase backend. This document describes what the app actually does today.

**Visual identity:** the app runs a warm "sport-premium" design system —
coral/cream/ink palette, Plus Jakarta Sans typography, pill-shaped buttons,
shadow-only elevation (no hard borders), and a snake-path logo mark. The
public web app (rootah.com) matches. The app icon has been regenerated to
match but hasn't shipped yet — icon changes require a native build, not just
an OTA update.

---

## 1. Authentication & onboarding

- **Sign up / log in** with email + password, or **Sign in with Apple** /
  **Sign in with Google** (native social auth).
- New accounts (including social sign-ins with no username yet) are routed
  through a **username setup** screen with real-time uniqueness checking
  before they can use the app.
- Users can browse the Discover map before signing up is required for
  account-gated actions (T0 "browse before signup" was deferred/skipped —
  currently signup happens at first save/interaction, not at launch).

## 2. Route builder (the core map screen)

- Tap the map to drop a **start point**, keep tapping to add stops — each
  new tap **auto-routes** to the previous point along real streets/paths
  (Mapbox Directions API, walking profile), not a straight line.
- **Drag any waypoint** to reshape the route; only the two adjacent segments
  re-route, so dragging stays fast.
- **Live distance and elevation gain** update as the route is built, backed
  by a debounced elevation fetch (Mapbox Tilequery) over the full routed
  path.
- Route line is **color-graded by climb steepness** (grade-based coloring,
  smoothed to avoid noisy segment flicker), with km markers floated above
  the line.
- **Undo** last change, and **close the loop** (auto-route back to the start
  point) with one tap.
- Map style toggle (standard / satellite-ish modes) and an optional **3D
  view**.
- A first-run **step-by-step tutorial** overlay walks new users through
  placing, dragging, and closing a route; a lightweight **"tap the map to
  start" hint** — a centered card that fades out after 10s, or dismisses
  immediately if you tap anywhere outside it — nudges everyone else without
  permanently covering the screen.
- Bottom-anchored builder controls (undo/clear/save row, locate button, map
  style toggles) sit clear of the home indicator / gesture bar instead of
  crowding the edge of the screen.
- **Save flow**: naming a route requires zero mandatory decisions — city is
  auto-detected via reverse geocoding, activity type defaults sensibly: you
  can save with just a tap. An elevation profile preview is shown before
  saving.
- **GPX export** (share sheet) and **GPX import** (drag in a file exported
  from Strava, Garmin, Komoot, or similar — the parser tolerates the format
  differences across generators).
- **Editing** an existing saved route re-opens the builder in edit mode.

## 3. Discover (home screen)

- A full-screen map-based discovery view, **never empty**: falls back
  through GPS location → last-picked city → a default Philippines view, and
  offers a **city picker** to switch regions.
- **Filters**: distance, max elevation gain, city.
- **Text search** across public routes by name.
- **"Runs near you"** strip: upcoming group runs within a real geographic
  radius (Haversine RPC, not a city-string match) of the current map
  viewport — updates live as you pan/zoom.
- **Top routes / recommended routes** surfaced based on saves, likes, and
  completions.
- FAB menu for creating a new route, importing GPX, or creating a group run
  event (with a route picker).

## 4. Route detail

- Map view of the route (waypoint pins hidden in view mode) framed to show
  the **full route** on open, not just the start point; distance /
  elevation-gain / peak-elevation stats, and a compact elevation profile
  chart.
- **Like** and **save** (bookmark) with counts.
- **"I ran this"** — one-tap completion logging, which feeds:
  - the **completions feed** (replaced the old generic activity feed),
  - **reviews & star ratings** (unlocked after logging a completion),
  - **badges** (see §9),
  - the route's **"Local Legend"** — whoever has the most completions (min.
    3) on that specific route, computed live, not a cached/cron job.
- **Route photo gallery** — upload photos to a route, view them full-screen.
- **Trail & hiking taxonomy** — surface type and technical difficulty
  fields for trail/hike routes, shown as a dedicated trail-info section.
- **"Navigate to start"** — opens Waze/Google Maps to the route's start
  point.
- **Share** — generates a public web preview link (see §11).
- **Customize this route** — fork a public route into your own editable
  copy (Pro-gated for free users, see §10).
- **Schedule a group run** on this route, and see upcoming group runs tied
  to it.
- **Flyby** entry point (see §5).

## 5. Flyby — 3D route preview & shareable card

- A cinematic 3D camera flythrough of the route on a Mapbox terrain map,
  with a runner-icon marker moving continuously along the path (not
  jumping between waypoints) at a **constant speed** end to end (the camera
  path is resampled evenly by real-world distance, not by raw point index,
  so dense/sparse stretches of the routed path don't read as pauses or
  speed-ups).
- The camera **locks to the moving marker** — fixed pitch/zoom chase cam.
  Heading (rotation) follows the route's direction of travel with a
  continuously-interpolated target and exponential easing, so turns —
  sharp or gentle — ease the camera around smoothly instead of snapping or
  stepping.
- **Map style picker** (Satellite / Terrain / Map), defaulting to the plain
  Map style; custom icons throughout (no emoji).
- No video export (the on-device video pipeline this depended on,
  `ffmpeg-kit-react-native`, was retired by its maintainer and can no
  longer be installed) — instead, after the flythrough plays, the app
  captures a **shareable static summary card** (route stats over a static
  map image of the route) that can be shared to social apps or saved to the
  camera roll. Server-side video rendering is a possible future addition,
  not yet built (cost/infra tradeoff, on hold).

## 6. My Maps

- **Created** and **Saved** tabs for a user's own routes vs. routes they've
  bookmarked from other users.

## 7. Group runs / events

- **Create an event**: pick a route, title, description, date/time, and an
  optional participant cap (1–10, or open — open caps are Pro-only, see
  §10).
- **Lifecycle**: `scheduled` → `active` → `archived`, transitioned
  automatically (Edge Function + external scheduler, since the Supabase
  free tier has no `pg_cron`).
- **RSVP** to join; the **host can approve or decline** join requests
  (private-club-style gating), and gets notified of new join requests.
- Host is **auto-RSVP'd** as an immutable "approved" attendee of their own
  event.
- **"Who's going"** attendee list, **comments** (gated to RSVP'd
  attendees/host only, once approved), **navigate to start**, **add to
  calendar** (native calendar event via `expo-calendar`), and **share to
  social** (with an OG-image-backed public page).
- **Recurring series** — a weekly/recurring event definition that generates
  individual occurrences; the "runs near you" and upcoming-runs lists
  dedupe a series down to its next occurrence so it doesn't show 4+
  near-duplicate cards.
- Archived events show a status banner and lock RSVPs/comments.

## 8. Run clubs

- **Create a club** (name, description, city, private/public), with a
  **club logo upload**.
- **Join** an open club instantly, or **request to join** a private one —
  admins/owners **approve or decline** requests and can **remove members**
  or **change roles** (owner/admin/member).
- **Club profile**: members list, a **routes collection** curated for the
  club, and an **events tab** (group runs tagged to the club).
- **My Clubs** section on Profile for clubs you actively belong to.

## 9. Badges & gamification

Automatically granted server-side (Postgres triggers), shown on profile as
a badge strip:

| Badge | Trigger |
|---|---|
| 🗺 Route Maker | First public route created |
| 🏃 First Run | First completion logged |
| 🏔 Trail Blazer | 5 distinct trail/hike routes completed |
| 💯 Century (rare) | A cycling route ≥100km completed |

Plus the live-computed **Local Legend** callout per route (see §4).

## 10. Monetization (Pro tier via RevenueCat)

Free tier is capped; a paywall screen explains and unlocks Pro:

- GPX import is Pro-only.
- Free accounts capped at **5 saved routes**.
- **Forking** ("Customize this route") a public route is Pro-only.
- Free hosts capped at **1 active group run** at a time, and **10 RSVPs**
  per event (server-enforced, not just client-side).
- Free hosts can't set an **open** (uncapped) participant limit.
- Free users capped at **1 joined event** at a time.
- Flyby access mode is server-configurable (`app_config` table: free-for-all
  / Pro-only / free-with-a-monthly-limit) — currently set to free for
  everyone; the "N per month for free users" mode is defined but not fully
  implemented (no usage-count tracking yet).

Android purchases are intentionally unconfigured for now (iOS-only via
RevenueCat) — a deliberate Phase 2 item, not a bug.

## 11. Sharing & public web presence

- A companion **Next.js web app** (deployed on Railway at rootah.com) serves
  a public, no-login route preview page at `rootah.com/routes/[id]`, and a
  public group-run event page — both used as the link target when sharing
  from the mobile app, and both carry OG images for rich social previews.
- The same app also hosts the **public marketing/landing page** at
  rootah.com — hero, about, who-it's-for, how-it-works, an app-screenshot
  carousel, and a download/contact section — restyled to match the app's
  design system, with screenshots of the current UI.
- Static map image previews (Mapbox Static Images API) back these previews
  and the Flyby summary card, so sharing doesn't require rendering
  anything server-side.

## 12. Social / profile

- **Public profile** pages (byline links from routes/comments) showing a
  user's created routes, badges, and upcoming events.
- **Own profile** has separate **Upcoming/Past events** tabs, split from a
  dedicated **Settings** screen (profile identity vs. app settings/toggles
  are intentionally separate screens).
- **Block users** and **report content** (routes/comments) for moderation.
- **Push notifications** for likes and RSVPs (Edge Function-driven), with
  a pre-permission explainer modal shown at the first RSVP/schedule action
  rather than an OS prompt on launch, deep-linking to the relevant
  screen on tap, and per-category toggles in Settings.

## 13. Not yet built (roadmap, explicitly deferred)

- Flyby **video** export (server-side rendering, e.g. Remotion/Shotstack —
  on hold pending a cost decision).
- Social-login-driven RevenueCat / Android Pro purchases.
- Full "browse before signup" flow.
- Usage-limited (N/month) flyby access tier.

---

*Stack: Expo/React Native (iOS & Android) + Supabase (Postgres, Auth,
Storage, Edge Functions) + Mapbox (maps, routing, elevation, static
images) + RevenueCat (subscriptions) + a Next.js web app for public
sharing pages. Distributed via EAS Build/Update (OTA for JS-only changes,
full builds for native changes).*
