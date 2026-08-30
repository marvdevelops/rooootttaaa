-- Clubs aren't just for running — a club declares which activities it's for
-- (run / trail_run / walk / hike / bike) so the Clubs list can be filtered.
-- Defaults to {run} for existing clubs.

alter table public.run_clubs
  add column if not exists activities text[] not null default '{run}';

alter table public.run_clubs
  drop constraint if exists run_clubs_activities_valid;
alter table public.run_clubs
  add constraint run_clubs_activities_valid check (
    array_length(activities, 1) between 1 and 5
    and activities <@ array['run', 'trail_run', 'walk', 'hike', 'bike']::text[]
  );

-- Overlap (&&) queries for "clubs that do <activity>".
create index if not exists run_clubs_activities_idx on public.run_clubs using gin (activities);
