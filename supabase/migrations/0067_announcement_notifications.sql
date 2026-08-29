-- Wire club/event announcements (0059) into the notification pipeline. The
-- generic notify_push_webhook() trigger (0018/0022) POSTs the new row to the
-- send-push-notification Edge Function, which now has club_posts /
-- group_run_posts branches that fan out to club members / approved RSVPs.
--
-- NOTE: redeploy send-push-notification after this migration.

alter table public.notification_preferences
  add column if not exists announcements_enabled boolean not null default true;

drop trigger if exists send_push_notification_on_club_post on public.club_posts;
create trigger send_push_notification_on_club_post
  after insert on public.club_posts
  for each row execute function public.notify_push_webhook();

drop trigger if exists send_push_notification_on_group_run_post on public.group_run_posts;
create trigger send_push_notification_on_group_run_post
  after insert on public.group_run_posts
  for each row execute function public.notify_push_webhook();
