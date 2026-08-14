-- Rootah: fires send-push-notification on INSERT into route_likes /
-- group_run_rsvps. Implemented directly on pg_net (rather than the
-- dashboard's Database Webhooks UI, whose supabase_functions helper schema
-- isn't provisioned on this project yet) — same effect, self-contained.
-- Run this after 0017_push_notifications.sql and after deploying
-- send-push-notification.
--
-- NOTE: a Postgres trigger has no way to reference an Edge Function secret
-- at call time, so the Authorization header below is a literal string.
-- REPLACE_WITH_PUSH_WEBHOOK_AUTH_HEADER_VALUE is a placeholder — swap in
-- the real value (matching the PUSH_WEBHOOK_AUTH_HEADER secret set via
-- `supabase secrets set`) before running this file, and don't commit the
-- real value to a public repo.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://vbqjhhgghybuolgnzjyy.supabase.co/functions/v1/send-push-notification',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REPLACE_WITH_PUSH_WEBHOOK_AUTH_HEADER_VALUE'
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
end;
$$;

drop trigger if exists send_push_notification_on_route_like on public.route_likes;
create trigger send_push_notification_on_route_like
  after insert on public.route_likes
  for each row
  execute function public.notify_push_webhook();

drop trigger if exists send_push_notification_on_group_run_rsvp on public.group_run_rsvps;
create trigger send_push_notification_on_group_run_rsvp
  after insert on public.group_run_rsvps
  for each row
  execute function public.notify_push_webhook();
