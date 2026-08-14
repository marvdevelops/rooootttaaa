import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSystemPermissionStatus } from './pushNotifications';

const LAST_PROMPTED_KEY = 'rootah_notif_pre_permission_last_prompted_v1';
const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** True only at a moment worth interrupting for: the OS hasn't been asked yet (or last declined our in-app ask 7+ days ago), and the user hasn't already granted/denied at the system level. */
export async function shouldShowPrePermissionModal(): Promise<boolean> {
  const status = await getSystemPermissionStatus();
  // Already decided at the OS level — 'granted' needs no further asking,
  // and iOS never re-shows its own prompt once 'denied', so re-asking here
  // would just be a dead end (the Profile settings banner covers that case).
  if (status === 'granted' || status === 'denied') return false;

  const lastPromptedRaw = await AsyncStorage.getItem(LAST_PROMPTED_KEY);
  if (!lastPromptedRaw) return true;
  return Date.now() - Number(lastPromptedRaw) > RETRY_AFTER_MS;
}

export async function markPrePermissionPrompted(): Promise<void> {
  await AsyncStorage.setItem(LAST_PROMPTED_KEY, String(Date.now()));
}
