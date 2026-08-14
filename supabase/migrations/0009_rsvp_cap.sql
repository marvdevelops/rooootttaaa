-- Rootah: server-side RSVP cap for free-tier hosts (Rootah Pro gate 4b).
-- Run this once in the Supabase SQL Editor, after 0008_subscriptions.sql.
--
-- Client-side checks (Gate 4) stop a free host from scheduling a *second*
-- active run, but RSVP counts on an existing run must be capped here too —
-- RSVPs come from other users' devices, which the host's own client never sees.

create or replace function public.enforce_rsvp_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host_tier text;
  current_count int;
begin
  select p.tier into host_tier
  from public.group_runs gr
  join public.profiles p on p.id = gr.host_id
  where gr.id = new.group_run_id;

  if host_tier = 'paid' then
    return new;
  end if;

  select count(*) into current_count
  from public.group_run_rsvps
  where group_run_id = new.group_run_id;

  if current_count >= 10 then
    raise exception 'This run is at capacity.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists rsvp_cap_check on public.group_run_rsvps;
create trigger rsvp_cap_check
  before insert on public.group_run_rsvps
  for each row
  execute function public.enforce_rsvp_cap();
