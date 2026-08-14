import { GoogleSignin } from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

let configured = false;

export function isGoogleSignInAvailable(): boolean {
  return !!WEB_CLIENT_ID;
}

/** Idempotent — safe to call right before every sign-in attempt instead of threading a one-time init through app startup. */
export function ensureGoogleSignInConfigured(): void {
  if (configured || !WEB_CLIENT_ID) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    ...(IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}),
  });
  configured = true;
}
