-- SECURITY FIX: profiles.tier / rc_customer_id / tier_updated_at had no write
-- protection beyond the row-level "users can update their own profile" policy
-- (0008 assumed "nothing client-side writes these columns" — an assumption,
-- not an enforcement). Any authenticated user could self-grant Rootah Pro:
--   update public.profiles set tier = 'paid' where id = auth.uid();
--
-- These columns are only ever set by the RevenueCat webhook Edge Function
-- (service_role). This trigger rejects changes to them from the API roles
-- (authenticated / anon) while leaving service_role, postgres and internal
-- roles free to manage them. NOT security-definer, so current_user reflects
-- the real request role.

create or replace function public.prevent_subscription_tier_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (
       new.tier is distinct from old.tier
       or new.rc_customer_id is distinct from old.rc_customer_id
       or new.tier_updated_at is distinct from old.tier_updated_at
     )
  then
    raise exception 'subscription tier columns are managed by billing and cannot be changed here'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_subscription_tier on public.profiles;
create trigger profiles_protect_subscription_tier
  before update on public.profiles
  for each row execute function public.prevent_subscription_tier_tampering();
