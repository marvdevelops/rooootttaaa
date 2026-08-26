-- Race organizer branding: users track their race activity and want the
-- finished share card / event page to carry the *race's* branding, not
-- Rootah's — organizer_logo_url already existed (used on the share card);
-- this adds the organizer's name (shown instead of "hosted by Rootah" on
-- race events) and separate banner/event-logo images for the event page.
alter table public.race_details
  add column organizer_name text,
  add column event_banner_url text,
  add column event_logo_url text;

-- Reminder tracking — one boolean per milestone per RSVP, set once that
-- reminder has actually been sent so the reminder job (race-reminders Edge
-- Function, run on an external schedule same as group-run-lifecycle) is
-- idempotent even if it runs more than once on the same day.
alter table public.group_run_rsvps
  add column reminder_5d_sent_at timestamptz,
  add column reminder_2d_sent_at timestamptz,
  add column reminder_1d_sent_at timestamptz;
