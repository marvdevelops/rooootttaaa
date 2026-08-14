-- Rootah: rotates PUSH_WEBHOOK_AUTH_HEADER — the original value was
-- committed in plaintext in 0018/0020 before this repo was pushed to
-- GitHub, so it's treated as compromised. Already applied directly against
-- the live database with the real secret; this file is the redacted record.
--
-- REPLACE_WITH_PUSH_WEBHOOK_AUTH_HEADER_VALUE is a placeholder — swap in the
-- real value (matching `supabase secrets set PUSH_WEBHOOK_AUTH_HEADER=...`)
-- before running this file, and don't commit the real value to a public repo.

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
