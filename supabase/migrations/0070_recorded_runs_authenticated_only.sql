-- SECURITY: 0061/0062 opened non-private recorded runs (incl. track_geojson,
-- which contains precise start/finish coordinates ~ a user's home) and their
-- splits/photos to the `anon` role — i.e. anyone holding the shipped anon key
-- could mass-scrape every public activity track without an account.
--
-- The mobile app is always authenticated and never reads another user's
-- track_geojson (the public profile shows stats only), and no web surface
-- reads recorded_runs at all. So restrict these public reads to `authenticated`
-- — an attacker now needs a real, bannable account, not just the bundle key.
--
-- Follow-up (not in this migration): a start/finish privacy zone that trims
-- the first/last ~200 m from track_geojson on non-owner reads.

drop policy if exists "recorded_runs_public_read" on public.recorded_runs;
create policy "recorded_runs_public_read" on public.recorded_runs
  for select to authenticated
  using (not is_private);

drop policy if exists "run_splits_public_read" on public.run_splits;
create policy "run_splits_public_read" on public.run_splits
  for select to authenticated
  using (
    exists (select 1 from public.recorded_runs r where r.id = run_id and not r.is_private)
  );

drop policy if exists "recorded_run_photos_read" on public.recorded_run_photos;
create policy "recorded_run_photos_read" on public.recorded_run_photos
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.recorded_runs r where r.id = run_id and not r.is_private)
  );
