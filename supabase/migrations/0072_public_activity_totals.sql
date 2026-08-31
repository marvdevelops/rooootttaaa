-- The public profile page (rootah.com, anon key) wants to show a member's
-- total recorded distance and activity count. 0070 restricted recorded_runs
-- reads to `authenticated`, so expose just the aggregates — never the rows or
-- tracks — through a security-definer RPC that anon can call.

create or replace function public.get_public_activity_totals(p_user_id uuid)
returns table (activity_count integer, total_meters bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    count(*)::integer,
    coalesce(sum(distance_meters), 0)::bigint
  from public.recorded_runs
  where user_id = p_user_id
    and not is_private;
$$;

grant execute on function public.get_public_activity_totals(uuid) to anon, authenticated;
