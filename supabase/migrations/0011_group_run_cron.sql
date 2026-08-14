-- OPTIONAL — SUPABASE PRO ONLY. Skip this file unless you're already on
-- Supabase Pro and specifically want pg_cron running the schedule
-- in-database. The default path for Rootah is 0012_group_run_lifecycle_functions.sql
-- + the group-run-lifecycle Edge Function, triggered by a free external
-- scheduler (e.g. cron-job.org) — same effect, no paid plan required.
--
-- Rootah: pg_cron jobs that drive the group run lifecycle
-- (scheduled -> active -> archived). Run this after 0010_group_run_lifecycle.sql.
--
-- REQUIRES SUPABASE PRO — pg_cron is not available on the free tier.
-- Before running this file, enable the extension:
--   Supabase Dashboard -> Database -> Extensions -> search "pg_cron" -> Enable
--
-- Rootah's schema uses group_runs.scheduled_at (not event_date, as an earlier
-- draft of this spec assumed).

create extension if not exists pg_cron;

-- Job 1: activate today's runs, hourly (catches any scheduled time of day).
select cron.schedule(
  'activate-todays-group-runs',
  '0 * * * *',
  $$
    update public.group_runs
    set status = 'active'
    where status = 'scheduled'
      and date(scheduled_at at time zone 'Asia/Manila') = (now() at time zone 'Asia/Manila')::date;
  $$
);

-- Job 2: archive runs 1 day after their scheduled date. Runs daily at
-- midnight PHT (16:00 UTC) — late enough that same-day latecomers, RSVPs,
-- and post-run comments still land before archiving, per the spec's stated
-- rationale (a 6am Saturday run should stay visible through Saturday night).
select cron.schedule(
  'archive-past-group-runs',
  '0 16 * * *',
  $$
    update public.group_runs
    set status = 'archived', archived_at = now()
    where status != 'archived'
      and scheduled_at < now() - interval '1 day';
  $$
);

-- To inspect scheduled jobs:      select * from cron.job;
-- To inspect recent job runs:     select * from cron.job_run_details order by start_time desc limit 20;
-- To remove a job if needed:      select cron.unschedule('activate-todays-group-runs');
