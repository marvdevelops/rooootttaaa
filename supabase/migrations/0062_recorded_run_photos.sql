-- In-run photos: a runner can snap a picture anywhere during an activity.
-- Captured to local SQLite while recording (no run row exists yet), then
-- uploaded and linked to the recorded_runs row once the run is saved.
-- Reuses the existing `route-photos` storage bucket (path {runId}/{userId}/…).

create table public.recorded_run_photos (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.recorded_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  lat double precision,
  lng double precision,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index recorded_run_photos_run_idx on public.recorded_run_photos(run_id, captured_at);

alter table public.recorded_run_photos enable row level security;

-- Visible to the owner always, and to anyone when the parent run isn't private
-- (mirrors 0061's recorded_runs_public_read).
create policy "recorded_run_photos_read" on public.recorded_run_photos
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.recorded_runs r where r.id = run_id and not r.is_private)
  );

create policy "recorded_run_photos_insert" on public.recorded_run_photos
  for insert with check (user_id = auth.uid());

create policy "recorded_run_photos_delete" on public.recorded_run_photos
  for delete using (user_id = auth.uid());
