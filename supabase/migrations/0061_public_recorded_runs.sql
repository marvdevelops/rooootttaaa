-- Recorded activities show on a user's public profile (time, pace, distance,
-- elevation) so others can see what they've been up to — Strava-style. Public
-- by default; a per-activity is_private hides one.

alter table public.recorded_runs add column is_private boolean not null default false;

-- Anyone can read a non-private recorded run (the owner keeps full access via
-- the existing "users manage their own recorded runs" policy).
create policy "recorded_runs_public_read" on public.recorded_runs
  for select using (not is_private);

create policy "run_splits_public_read" on public.run_splits
  for select using (
    exists (select 1 from public.recorded_runs r where r.id = run_id and not r.is_private)
  );
