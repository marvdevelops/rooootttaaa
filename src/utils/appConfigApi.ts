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
