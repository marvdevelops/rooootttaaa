import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export type FlybyAccessMode = 'free_all' | 'pro_only' | 'free_limited';

const CACHE_KEY = 'rootah_app_config_flyby_access_mode';

/** Cached on-device so the gate check never blocks on network; refreshed on app foreground (see useFlybyAccess). Defaults to the most permissive mode if never fetched — never accidentally locks the feature out due to a network hiccup. */
export async function getCachedFlybyAccessMode(): Promise<FlybyAccessMode> {
  const cached = await AsyncStorage.getItem(CACHE_KEY);
  return (cached as FlybyAccessMode | null) ?? 'free_all';
}

export async function refreshFlybyAccessMode(): Promise<FlybyAccessMode> {
  try {
    const { data, error } = await supabase.from('app_config').select('value').eq('key', 'flyby_access_mode').maybeSingle();
    if (error || !data) return getCachedFlybyAccessMode();
    const mode = data.value as FlybyAccessMode;
    await AsyncStorage.setItem(CACHE_KEY, mode);
    return mode;
  } catch {
    return getCachedFlybyAccessMode();
  }
}

const TRIAL_DAYS_CACHE_KEY = 'rootah_app_config_paywall_trial_days';

/**
 * Display-only override for the paywall's free-trial length. RevenueCat's
 * introPrice metadata sometimes lags Apple's real purchase sheet (e.g. sheet
 * says "2-week free trial" while the SDK still reports 1 week). Set
 * app_config.paywall_trial_days to '14' from SQL to force the copy; '0' (the
 * default) means trust the store. Cached so a network hiccup never changes
 * what the paywall says between reads.
 */
export async function getPaywallTrialDaysOverride(): Promise<number> {
  try {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'paywall_trial_days').maybeSingle();
    const n = data ? parseInt(data.value, 10) : NaN;
    if (Number.isFinite(n) && n > 0) {
      await AsyncStorage.setItem(TRIAL_DAYS_CACHE_KEY, String(n));
      return n;
    }
    if (data) await AsyncStorage.removeItem(TRIAL_DAYS_CACHE_KEY);
    return 0;
  } catch {
    const cached = await AsyncStorage.getItem(TRIAL_DAYS_CACHE_KEY);
    const n = cached ? parseInt(cached, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
}
