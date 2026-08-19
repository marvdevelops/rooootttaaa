-- Landing page waitlist signups. Public-facing insert-only table: anyone can
-- add their email via the marketing site, nobody can read it back through
-- the anon key (avoids leaking the list through client-side RLS bugs).
create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table waitlist_signups enable row level security;

create policy "anyone can join the waitlist"
  on waitlist_signups for insert
  to anon
  with check (true);
