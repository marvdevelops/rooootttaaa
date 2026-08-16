-- T5: Badges & gamification. Local Legend is implemented as a live query
-- (see get_route_leader below) rather than the spec's pg_cron-recalculated
-- stored badge — this project has no pg_cron (free tier, same constraint as
-- 0011/0012 and 0032's top_routes view), and a nightly-recompute job would
-- need one anyway. A live query is simpler and always current.

create table if not exists public.badges (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  tier text not null default 'standard' check (tier in ('standard', 'rare', 'legendary')),
  is_active boolean not null default true
);

insert into public.badges (id, name, description, icon, tier) values
  ('first_route',  'Route Maker',  'Created your first public route',      '🗺',  'standard'),
  ('first_run',    'First Run',    'Logged your first run on Rootah',      '🏃',  'standard'),
  ('trail_five',   'Trail Blazer', 'Completed 5 trail or hiking routes',   '🏔',  'standard'),
  ('century',      'Century',      'Logged a cycling route over 100km',    '💯',  'rare')
on conflict (id) do nothing;

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id),
  granted_at timestamptz not null default now(),
  context_route_id uuid references public.routes(id) on delete set null,
  context_completion_id uuid references public.route_completions(id) on delete set null,
  unique (user_id, badge_id)
);

create index if not exists user_badges_user_idx on public.user_badges(user_id, granted_at desc);

alter table public.user_badges enable row level security;

drop policy if exists "user badges publicly readable" on public.user_badges;
create policy "user badges publicly readable"
  on public.user_badges for select
  using (true);

-- Grants are server-side only (triggers below); no client insert policy.

-- ─────────────────────────────────────────────────────────────
-- first_route — granted the moment a route goes public (create or edit)
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_first_route_badge()
returns trigger as $$
begin
  if NEW.is_public = true and (TG_OP = 'INSERT' or OLD.is_public = false) then
    insert into public.user_badges (user_id, badge_id, context_route_id)
    values (NEW.owner_id, 'first_route', NEW.id)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_route_published on public.routes;
create trigger on_route_published
  after insert or update on public.routes
  for each row execute function public.grant_first_route_badge();

-- ─────────────────────────────────────────────────────────────
-- first_run — granted on the user's first ever completion
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_first_run_badge()
returns trigger as $$
declare
  completion_total integer;
begin
  select count(*) into completion_total from public.route_completions where user_id = NEW.user_id;

  if completion_total = 1 then
    insert into public.user_badges (user_id, badge_id, context_completion_id)
    values (NEW.user_id, 'first_run', NEW.id)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_first_completion on public.route_completions;
create trigger on_first_completion
  after insert on public.route_completions
  for each row execute function public.grant_first_run_badge();

-- ─────────────────────────────────────────────────────────────
-- trail_five — granted at 5 distinct completed trail/hike routes
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_trail_blazer_badge()
returns trigger as $$
declare
  trail_total integer;
begin
  select count(distinct rc.route_id) into trail_total
  from public.route_completions rc
  join public.routes r on r.id = rc.route_id
  where rc.user_id = NEW.user_id and r.is_trail = true;

  if trail_total >= 5 then
    insert into public.user_badges (user_id, badge_id, context_completion_id)
    values (NEW.user_id, 'trail_five', NEW.id)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_trail_completion on public.route_completions;
create trigger on_trail_completion
  after insert on public.route_completions
  for each row execute function public.grant_trail_blazer_badge();

-- ─────────────────────────────────────────────────────────────
-- century — granted on a bike completion where the route is >= 100km
-- ─────────────────────────────────────────────────────────────
create or replace function public.grant_century_badge()
returns trigger as $$
declare
  route_distance numeric;
  route_type text;
begin
  select distance_km, activity_type into route_distance, route_type
  from public.routes where id = NEW.route_id;

  if route_type = 'bike' and route_distance >= 100 then
    insert into public.user_badges (user_id, badge_id, context_completion_id)
    values (NEW.user_id, 'century', NEW.id)
    on conflict do nothing;
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_century_ride on public.route_completions;
create trigger on_century_ride
  after insert on public.route_completions
  for each row execute function public.grant_century_badge();

-- ─────────────────────────────────────────────────────────────
-- Local Legend — live lookup, not a stored/cron-recalculated badge.
-- Minimum 3 completions to qualify, ties broken by whoever got there first.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_route_leader(p_route_id uuid)
returns table(user_id uuid, completion_count bigint)
language sql stable
as $$
  select rc.user_id, count(*) as completion_count
  from public.route_completions rc
  where rc.route_id = p_route_id
  group by rc.user_id
  having count(*) >= 3
  order by count(*) desc, min(rc.completed_at) asc
  limit 1;
$$;
