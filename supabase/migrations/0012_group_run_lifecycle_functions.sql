-- Rootah: SQL functions backing the group run lifecycle ticker, called via
-- RPC from the group-run-lifecycle Edge Function (supabase/functions/group-run-lifecycle).
--
-- This is the free-tier alternative to 0011_group_run_cron.sql — same two
-- UPDATE statements, but triggered by an external scheduler (e.g.
-- cron-job.org) hitting an Edge Function instead of Supabase's in-database
-- pg_cron (which requires a paid plan). Run this after 0010_group_run_lifecycle.sql.
-- Do NOT also run 0011 unless you're on Supabase Pro and prefer pg_cron instead.

create or replace function public.activate_todays_group_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.group_runs
  set status = 'active'
  where status = 'scheduled'
    and date(scheduled_at at time zone 'Asia/Manila') = (now() at time zone 'Asia/Manila')::date;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.archive_past_group_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.group_runs
  set status = 'archived', archived_at = now()
  where status != 'archived'
    and scheduled_at < now() - interval '1 day';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Both run with the definer's privileges (bypassing RLS) since the Edge
-- Function calls them with the service role key. Revoke public execute so
-- they can't be called by ordinary authenticated users directly.
revoke execute on function public.activate_todays_group_runs() from public, authenticated, anon;
revoke execute on function public.archive_past_group_runs() from public, authenticated, anon;
grant execute on function public.activate_todays_group_runs() to service_role;
grant execute on function public.archive_past_group_runs() to service_role;
