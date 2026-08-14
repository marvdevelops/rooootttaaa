-- Rootah: extends the pg_net push-notification trigger (0018) to also fire
-- on group_run_rsvps status changes, so a requester gets notified when the
-- host approves/declines them. Run after 0019_rsvp_approval.sql and after
-- redeploying send-push-notification (it now branches on UPDATE too).
--
-- NOTE: like 0018, the Authorization header below is a literal placeholder —
-- swap in the real PUSH_WEBHOOK_AUTH_HEADER value before running this file,
-- and don't commit the real value to a public repo.

create or replace function public.notify_push_webhook_update()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://vbqjhhgghybuolgnzjyy.supabase.co/functions/v1/send-push-notification',
    body := jsonb_build_object(
      'type', 'UPDATE',
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', to_jsonb(OLD)
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

drop trigger if exists send_push_notification_on_rsvp_status_change on public.group_run_rsvps;
create trigger send_push_notification_on_rsvp_status_change
  after update of status on public.group_run_rsvps
  for each row
  execute function public.notify_push_webhook_update();
