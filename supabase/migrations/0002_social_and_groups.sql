-- Rootah Phase 2 cont'd: avatars, group runs
-- Run this once in the Supabase SQL Editor, after 0001_init.sql.

-- ─────────────────────────────────────────────────────────────
-- profiles.avatar_url
-- ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_url text;

-- ─────────────────────────────────────────────────────────────
-- avatars storage bucket
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar images are publicly viewable" on storage.objects;
create policy "avatar images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "users can upload their own avatar" on storage.objects;
create policy "users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can update their own avatar" on storage.objects;
create policy "users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can delete their own avatar" on storage.objects;
create policy "users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────
-- group_runs
-- ─────────────────────────────────────────────────────────────
create table if not exists public.group_runs (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists group_runs_route_id_idx on public.group_runs(route_id);
create index if not exists group_runs_scheduled_at_idx on public.group_runs(scheduled_at);

alter table public.group_runs enable row level security;

drop policy if exists "group runs are viewable by everyone" on public.group_runs;
create policy "group runs are viewable by everyone"
  on public.group_runs for select
  using (true);

drop policy if exists "users can schedule group runs" on public.group_runs;
create policy "users can schedule group runs"
  on public.group_runs for insert
  with check (host_id = auth.uid());

drop policy if exists "hosts can update their own group runs" on public.group_runs;
create policy "hosts can update their own group runs"
  on public.group_runs for update
  using (host_id = auth.uid());

drop policy if exists "hosts can cancel their own group runs" on public.group_runs;
create policy "hosts can cancel their own group runs"
  on public.group_runs for delete
  using (host_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- group_run_rsvps
-- ─────────────────────────────────────────────────────────────
create table if not exists public.group_run_rsvps (
  group_run_id uuid not null references public.group_runs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_run_id, user_id)
);

create index if not exists group_run_rsvps_group_run_id_idx on public.group_run_rsvps(group_run_id);

alter table public.group_run_rsvps enable row level security;

drop policy if exists "rsvp counts are viewable by everyone" on public.group_run_rsvps;
create policy "rsvp counts are viewable by everyone"
  on public.group_run_rsvps for select
  using (true);

drop policy if exists "users can rsvp for themselves" on public.group_run_rsvps;
create policy "users can rsvp for themselves"
  on public.group_run_rsvps for insert
  with check (user_id = auth.uid());

drop policy if exists "users can cancel their own rsvp" on public.group_run_rsvps;
create policy "users can cancel their own rsvp"
  on public.group_run_rsvps for delete
  using (user_id = auth.uid());
