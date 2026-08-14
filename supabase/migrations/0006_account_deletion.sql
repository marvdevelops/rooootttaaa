-- Rootah: self-service account deletion (App Store 5.1.1(v) / Google Play
-- account deletion policy). Deleting the auth.users row cascades through
-- profiles -> routes, route_saves, route_likes, group_runs, group_run_rsvps,
-- group_run_comments (all already `on delete cascade` from profiles/users).
-- Avatar storage objects aren't covered by SQL cascade — the client removes
-- those separately (via its own storage RLS) before calling this.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
