-- Rootah: backfill profiles for auth users created before the
-- handle_new_user() trigger existed (i.e. before 0001_init.sql was run).
-- Safe to re-run — only inserts rows for users still missing a profile.

insert into public.profiles (id, username)
select
  u.id,
  coalesce(split_part(u.email, '@', 1), 'runner') || '_' || substr(replace(u.id::text, '-', ''), 1, 6)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
