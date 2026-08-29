-- Club owners/admins post updates to their club; event/race hosts post updates
-- to their event. Both are simple append-only timelines shown newest-first.

-- ---------- club posts ----------
create table public.club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.run_clubs (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index club_posts_club_idx on public.club_posts (club_id, created_at desc);

alter table public.club_posts enable row level security;

-- Anyone who can see the club can read its announcements.
create policy "club_posts_read" on public.club_posts for select using (true);

create policy "club_posts_write_admin" on public.club_posts for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.club_memberships m
      where m.club_id = club_posts.club_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('admin', 'owner')
    )
  );

create policy "club_posts_delete_admin" on public.club_posts for delete
  using (
    exists (
      select 1 from public.club_memberships m
      where m.club_id = club_posts.club_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role in ('admin', 'owner')
    )
  );

-- ---------- event / race posts ----------
create table public.group_run_posts (
  id uuid primary key default gen_random_uuid(),
  group_run_id uuid not null references public.group_runs (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index group_run_posts_run_idx on public.group_run_posts (group_run_id, created_at desc);

alter table public.group_run_posts enable row level security;

create policy "group_run_posts_read" on public.group_run_posts for select using (true);

create policy "group_run_posts_write_host" on public.group_run_posts for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.group_runs g
      where g.id = group_run_posts.group_run_id and g.host_id = auth.uid()
    )
  );

create policy "group_run_posts_delete_host" on public.group_run_posts for delete
  using (
    exists (
      select 1 from public.group_runs g
      where g.id = group_run_posts.group_run_id and g.host_id = auth.uid()
    )
  );

-- A token-gated read for the public /live race page (no account, same model as
-- the rest of the spectator surface).
create function public.get_race_posts(token text)
returns table (id uuid, body text, created_at timestamptz, author_username text)
language sql security definer set search_path = public as $$
  select gp.id, gp.body, gp.created_at, p.username
  from public.group_run_rsvps rsvp
  join public.group_run_posts gp on gp.group_run_id = rsvp.group_run_id
  left join public.profiles p on p.id = gp.author_id
  where rsvp.live_share_token = token
  order by gp.created_at desc;
$$;
grant execute on function public.get_race_posts(text) to anon, authenticated;
