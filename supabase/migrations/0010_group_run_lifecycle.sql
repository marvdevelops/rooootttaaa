-- Rootah: group run lifecycle (scheduled -> active -> archived), city tracking
-- for "near you" discovery. Run this once in the Supabase SQL Editor, after
-- 0009_rsvp_cap.sql. The scheduled pg_cron jobs that drive the lifecycle
-- transitions live in 0011_group_run_cron.sql — run that one too (it
-- requires the pg_cron extension, which needs Supabase Pro).
--
-- Adapted to Rootah's actual schema: profiles (not users), routes.owner_id
-- (not creator_id), group_run_rsvps.group_run_id (not run_id).

-- ─────────────────────────────────────────────────────────────
-- group_runs: lifecycle + city
-- ─────────────────────────────────────────────────────────────
alter table public.group_runs
  add column if not exists status text not null default 'scheduled'
    check (status in ('scheduled', 'active', 'archived')),
  add column if not exists archived_at timestamptz,
  add column if not exists reminder_sent boolean not null default false,
  -- Denormalized from the route at creation time (a run happens where its
  -- route is, which may differ from the host's home city) — lets "near you"
  -- queries filter group_runs directly instead of joining routes every time.
  add column if not exists city text;

create index if not exists group_runs_status_date_idx on public.group_runs(status, scheduled_at);
create index if not exists group_runs_city_status_idx on public.group_runs(city, status, scheduled_at)
  where status in ('scheduled', 'active');

-- Backfill city for any runs created before this column existed.
update public.group_runs gr
set city = r.city
from public.routes r
where r.id = gr.route_id and gr.city is null;

create or replace function public.set_group_run_city()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select city into new.city from public.routes where id = new.route_id;
  return new;
end;
$$;

drop trigger if exists on_group_run_created_set_city on public.group_runs;
create trigger on_group_run_created_set_city
  before insert on public.group_runs
  for each row
  execute function public.set_group_run_city();

-- ─────────────────────────────────────────────────────────────
-- profiles: city (populated from the user's most recent route)
-- ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists city text;

update public.profiles p
set city = (
  select r.city from public.routes r
  where r.owner_id = p.id
  order by r.created_at desc
  limit 1
)
where p.city is null;

create or replace function public.update_profile_city_on_route()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set city = new.city where id = new.owner_id;
  return new;
end;
$$;

drop trigger if exists on_route_created_update_city on public.routes;
create trigger on_route_created_update_city
  after insert on public.routes
  for each row
  execute function public.update_profile_city_on_route();

-- ─────────────────────────────────────────────────────────────
-- RLS: archived runs are only readable by the host or an RSVP'd participant
-- ─────────────────────────────────────────────────────────────
drop policy if exists "group runs are viewable by everyone" on public.group_runs;
create policy "public can read upcoming runs, owners can read their archived runs"
  on public.group_runs for select
  using (
    status in ('scheduled', 'active')
    or host_id = auth.uid()
    or id in (select group_run_id from public.group_run_rsvps where user_id = auth.uid())
  );

-- Comments: no new comments once a run is archived (still fully readable).
drop policy if exists "rsvped users and the host can comment" on public.group_run_comments;
create policy "rsvped users and the host can comment on non-archived runs"
  on public.group_run_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.group_runs g
      where g.id = group_run_comments.group_run_id
        and g.status != 'archived'
        and (
          g.host_id = auth.uid()
          or exists (
            select 1 from public.group_run_rsvps r
            where r.group_run_id = g.id and r.user_id = auth.uid()
          )
        )
    )
  );
