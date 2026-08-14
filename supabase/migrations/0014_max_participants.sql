-- Rootah: host-configurable RSVP cap per group run (1-10, or open to all for
-- paid hosts). Run this after 0013_comments_participants_only.sql.

alter table public.group_runs
  add column if not exists max_participants integer
    check (max_participants is null or max_participants between 1 and 10);

-- Supersedes the hardcoded 10 from 0009_rsvp_cap.sql: free hosts are still
-- capped at 10 regardless of what they pick (enforced here, not just in the
-- UI), paid hosts get whatever they chose — including no cap at all when
-- max_participants is null ("open to all").
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
  current_count int;
begin
  select p.tier, gr.max_participants into host_tier, host_max_participants
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

  select count(*) into current_count
  from public.group_run_rsvps
  where group_run_id = new.group_run_id;

  if current_count >= effective_cap then
    raise exception 'This run is at capacity.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
