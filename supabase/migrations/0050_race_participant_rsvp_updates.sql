-- Real bug: group_run_rsvps only ever had an UPDATE policy for the run's
-- HOST ("hosts can update rsvp status for their own runs", 0019/0021) — a
-- regular participant could never update their own row. That silently
-- broke every race-run write for a non-host participant, since none of
-- these client calls use .select() after .update() to surface a 0-rows-
-- affected result as an error:
--   startRaceRun / finishRaceRun / ensureLiveShareToken /
--   updateRaceLivePosition / saveShareCardPath (all in racesApi.ts)
-- The client would generate a live_share_token locally and hand out a
-- /live/[token] URL that never actually got saved — hence the reported
-- 404, and would have equally broken finish detection, live position
-- broadcast, and the share card for anyone who isn't the race host.
--
-- Fix: let a participant update their OWN row, but guard against using
-- that to self-approve/self-decline (bypassing host review on training
-- runs) or reassign the row to someone else — a trigger, since RLS
-- policies can't restrict to specific columns on their own.
drop policy if exists "participants can update their own rsvp tracking fields" on public.group_run_rsvps;
create policy "participants can update their own rsvp tracking fields"
  on public.group_run_rsvps for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.guard_self_rsvp_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only constrains a participant updating their own row (not the host
  -- updating someone else's, which is a separate policy and legitimately
  -- needs to change status).
  if new.user_id = auth.uid() and not public.is_run_host(new.group_run_id, auth.uid()) then
    if new.status is distinct from old.status then
      raise exception 'You cannot change your own RSVP status.' using errcode = 'P0001';
    end if;
    new.group_run_id := old.group_run_id;
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_self_rsvp_update on public.group_run_rsvps;
create trigger guard_self_rsvp_update
  before update on public.group_run_rsvps
  for each row
  execute function public.guard_self_rsvp_update();
