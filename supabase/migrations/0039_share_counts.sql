-- Share counters for routes, group runs, and clubs — incremented client-side
-- whenever the Share button is used (native share sheet or clipboard copy).
alter table public.routes add column if not exists share_count integer not null default 0;
alter table public.group_runs add column if not exists share_count integer not null default 0;
alter table public.run_clubs add column if not exists share_count integer not null default 0;

create or replace function public.increment_route_share_count(route_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.routes set share_count = share_count + 1 where id = route_id;
$$;

create or replace function public.increment_group_run_share_count(run_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.group_runs set share_count = share_count + 1 where id = run_id;
$$;

create or replace function public.increment_club_share_count(club_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.run_clubs set share_count = share_count + 1 where id = club_id;
$$;

grant execute on function public.increment_route_share_count(uuid) to anon, authenticated;
grant execute on function public.increment_group_run_share_count(uuid) to anon, authenticated;
grant execute on function public.increment_club_share_count(uuid) to anon, authenticated;
