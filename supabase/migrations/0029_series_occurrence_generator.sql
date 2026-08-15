-- Rootah T4: occurrence generator for recurring series. SECURITY DEFINER
-- because auto-RSVPing subscribers means inserting group_run_rsvps rows for
-- users other than the caller — RLS ("insert own row only") would otherwise
-- block that. Callable directly from the client right after series creation
-- (covers "first occurrence exists immediately") and from the daily
-- generate-occurrences Edge Function for the rolling 4-week horizon.
--
-- Fixes the two bugs called out in claude-tasks/T4-recurring-events.md:
--  1. First occurrence uses series_start_date as-is, not advanced past it.
--  2. Explicit +08:00 (Asia/Manila) offset when combining date + start_time,
--     so a 6am series generates 6am PHT events, not 6am UTC.

create or replace function public.next_occurrence_date(
  p_frequency text,
  p_day_of_month integer,
  p_from_date date
)
returns date
language plpgsql
immutable
as $$
declare
  next_date date;
  target_day integer;
  days_in_month integer;
begin
  if p_frequency = 'weekly' then
    return p_from_date + interval '7 days';
  elsif p_frequency = 'biweekly' then
    return p_from_date + interval '14 days';
  elsif p_frequency = 'monthly' then
    target_day := coalesce(p_day_of_month, extract(day from p_from_date)::int);
    next_date := date_trunc('month', p_from_date)::date + interval '1 month';
    days_in_month := extract(day from (date_trunc('month', next_date) + interval '1 month' - interval '1 day'))::int;
    return next_date + (least(target_day, days_in_month) - 1) * interval '1 day';
  end if;
  return p_from_date;
end;
$$;

create or replace function public.generate_occurrences_for_series(p_series_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  next_date date;
  horizon date := current_date + 28;
  generated integer := 0;
  new_run_id uuid;
  route_city text;
  event_ts timestamptz;
  sub record;
begin
  select * into s from public.recurring_series where id = p_series_id and is_active = true;
  if not found then
    return 0;
  end if;
  if s.series_end_date is not null and s.series_end_date < current_date then
    return 0;
  end if;

  select occurrence_date into next_date
  from public.group_runs
  where series_id = p_series_id
  order by occurrence_date desc
  limit 1;

  if next_date is null then
    next_date := s.series_start_date;
  else
    next_date := public.next_occurrence_date(s.frequency, s.day_of_month, next_date);
  end if;

  select city into route_city from public.routes where id = s.route_id;

  while next_date <= horizon and generated < 6 loop
    exit when s.series_end_date is not null and next_date > s.series_end_date;

    -- +08:00 explicit offset — see migration header note on the timezone bug.
    event_ts := (next_date::text || ' ' || s.start_time::text || '+08:00')::timestamptz;

    begin
      insert into public.group_runs (host_id, route_id, club_id, title, description, scheduled_at, city, status, series_id, occurrence_date)
      values (s.host_id, s.route_id, s.club_id, s.title, s.description, event_ts, route_city, 'scheduled', s.id, next_date)
      on conflict (series_id, occurrence_date) where series_id is not null do nothing
      returning id into new_run_id;
    exception when others then
      new_run_id := null;
    end;

    if new_run_id is not null then
      generated := generated + 1;

      for sub in
        select user_id from public.series_subscriptions
        where series_id = s.id and auto_rsvp = true and user_id != s.host_id
      loop
        begin
          insert into public.group_run_rsvps (group_run_id, user_id, status)
          values (new_run_id, sub.user_id, 'approved');
        exception when others then
          -- Capacity full / already joined some other way — skip, don't fail the batch.
          null;
        end;
      end loop;
    end if;

    next_date := public.next_occurrence_date(s.frequency, s.day_of_month, next_date);
  end loop;

  return generated;
end;
$$;
