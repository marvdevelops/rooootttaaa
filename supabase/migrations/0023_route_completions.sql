-- Rootah T4: route completions ("I ran this" one-tap logging).
-- Adapted from claude-tasks/T4-route-completions.md: users -> profiles,
-- routes(id) already exists. No pg_cron on the free tier (see 0011/0018) —
-- the weekly reconciliation function is defined but must be scheduled
-- externally (cron-job.org hitting a small Edge Function), same pattern as
-- the group-run-lifecycle ticker.

create table if not exists public.route_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  group_run_id uuid references public.group_runs(id) on delete set null,
  completed_at timestamptz not null default now(),
  duration_seconds integer,
  notes text check (char_length(notes) <= 150),
  source text not null default 'manual'
    check (source in ('manual', 'recording', 'group_run', 'notification')),
  created_at timestamptz not null default now()
);

-- One completion per route per user per calendar day. `completed_at::date`
-- isn't IMMUTABLE (depends on session timezone) so Postgres rejects it in an
-- index expression — cast through a fixed UTC offset instead, which is.
create unique index if not exists route_completions_daily_unique
  on public.route_completions (user_id, route_id, ((completed_at at time zone 'utc')::date));

create index if not exists route_completions_route_idx on public.route_completions(route_id, completed_at desc);
create index if not exists route_completions_user_idx  on public.route_completions(user_id, completed_at desc);

alter table public.routes
  add column if not exists completion_count integer not null default 0;

create or replace function public.update_route_completion_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.routes set completion_count = completion_count + 1 where id = new.route_id;
  elsif TG_OP = 'DELETE' then
    update public.routes set completion_count = greatest(completion_count - 1, 0) where id = old.route_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_completion_change on public.route_completions;
create trigger on_completion_change
  after insert or delete on public.route_completions
  for each row execute function public.update_route_completion_count();

-- Reconciliation — call this from a scheduled Edge Function (see
-- supabase/functions/reconcile-counters), same free-tier pattern as
-- group-run-lifecycle. Not wired to pg_cron here.
create or replace function public.reconcile_completion_counters()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.routes r
  set completion_count = coalesce((
    select count(*) from public.route_completions where route_id = r.id
  ), 0);
end;
$$;

alter table public.route_completions enable row level security;

drop policy if exists "completions readable by all" on public.route_completions;
create policy "completions readable by all"
  on public.route_completions for select using (true);

drop policy if exists "completions insert own" on public.route_completions;
create policy "completions insert own"
  on public.route_completions for insert with check (auth.uid() = user_id);

drop policy if exists "completions update own" on public.route_completions;
create policy "completions update own"
  on public.route_completions for update using (auth.uid() = user_id);

drop policy if exists "completions delete own" on public.route_completions;
create policy "completions delete own"
  on public.route_completions for delete using (auth.uid() = user_id);
