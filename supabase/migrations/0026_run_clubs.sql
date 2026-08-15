-- Rootah T4: run clubs. Adapted from claude-tasks/T4-run-clubs.md:
-- users -> profiles, event_date -> scheduled_at (group_runs' actual column).
-- Club creation/joining is free for everyone — the 25-member cap on
-- free-tier-owned clubs is the paywall (enforced client-side at join time
-- via getClubJoinEligibility, since RLS can't easily read a *different*
-- user's tier for a INSERT check without a security-definer helper — added
-- below for defense in depth anyway).

create table if not exists public.run_clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  city text,
  avatar_url text,
  cover_url text,
  is_private boolean not null default false,
  member_count integer not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists run_clubs_city_idx on public.run_clubs(city);

create type club_role as enum ('member', 'admin', 'owner');

create table if not exists public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.run_clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role club_role not null default 'member',
  status text not null default 'active' check (status in ('active', 'pending', 'removed')),
  joined_at timestamptz default now(),
  unique (club_id, user_id)
);

create index if not exists club_memberships_club_idx on public.club_memberships(club_id);
create index if not exists club_memberships_user_idx on public.club_memberships(user_id);

create table if not exists public.club_routes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.run_clubs(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  added_by uuid references public.profiles(id),
  added_at timestamptz default now(),
  unique (club_id, route_id)
);

alter table public.group_runs
  add column if not exists club_id uuid references public.run_clubs(id) on delete set null;

create or replace function public.sync_club_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' and new.status = 'active' then
    update public.run_clubs set member_count = member_count + 1 where id = new.club_id;
  elsif TG_OP = 'UPDATE' then
    if old.status != 'active' and new.status = 'active' then
      update public.run_clubs set member_count = member_count + 1 where id = new.club_id;
    elsif old.status = 'active' and new.status != 'active' then
      update public.run_clubs set member_count = greatest(member_count - 1, 0) where id = new.club_id;
    end if;
  elsif TG_OP = 'DELETE' and old.status = 'active' then
    update public.run_clubs set member_count = greatest(member_count - 1, 0) where id = old.club_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_membership_change on public.club_memberships;
create trigger on_membership_change
  after insert or update or delete on public.club_memberships
  for each row execute function public.sync_club_member_count();

-- Helper for RLS (bypasses RLS on its own lookup, same pattern as
-- is_run_host/is_approved_participant — avoids recursion between
-- run_clubs <-> club_memberships policies).
create or replace function public.is_active_club_member(p_club_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.club_memberships m
    where m.club_id = p_club_id and m.user_id = p_user_id and m.status = 'active'
  );
$$;

create or replace function public.is_club_admin(p_club_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.club_memberships m
    where m.club_id = p_club_id and m.user_id = p_user_id
      and m.status = 'active' and m.role in ('admin', 'owner')
  );
$$;

create or replace function public.is_club_owner(p_club_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.club_memberships m
    where m.club_id = p_club_id and m.user_id = p_user_id
      and m.status = 'active' and m.role = 'owner'
  );
$$;

/** Cap is evaluated against the club OWNER's tier, never the joiner's. */
create or replace function public.enforce_club_member_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_tier text;
  current_count int;
begin
  if new.status != 'active' then
    return new;
  end if;

  select p.tier, c.member_count into owner_tier, current_count
  from public.run_clubs c
  join public.profiles p on p.id = c.created_by
  where c.id = new.club_id;

  if owner_tier = 'paid' then
    return new;
  end if;

  if current_count >= 25 then
    raise exception 'This club is currently full.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists club_member_cap_check on public.club_memberships;
create trigger club_member_cap_check
  before insert or update of status on public.club_memberships
  for each row execute function public.enforce_club_member_cap();

alter table public.run_clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_routes enable row level security;

drop policy if exists "clubs readable" on public.run_clubs;
create policy "clubs readable"
  on public.run_clubs for select
  using (
    is_private = false
    or public.is_active_club_member(id, auth.uid())
    or created_by = auth.uid()
  );

drop policy if exists "clubs insertable by creator" on public.run_clubs;
create policy "clubs insertable by creator"
  on public.run_clubs for insert
  with check (auth.uid() = created_by);

drop policy if exists "clubs updatable by admins" on public.run_clubs;
create policy "clubs updatable by admins"
  on public.run_clubs for update
  using (public.is_club_admin(id, auth.uid()));

drop policy if exists "clubs deletable by owner" on public.run_clubs;
create policy "clubs deletable by owner"
  on public.run_clubs for delete
  using (public.is_club_owner(id, auth.uid()));

drop policy if exists "memberships readable by own and clubmates" on public.club_memberships;
create policy "memberships readable by own and clubmates"
  on public.club_memberships for select
  using (
    user_id = auth.uid()
    or public.is_active_club_member(club_id, auth.uid())
  );

drop policy if exists "memberships insertable by self" on public.club_memberships;
create policy "memberships insertable by self"
  on public.club_memberships for insert
  with check (user_id = auth.uid());

drop policy if exists "memberships updatable by admins or self" on public.club_memberships;
create policy "memberships updatable by admins or self"
  on public.club_memberships for update
  using (
    public.is_club_admin(club_id, auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "memberships deletable by admins or self" on public.club_memberships;
create policy "memberships deletable by admins or self"
  on public.club_memberships for delete
  using (
    public.is_club_admin(club_id, auth.uid())
    or user_id = auth.uid()
  );

drop policy if exists "club routes readable by club members and public clubs" on public.club_routes;
create policy "club routes readable by club members and public clubs"
  on public.club_routes for select
  using (
    exists (
      select 1 from public.run_clubs c
      where c.id = club_routes.club_id
        and (c.is_private = false or public.is_active_club_member(c.id, auth.uid()))
    )
  );

drop policy if exists "club routes insertable by admins" on public.club_routes;
create policy "club routes insertable by admins"
  on public.club_routes for insert
  with check (public.is_club_admin(club_id, auth.uid()));

drop policy if exists "club routes deletable by admins" on public.club_routes;
create policy "club routes deletable by admins"
  on public.club_routes for delete
  using (public.is_club_admin(club_id, auth.uid()));

alter table public.notification_preferences
  add column if not exists club_new_run_enabled boolean not null default true,
  add column if not exists club_join_request_enabled boolean not null default true;
