-- Background-recorded activities (T3 — Activity Recording). Raw GPS points
-- live only in on-device SQLite; this stores the finished, simplified track
-- plus stats and per-km splits.
create table public.recorded_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid references public.routes(id) on delete set null,
  -- Matches the app's ActivityType (src/types/route.ts), not just run/bike/walk/other.
  activity_type text not null check (activity_type in ('run', 'trail_run', 'hike', 'bike', 'walk', 'other')),
  started_at timestamptz not null,
  finished_at timestamptz not null,
  moving_time_seconds integer not null,
  elapsed_time_seconds integer not null,
  distance_meters real not null,
  elevation_gain_meters real,
  elevation_loss_meters real,
  avg_pace_seconds_per_km real,
  avg_speed_kmh real,
  route_adherence_pct real, -- null if not recorded against a planned route
  gpx_storage_path text, -- Supabase Storage path for the exported GPX file
  track_geojson jsonb, -- simplified track for map display, not raw GPS points
  created_at timestamptz not null default now()
);

create index recorded_runs_user_idx on public.recorded_runs (user_id, started_at desc);

create table public.run_splits (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.recorded_runs(id) on delete cascade,
  km_number integer not null,
  split_seconds integer not null,
  elevation_gain_meters real
);

create index run_splits_run_idx on public.run_splits (run_id, km_number);

alter table public.recorded_runs enable row level security;
create policy "users manage their own recorded runs"
  on public.recorded_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.run_splits enable row level security;
create policy "users manage splits on their own runs"
  on public.run_splits for all
  using (auth.uid() = (select user_id from public.recorded_runs where id = run_id))
  with check (auth.uid() = (select user_id from public.recorded_runs where id = run_id));
