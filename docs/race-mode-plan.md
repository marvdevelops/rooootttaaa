# Race Mode — Plan (v2: races are just group runs)

Rootah-curated races: join like any group run, run it on race day with
route-aware tracking, get a branded finish share card, and let friends/family
watch your position live on the course.

**Why this matters:** This is the first feature that gives Rootah an actual
event calendar and a reason to open the app on a specific day, not just
whenever you feel like planning a route. It also finally gives the
already-planned live-tracking feature (see the now-superseded "Live athlete
tracking" entry in `BACKLOG.md`) a concrete reason to exist — race day is
exactly when someone's family wants to watch a dot move on a map.

**v2 correction (this version):** A race is not a new content type — it's a
`group_run` with `category = 'race'` instead of `'training'`. Everything
group runs already have (RSVP/join, free-tier join caps, host model, list +
detail screens on web and mobile, notifications on join requests) is reused
as-is. The only new work is: the category itself, day-of gating for a
"Run This Race" button, tying a race run to activity recording (T3), finish
detection, the branded share card, and live spectator broadcast. This
replaces the standalone `races`/`race_registrations` schema from the v1 plan
with extensions to the existing `group_runs`/`group_run_rsvps` tables —
significantly less new surface area, and web/mobile browsing comes for free.

**Builds directly on T3 (Activity Recording).** A race run *is* a recording,
started against the group run's route, with route-aware mode
(deviation/remaining-distance) already on by default.

---

## Prerequisites

- T3 Activity Recording must be live (`RecordingScreen`, route-aware mode,
  `recorded_runs`) — this plan assumes it's shipped.
- New native deps for the share card: `expo-camera` (selfie capture),
  `react-native-view-shot` (composite the branded card + selfie into one
  image). Both require a fresh native build, same as T3's deps.
- Realtime: this is the first feature using Supabase Realtime in the app —
  enable it on `group_run_rsvps`
  (`alter publication supabase_realtime add table group_run_rsvps`).

---

## Data model

```sql
-- Races are group_runs with category='race'. Existing columns (route_id,
-- host_id, title, description, scheduled_at, status, city,
-- max_participants, approved_count, club_id) are reused unchanged.
alter table public.group_runs
  add column category text not null default 'training'
    check (category in ('training', 'race'));

-- Hardcoded to the official Rootah account for now, same convention as the
-- bulk GPX importer (scripts/bulkImportGpx.ts) and the earlier v1 plan —
-- swap for a proper role check once race creation isn't Rootah-only.
-- Replaces the existing "users can schedule group runs" insert policy.
drop policy if exists "users can schedule group runs" on public.group_runs;
create policy "users can schedule group runs" on public.group_runs
  for insert
  with check (
    category = 'training'
    or host_id = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f'
  );

-- Race-only branding/scheduling, kept off group_runs itself so training
-- events don't carry unused columns. One row per race group_run.
create table public.race_details (
  group_run_id uuid primary key references public.group_runs(id) on delete cascade,
  -- The calendar day the race unlocks on, in the race's own local timezone
  -- (not the scheduled_at instant, and not the device's timezone) — see
  -- "Run This Race gating" below.
  race_date date not null,
  race_timezone text not null default 'Asia/Manila',
  organizer_logo_url text,
  brand_primary_color text not null default '#E84B2A',
  brand_accent_color text not null default '#1A1614'
);

alter table public.race_details enable row level security;
create policy "race details are publicly readable" on public.race_details for select using (true);
create policy "only the official account sets race details" on public.race_details
  for insert with check (
    exists (select 1 from public.group_runs g where g.id = group_run_id and g.host_id = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f')
  );

-- Race-run state, added to the *existing* RSVP row — a race participant's
-- join request is a group_run_rsvps row like any group run; these columns
-- are just null until they actually start running.
alter table public.group_run_rsvps
  add column started_at timestamptz,
  add column finished_at timestamptz,
  add column finish_time_seconds integer,
  add column recorded_run_id uuid references public.recorded_runs(id),
  add column share_card_storage_path text,
  -- Unique, unguessable — this *is* the access control for the public
  -- /live/[token] page, same pattern as the original live-tracking plan.
  add column live_share_token text unique,
  -- Denormalized live position, overwritten in place during the run —
  -- spectators subscribe to UPDATE events on this row via Realtime.
  add column last_lat double precision,
  add column last_lng double precision,
  add column last_distance_meters real,
  add column last_pace_seconds_per_km real,
  add column last_updated_at timestamptz;
```

**Public live-position lookup by token — do this via an RPC, not raw RLS.**
A `select ... using (live_share_token is not null)` policy would let anyone
enumerate *every* live racer's position with one unfiltered query, not just
the one a viewer was given a link to. Instead, add a `security definer`
function:

```sql
create function get_race_live_position(token text)
returns table (
  race_title text, athlete_username text, athlete_avatar_url text,
  status text, last_lat double precision, last_lng double precision,
  last_distance_meters real, last_pace_seconds_per_km real,
  last_updated_at timestamptz, started_at timestamptz, finish_time_seconds integer
)
language sql security definer as $$
  select g.title, p.username, p.avatar_url, rsvp.status, rsvp.last_lat, rsvp.last_lng,
         rsvp.last_distance_meters, rsvp.last_pace_seconds_per_km, rsvp.last_updated_at,
         rsvp.started_at, rsvp.finish_time_seconds
  from group_run_rsvps rsvp
  join group_runs g on g.id = rsvp.group_run_id
  join profiles p on p.id = rsvp.user_id
  where rsvp.live_share_token = token;
$$;
grant execute on function get_race_live_position(text) to anon;
```

The public web page calls this RPC (never a direct table select), and
subscribes to Realtime by filtering the *specific row id* it got back from
the RPC's first call — not by broadcasting the token itself.

---

## "Run This Race" gating (12 midnight)

Shown only on group runs where `category = 'race'` **and** the user's own
`group_run_rsvps.status = 'approved'` (i.e. already joined — same approval
flow every group run already has). The button appears once
`race_details.race_date` matches "today" **in `race_details.race_timezone`**,
not the device's local timezone — a race in Manila should unlock at midnight
Manila time for every joined runner regardless of where their phone thinks it
is. Compute this the same way Manila-pinned server rendering already does
elsewhere in the app, evaluated client-side on a timer that re-checks every
minute while the run detail screen is open (so someone who opened the app at
11:58pm sees the button appear without backing out and back in). Stays
visible through 11:59pm race-timezone — no separate cutoff for v1; a
late-finish is still a completed run.

Training-category group runs are untouched — no gating, no button, exactly
today's behavior.

---

## Race-day flow (mobile)

1. **Browsing and joining** — existing `GroupRunsScreen` / group run detail
   screen, unchanged. A race just shows a "RACE" badge (from `category`) and,
   once joined and on `race_date`, the gated "Run This Race" button replaces
   the normal RSVP button.
2. **Tapping "Run This Race"** launches the existing `RecordingScreen` (T3),
   pre-loaded with the group run's `routeId` + `plannedSegments` (route-aware
   mode is automatically active), plus the user's own `group_run_rsvps.id`.
   On start, that RSVP row's `started_at` is set.
3. **During the run**, the background location task (already writing to
   SQLite every ~5s per T3) additionally throttle-writes to that
   `group_run_rsvps` row (every ~20-30s, not every ping) with
   `last_lat/last_lng/last_distance_meters/last_pace_seconds_per_km` — this
   is the live-tracking broadcast. Same 30s cadence T3's route-ahead panel
   already uses, not hammering the DB on every GPS point.
4. **Finish detection** — reuses T3's route-progress index
   (`routeProgress.ts`). When the runner's projected position is within
   ~30m of the route's final point **and** `traveledMeters` is past ~90% of
   `totalMeters` (guards against a false trigger from briefly looping near
   the start), show a **confirmation** prompt — "Looks like you've
   finished! End your race?" — not a silent auto-stop, since GPS noise near
   a finish chute is common. Confirming calls the same `finishRecording` T3
   already has, sets the RSVP row's `finished_at`, `finish_time_seconds`,
   and links `recorded_run_id` to the upload result.
5. **Race finish screen** (`RaceFinishScreen`, replaces the generic
   `RecordingSummaryScreen` for race runs) — finish time, pace, distance,
   splits (all already computed by T3's `summarizeSession`), then a
   **"Create share card"** button.

---

## Share card

New screen (`RaceShareCardScreen`): renders a fixed-layout card — race
branding (`race_details.organizer_logo_url`, `brand_primary_color`), Rootah
logo, and the finish stats (time, pace, distance) overlaid — with a
selfie-shaped cutout. Tapping the cutout opens `expo-camera` for a front
selfie; the captured photo drops into that region of the layout.
`react-native-view-shot` captures the composited `View` as a single PNG,
shared through the same native share sheet pattern already used elsewhere.
Save the rendered card to `group_run_rsvps.share_card_storage_path`
(Supabase Storage) so it can be re-opened later without re-compositing.

---

## Public live-tracking page (web)

`app.rootah.com/live/[token]` — full-bleed map with the race route line, a
live marker at the last broadcast position, distance covered / pace / "last
updated Xs ago" staleness indicator, and a **post-finish handoff** — once
`status = 'finished'`, the page swaps to a finish summary card instead of
going dead, doubling as a soft download-the-app conversion moment for anyone
watching who doesn't have Rootah yet. `noindex`, no auth, backed by the
`get_race_live_position` RPC above (never a raw table query).

---

## File structure

```
src/
  screens/
    RaceFinishScreen.tsx
    RaceShareCardScreen.tsx
  utils/
    raceLiveBroadcast.ts    # throttled position push, called from locationTask.ts
    raceFinishDetection.ts  # wraps routeProgress.ts with the 90%+30m rule
  components/
    RaceBadge.tsx            # "RACE" pill on group run cards where category='race'
    RunThisRaceButton.tsx    # day-of gated button, replaces RSVP button when applicable
    ShareCardCanvas.tsx      # the composable branded layout, used by RaceShareCardScreen

webapp/
  app/live/[token]/
    page.tsx                 # public spectator page — generateMetadata + client map
    LiveMapClient.tsx

supabase/migrations/
  00XX_race_mode.sql          # category column, race_details table, rsvp columns, RPC
```

No new browse/list/detail screens needed on either platform — races show up
in the existing group runs list and detail screens, just with the badge and
(once joined, on race day) the special button.

---

## Build order

1. **Schema** — `group_runs.category`, `race_details`, `group_run_rsvps`
   race-tracking columns, RLS updates, the `get_race_live_position` RPC
2. **Race creation** — a one-off script (same pattern as
   `scripts/bulkImportGpx.ts`) since only the official account creates races
   for now; no admin UI yet
3. **Race badge + day-of gating** on the existing group run screens
   (web + mobile) — no new browse UI needed
4. **Race run** — wire `RecordingScreen` to accept a `groupRunRsvpId`,
   throttled live-position writes from the location task
5. **Finish detection + `RaceFinishScreen`**
6. **Live spectator page** (web) — ships once step 4 is writing real
   position data to test against
7. **Share card** — last, since it's the most new native surface area
   (camera + view compositing) and least likely to block anything else

---

## Open decisions (need your call before/while building)

1. **Race creation UI** — a one-off script is enough to start (matches how
   GPX bulk-import works today); fine to defer a real admin form.
2. **Live position write frequency vs. battery/data cost** — 20-30s is a
   starting guess; may need tuning once real devices are tested.
3. **Share-card selfie is required or optional?** — spec says "then user
   can take a selfie to complete the share card," read here as required
   before sharing; confirm if a skip-selfie path should exist.
4. **Does the free-tier "one event at a time" join cap apply to races?** —
   it's already enforced on `group_run_rsvps` inserts for all group runs;
   worth confirming that's the intended behavior for races too, or whether
   races should bypass it.
