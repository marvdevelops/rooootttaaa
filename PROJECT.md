# Running Route Builder — MVP

React Native mobile app. User builds a running route by placing points on a
map; the app auto-connects them along real streets/paths (not straight
lines), and the user can drag any point to reshape the route. Distance and
elevation gain update live as the route changes. No backend, no auth, no
saving — everything is local/in-memory for this phase.

## Goal

A single map screen where a user can:
1. Tap the map to set a start point
2. Tap additional points — the app automatically draws the shortest path
   (road/path-following, not a straight line) between each consecutive pair
3. Drag any placed point to a new location — the route re-routes around it
   live
4. See running distance and elevation gain update as the route is built or
   adjusted
5. Export the final route as a `.gpx` file and share it via the OS share
   sheet

## Explicitly out of scope for MVP

- No backend / database (Supabase comes later)
- No auth / user accounts
- No saving routes for later / route history
- No sharing routes between users, no forking/copying
- No offline maps

## Key design decision: routing engine

Auto-connecting points along real paths (not straight lines) requires a
routing API, not just Haversine math. Using **Mapbox** for both routing and
elevation — one account, one API key, one usage dashboard:

- **Mapbox Directions API**, walking profile, for routing between waypoints.
  Free tier: 100,000 requests/month. Reliable enough for real users, unlike
  free public demo routing servers.
- **Mapbox Tilequery API** for elevation lookups on the routed path.
- Call the routing API per-segment (between each consecutive pair of
  waypoints), not for the whole route at once — this keeps re-routing after
  a drag fast, since only the two affected segments need to be recalculated.
- Requires signing up at mapbox.com for a free API key before development
  starts.
- **Setup:** store the Mapbox token in a `.env` file (gitignored), loaded via
  `react-native-config` (bare RN) or Expo's `extra`/`app.config.js` (Expo) —
  never hardcode the token directly in source files. Also apply URL/bundle
  restrictions to the token in the Mapbox dashboard.

## Tech stack

- **React Native** (Expo preferred for faster setup)
- **react-native-maps** for the map, waypoint markers (draggable), and
  polyline rendering (Mapbox is used for routing/elevation data only, not
  as the map renderer, to keep map setup simple)
- Routing: **Mapbox Directions API**, called per-segment
- Elevation: **Mapbox Tilequery API**, called on the full set of routed
  path points (not just waypoints) for an accurate gain/loss
- **react-native-fs** to write the GPX file
- **react-native-share** to open the OS share sheet

## Core features

### 1. Placing waypoints
- Tap map → first tap sets start marker
- Each subsequent tap adds a waypoint
- After each new waypoint, call the routing API for the segment between the
  previous waypoint and the new one; append the returned path coordinates to
  the route polyline

### 2. Dragging to adjust
- Waypoint markers are draggable (`<Marker draggable>`)
- On drag end, re-run routing for the (up to) two segments adjacent to that
  waypoint and replace just that portion of the polyline
- Keep the full route as: ordered list of waypoints, each with its
  associated routed-path-segment (array of {lat, lng}) to the next waypoint

### 3. Live distance & elevation
- Distance: sum Haversine distance across all points in the full routed
  path (not just waypoints, since the road path is longer than a straight
  line between waypoints)
- Elevation: debounce elevation re-fetch after route changes (don't call on
  every single drag frame — only on drag end / waypoint add) since it's a
  network call; batch-request elevation for the full path's points (or a
  downsampled subset if the path is long, to stay within API batch limits)
- Display distance (km) and elevation gain (m) in a stats bar, updating as
  the route changes

### 4. GPX export
- Build GPX 1.1 XML from the full routed path (all path points, with
  elevation), not just the waypoints
- Write with `react-native-fs`, share with `react-native-share`

## Suggested file structure

```
/src
  /screens
    MapScreen.tsx
  /components
    RouteMap.tsx              // map, markers, polyline
    RouteStatsBar.tsx         // distance / elevation display
  /utils
    routing.ts                 // Mapbox Directions API call per segment
    distance.ts                 // haversine + total distance over full path
    elevation.ts                 // Open-Elevation API call + gain/loss calc
    gpx.ts                        // GPX XML builder
  /types
    route.ts   // Waypoint = {lat,lng}; RouteSegment = {from,to,path:[{lat,lng,ele?}]}
App.tsx
```

## Build order

1. Scaffold RN project, get a map rendering
2. Tap to place waypoints, draw straight-line polyline between them
   (placeholder, no routing yet) — confirms basic state/rendering works
3. Wire in Mapbox Directions routing per segment — replace straight lines
   with real routed paths
4. Draggable waypoints + re-routing of adjacent segments on drag end
5. Live distance calculation over the full routed path
6. Elevation fetch (debounced) + gain display
7. GPX export (with elevation) + share sheet
8. Polish: undo last waypoint, clear route, loading/error states for
   routing and elevation API calls

## Notes for later phases (not now)

- Supabase for auth, route storage, and sharing/forking
- Deep links for shared route URLs
- Offline map / routing support
