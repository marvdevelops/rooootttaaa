-- Rootah T4: club notifications — new club run (fan-out to members) and
-- private-club join requests (fan-out to admins/owner). Reuses the generic
-- notify_push_webhook() pg_net trigger function from 0018 — the Edge
-- Function branches on table name and does its own fan-out lookup.
--
-- NOTE: like 0018/0020, run this after replacing the Authorization header
-- placeholder with the real PUSH_WEBHOOK_AUTH_HEADER value, and don't
-- commit the real value to a public repo.

drop trigger if exists send_push_notification_on_club_run on public.group_runs;
create trigger send_push_notification_on_club_run
  after insert on public.group_runs
  for each row
  when (new.club_id is not null)
  execute function public.notify_push_webhook();

drop trigger if exists send_push_notification_on_club_join_request on public.club_memberships;
create trigger send_push_notification_on_club_join_request
  after insert on public.club_memberships
  for each row
  when (new.status = 'pending')
  execute function public.notify_push_webhook();
