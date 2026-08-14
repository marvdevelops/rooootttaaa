-- Rootah: comments on group runs, threaded up to 3 levels deep
-- (top-level -> reply -> reply-to-reply). Run this once in the Supabase
-- SQL Editor, after 0002_social_and_groups.sql.

create table if not exists public.group_run_comments (
  id uuid primary key default gen_random_uuid(),
  group_run_id uuid not null references public.group_runs(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.group_run_comments(id) on delete cascade,
  depth smallint not null default 0,
  body text not null,
  created_at timestamptz not null default now(),
  constraint group_run_comments_depth_check check (depth between 0 and 2)
);

create index if not exists group_run_comments_group_run_id_idx on public.group_run_comments(group_run_id);
create index if not exists group_run_comments_parent_comment_id_idx on public.group_run_comments(parent_comment_id);

alter table public.group_run_comments enable row level security;

drop policy if exists "comments are viewable by everyone" on public.group_run_comments;
create policy "comments are viewable by everyone"
  on public.group_run_comments for select
  using (true);

-- Only people who RSVPed to the run (or the host, who might not have
-- RSVPed to their own event) can post.
drop policy if exists "rsvped users and the host can comment" on public.group_run_comments;
create policy "rsvped users and the host can comment"
  on public.group_run_comments for insert
  with check (
    author_id = auth.uid()
    and (
      exists (
        select 1 from public.group_run_rsvps r
        where r.group_run_id = group_run_comments.group_run_id
          and r.user_id = auth.uid()
      )
      or exists (
        select 1 from public.group_runs g
        where g.id = group_run_comments.group_run_id
          and g.host_id = auth.uid()
      )
    )
  );

drop policy if exists "authors can delete their own comments" on public.group_run_comments;
create policy "authors can delete their own comments"
  on public.group_run_comments for delete
  using (author_id = auth.uid());
