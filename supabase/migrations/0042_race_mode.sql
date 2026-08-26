-- Race Mode: a race is a group_run with category='race' — reuses the
-- existing join/RSVP flow, host model, and list/detail screens entirely.
-- See docs/race-mode-plan.md.

alter table public.group_runs
  add column category text not null default 'training'
    check (category in ('training', 'race'));

-- Races are Rootah-official-only for now (same hardcoded-account convention
-- as scripts/bulkImportGpx.ts) — training events keep working exactly as
-- before for any host.
drop policy if exists "users can schedule group runs" on public.group_runs;
create policy "users can schedule group runs" on public.group_runs
  for insert
  with check (
    host_id = auth.uid()
    and (category = 'training' or host_id = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f')
  );

-- Race-only branding/scheduling, kept off group_runs so training events
-- don't carry unused columns. One row per race group_run.
create table public.race_details (
  group_run_id uuid primary key references public.group_runs(id) on delete cascade,
  -- The calendar day "Run This Race" unlocks on, in race_timezone — not
  -- derived from scheduled_at's instant, and not the device's timezone.
  race_date date not null,
  race_timezone text not null default 'Asia/Manila',
  organizer_logo_url text,
  brand_primary_color text not null default '#E84B2A',
  brand_accent_color text not null default '#1A1614'
);

alter table public.race_details enable row level security;
create policy "race details are publicly readable" on public.race_details
  for select using (true);
create policy "only the official account sets race details" on public.race_details
  for insert with check (
    exists (
      select 1 from public.group_runs g
      where g.id = group_run_id and g.host_id = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f'
    )
  );

-- Race-run state, added to the RSVP row itself — a participant's join
-- request already is a group_run_rsvps row; these stay null until they
-- actually start running.
alter table public.group_run_rsvps
  add column started_at timestamptz,
  add column finished_at timestamptz,
  add column finish_time_seconds integer,
  add column recorded_run_id uuid references public.recorded_runs(id),
  add column share_card_storage_path text,
  -- Unique, unguessable — this *is* the access control for the public
  -- /live/[token] page.
  add column live_share_token text unique,
  -- Denormalized live position, overwritten in place during the run —
  -- spectators subscribe to UPDATE events on this row via Realtime.
  add column last_lat double precision,
  add column last_lng double precision,
  add column last_distance_meters real,
  add column last_pace_seconds_per_km real,
  add column last_updated_at timestamptz;

-- Public live-position lookup by token — an RPC, not a raw RLS select
-- policy, so a viewer can only ever fetch the one row their link points at
-- rather than being able to enumerate every live racer's position with an
-- unfiltered query.
create function public.get_race_live_position(token text)
returns table (
  race_title text,
  athlete_username text,
  athlete_avatar_url text,
  status text,
  last_lat double precision,
  last_lng double precision,
  last_distance_meters real,
  last_pace_seconds_per_km real,
  last_updated_at timestamptz,
  started_at timestamptz,
  finish_time_seconds integer
)
language sql security definer as $$
  select g.title, p.username, p.avatar_url, rsvp.status, rsvp.last_lat, rsvp.last_lng,
         rsvp.last_distance_meters, rsvp.last_pace_seconds_per_km, rsvp.last_updated_at,
         rsvp.started_at, rsvp.finish_time_seconds
  from public.group_run_rsvps rsvp
  join public.group_runs g on g.id = rsvp.group_run_id
  join public.profiles p on p.id = rsvp.user_id
  where rsvp.live_share_token = token;
$$;
grant execute on function public.get_race_live_position(text) to anon, authenticated;
