-- Races don't need host approval to join — unlike training group runs,
-- where a request sits 'pending' until the host reviews it, a race RSVP
-- should be instantly 'approved' so "I'M JOINING THIS RACE" actually means
-- "you're in," not "request sent." Implemented as a before-insert trigger
-- (not a client-side status override) so it can't be bypassed and still
-- runs through the existing capacity check below it.
create or replace function public.auto_approve_race_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  run_category text;
begin
  if new.status = 'pending' then
    select category into run_category from public.group_runs where id = new.group_run_id;
    if run_category = 'race' then
      new.status := 'approved';
    end if;
  end if;
  return new;
end;
$$;

-- Named to sort alphabetically before "rsvp_cap_check" (0019) — both are
-- BEFORE INSERT row triggers, and Postgres fires same-timing triggers in
-- trigger-name order, so this must set status='approved' before the
-- capacity trigger reads it.
drop trigger if exists auto_approve_race_rsvp on public.group_run_rsvps;
create trigger auto_approve_race_rsvp
  before insert on public.group_run_rsvps
  for each row
  execute function public.auto_approve_race_rsvp();
