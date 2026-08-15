-- Rootah T4: recurring group run events. Adapted from
-- claude-tasks/T4-recurring-events.md: users -> profiles, event_date ->
-- scheduled_at (group_runs' actual column). No pg_cron on the free tier —
-- the occurrence generator is invoked directly right after series creation
-- (covers "first occurrence exists immediately") and must additionally be
-- scheduled externally (cron-job.org hitting the Edge Function daily), same
-- pattern as group-run-lifecycle and reconcile-counters.

create table if not exists public.recurring_series (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  club_id uuid references public.run_clubs(id) on delete set null,
  title text not null,
  description text,
  start_time time not null,
  timezone text not null default 'Asia/Manila',
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  day_of_week integer check (day_of_week between 0 and 6),
  day_of_month integer check (day_of_month between 1 and 31),
  series_start_date date not null,
  series_end_date date,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.series_subscriptions (
  series_id uuid not null references public.recurring_series(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  auto_rsvp boolean not null default true,
  subscribed_at timestamptz default now(),
  primary key (series_id, user_id)
);

create index if not exists series_subscriptions_series_idx on public.series_subscriptions(series_id);

alter table public.group_runs
  add column if not exists series_id uuid references public.recurring_series(id) on delete set null,
  add column if not exists occurrence_date date;

create unique index if not exists group_runs_series_occurrence_unique
  on public.group_runs (series_id, occurrence_date)
  where series_id is not null;

alter table public.group_runs drop constraint if exists group_runs_status_check;
alter table public.group_runs add constraint group_runs_status_check
  check (status in ('scheduled', 'active', 'archived', 'cancelled'));

alter table public.recurring_series enable row level security;
alter table public.series_subscriptions enable row level security;

drop policy if exists "series readable by all" on public.recurring_series;
create policy "series readable by all"
  on public.recurring_series for select using (true);

drop policy if exists "series insertable by host" on public.recurring_series;
create policy "series insertable by host"
  on public.recurring_series for insert with check (auth.uid() = host_id);

drop policy if exists "series updatable by host" on public.recurring_series;
create policy "series updatable by host"
  on public.recurring_series for update using (auth.uid() = host_id);

drop policy if exists "subscriptions readable by all" on public.series_subscriptions;
create policy "subscriptions readable by all"
  on public.series_subscriptions for select using (true);

drop policy if exists "subscriptions insertable by self" on public.series_subscriptions;
create policy "subscriptions insertable by self"
  on public.series_subscriptions for insert with check (auth.uid() = user_id);

drop policy if exists "subscriptions deletable by self" on public.series_subscriptions;
create policy "subscriptions deletable by self"
  on public.series_subscriptions for delete using (auth.uid() = user_id);
