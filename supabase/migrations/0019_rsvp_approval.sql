-- Rootah: host approve/decline join requests. Joining a run now creates a
-- 'pending' request instead of instantly counting as attending; the host
-- approves or declines it. Run this after 0018_push_notification_webhooks.sql.

-- ─────────────────────────────────────────────────────────────
-- status column
-- ─────────────────────────────────────────────────────────────
alter table public.group_run_rsvps
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined'));

-- Every row that existed before this migration was created under the old
-- instant-join model — grandfather them all in as approved.
update public.group_run_rsvps set status = 'approved';

-- Denormalized approved-attendee count on group_runs, maintained by trigger
-- below — avoids every list/detail query having to filter+count the
-- (now-mixed-status) rsvps table itself.
alter table public.group_runs
  add column if not exists approved_count integer not null default 0;

update public.group_runs g
  set approved_count = (
    select count(*) from public.group_run_rsvps r
    where r.group_run_id = g.id and r.status = 'approved'
  );

create or replace function public.maintain_group_run_approved_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.status = 'approved' then
      update public.group_runs set approved_count = approved_count + 1 where id = new.group_run_id;
    end if;
    return new;
  elsif TG_OP = 'UPDATE' then
    if old.status != 'approved' and new.status = 'approved' then
      update public.group_runs set approved_count = approved_count + 1 where id = new.group_run_id;
    elsif old.status = 'approved' and new.status != 'approved' then
      update public.group_runs set approved_count = greatest(approved_count - 1, 0) where id = new.group_run_id;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    if old.status = 'approved' then
      update public.group_runs set approved_count = greatest(approved_count - 1, 0) where id = old.group_run_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists maintain_approved_count on public.group_run_rsvps;
create trigger maintain_approved_count
  after insert or update of status or delete on public.group_run_rsvps
  for each row
  execute function public.maintain_group_run_approved_count();

-- ─────────────────────────────────────────────────────────────
-- Host auto-RSVP is auto-approved (supersedes 0016's insert)
-- ─────────────────────────────────────────────────────────────
create or replace function public.auto_rsvp_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_run_rsvps (group_run_id, user_id, status)
  values (new.id, new.host_id, 'approved')
  on conflict do nothing;
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Capacity: pending requests don't consume a slot — only block new
-- requests once *approved* attendance is full, and block the host from
-- approving past capacity. Free-tier hosts still capped at 10.
-- ─────────────────────────────────────────────────────────────
create or replace function public.enforce_rsvp_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host_tier text;
  host_max_participants int;
  effective_cap int;
  current_approved int;
begin
  -- Pending requests are free to queue up regardless of capacity — the host
  -- decides who fills the remaining slots. Only an approval needs the check.
  if new.status != 'approved' then
    return new;
  end if;

  select p.tier, gr.max_participants, gr.approved_count
    into host_tier, host_max_participants, current_approved
  from public.group_runs gr
  join public.profiles p on p.id = gr.host_id
  where gr.id = new.group_run_id;

  if host_tier = 'paid' then
    effective_cap := host_max_participants; -- null = open to all
  else
    effective_cap := least(coalesce(host_max_participants, 10), 10);
  end if;

  if effective_cap is null then
    return new;
  end if;

  if TG_OP = 'INSERT' and current_approved >= effective_cap then
    raise exception 'This run is at capacity.' using errcode = 'P0001';
  end if;

  if TG_OP = 'UPDATE' and old.status != 'approved' and current_approved >= effective_cap then
    raise exception 'This run is at capacity.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists rsvp_cap_check on public.group_run_rsvps;
create trigger rsvp_cap_check
  before insert or update of status on public.group_run_rsvps
  for each row
  execute function public.enforce_rsvp_cap();

-- ─────────────────────────────────────────────────────────────
-- Free tier: one requested/joined event at a time (pending or approved).
-- ─────────────────────────────────────────────────────────────
create or replace function public.enforce_single_join_for_free_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  joiner_tier text;
  run_host_id uuid;
  other_joins int;
begin
  select host_id into run_host_id from public.group_runs where id = new.group_run_id;

  if run_host_id = new.user_id then
    return new;
  end if;

  select tier into joiner_tier from public.profiles where id = new.user_id;
  if joiner_tier = 'paid' then
    return new;
  end if;

  select count(*) into other_joins
  from public.group_run_rsvps r
  join public.group_runs g on g.id = r.group_run_id
  where r.user_id = new.user_id
    and g.host_id != new.user_id
    and r.status in ('pending', 'approved')
    and g.status in ('scheduled', 'active');

  if other_joins >= 1 then
    raise exception 'Free accounts can only join one event at a time.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS: only the host can approve/decline; pending/declined rows are only
-- visible to the host and the requester themselves (not the public).
-- ─────────────────────────────────────────────────────────────
drop policy if exists "rsvp counts are viewable by everyone" on public.group_run_rsvps;
create policy "approved rsvps public, others visible to host and requester"
  on public.group_run_rsvps for select
  using (
    status = 'approved'
    or user_id = auth.uid()
    or exists (
      select 1 from public.group_runs g
      where g.id = group_run_rsvps.group_run_id and g.host_id = auth.uid()
    )
  );

drop policy if exists "hosts can update rsvp status for their own runs" on public.group_run_rsvps;
create policy "hosts can update rsvp status for their own runs"
  on public.group_run_rsvps for update
  using (
    exists (
      select 1 from public.group_runs g
      where g.id = group_run_rsvps.group_run_id and g.host_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.group_runs g
      where g.id = group_run_rsvps.group_run_id and g.host_id = auth.uid()
    )
  );
