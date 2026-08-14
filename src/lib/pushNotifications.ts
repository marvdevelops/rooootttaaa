import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Foreground behavior — show a banner + play sound even while the app is
// open, rather than staying silent (expo-notifications' default).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

export async function getSystemPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/** Triggers the OS permission prompt — call only after the user has already agreed via the in-app pre-permission modal. */
export async function requestSystemPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Full registration flow: assumes permission has already been granted.
 * Fetches the Expo push token and upserts it against the signed-in user.
 * Safe to call on every app foreground/login — upsert is a no-op if the
 * token hasn't changed.
 */
export async function registerPushToken(userId: string): Promise<void> {
  if (!Device.isDevice) return; // Simulators/emulators don't get real push tokens.
  if (!PROJECT_ID) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );
  } catch (e) {
    console.warn('Failed to register push token:', e);
  }
}

/** Removes this device's token so it stops receiving pushes — call on sign-out. */
export async function unregisterPushToken(userId: string): Promise<void> {
  if (!Device.isDevice || !PROJECT_ID) return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  } catch {
    // Non-fatal — a leftover token just means one fewer device gets pushes
    // for an account that's no longer signed in on it locally.
  }
}
