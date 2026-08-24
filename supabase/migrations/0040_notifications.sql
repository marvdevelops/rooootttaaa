-- In-app notification feed, populated by the same events that already
-- trigger push notifications (see the send-push-notification edge function).
-- Inserts happen server-side only (service role, from the edge function) —
-- there is deliberately no insert policy for authenticated/anon users.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "recipients can view their own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_id);

create policy "recipients can mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
