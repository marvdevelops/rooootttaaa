-- Rootah: host is automatically RSVP'd to their own event and can't remove
-- that RSVP; free-tier users can only be RSVP'd (as a participant, not
-- host) to one upcoming event at a time. Run this after 0015_runs_near_you_radius.sql.

-- ─────────────────────────────────────────────────────────────
-- Auto-RSVP the host on group run creation
-- ─────────────────────────────────────────────────────────────
create or replace function public.auto_rsvp_host()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_run_rsvps (group_run_id, user_id)
  values (new.id, new.host_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_group_run_created_auto_rsvp_host on public.group_runs;
create trigger on_group_run_created_auto_rsvp_host
  after insert on public.group_runs
  for each row
  execute function public.auto_rsvp_host();

-- Backfill existing runs so their host shows up as RSVP'd too.
insert into public.group_run_rsvps (group_run_id, user_id)
select id, host_id from public.group_runs
on conflict do nothing;

-- The host can no longer cancel their own RSVP (supersedes the 0002 policy).
drop policy if exists "users can cancel their own rsvp" on public.group_run_rsvps;
create policy "users can cancel their own rsvp, but not as host"
  on public.group_run_rsvps for delete
  using (
    user_id = auth.uid()
    and not exists (
      select 1 from public.group_runs g
      where g.id = group_run_rsvps.group_run_id and g.host_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Free tier: one joined event at a time (hosting is a separate cap, T2 Gate 4)
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

  -- The host's own auto-RSVP is exempt — it isn't "joining" someone else's event.
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
    and g.status in ('scheduled', 'active');

  if other_joins >= 1 then
    raise exception 'Free accounts can only join one event at a time.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists single_join_check on public.group_run_rsvps;
create trigger single_join_check
  before insert on public.group_run_rsvps
  for each row
  execute function public.enforce_single_join_for_free_users();
