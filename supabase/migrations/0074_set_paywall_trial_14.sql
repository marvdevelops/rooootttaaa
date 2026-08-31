-- Apple's own purchase sheet confirms the Rootah Pro annual trial is 14 days,
-- but RevenueCat's cached introPrice metadata is still reporting 1 week, so
-- the paywall copy is wrong. Force the display to "2 weeks" until RC's product
-- metadata catches up (then set this back to '0').

update public.app_config set value = '14', updated_at = now() where key = 'paywall_trial_days';
insert into public.app_config (key, value) values ('paywall_trial_days', '14')
on conflict (key) do update set value = excluded.value, updated_at = now();
