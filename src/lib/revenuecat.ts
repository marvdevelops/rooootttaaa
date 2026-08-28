import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type PurchasesOffering } from 'react-native-purchases';

const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
// Android isn't set up in the Play Console yet (blocked on the closed-testing
// eligibility window) — configure() is skipped on Android until this lands,
// so Purchases calls there fail closed to 'free' rather than crashing.
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

let configured = false;
// In-flight configure() promise — lets getDefaultOffering()/checkProEntitlement()
// wait out a configuration that's already starting instead of racing ahead of
// it. Without this, opening the paywall right after login (before the
// AuthContext-triggered initRevenueCat() call resolves) always saw
// `configured === false` and showed "Pricing isn't available right now" even
// though the SDK was only a beat away from being ready — this is what Apple
// flagged as a "paywall display error" in review.
let configuringPromise: Promise<void> | null = null;

export function isRevenueCatAvailable(): boolean {
  return Platform.OS === 'ios' ? !!RC_API_KEY_IOS : !!RC_API_KEY_ANDROID;
}

/** Configures the SDK for the current user. Safe to call multiple times (e.g. on every login) — RevenueCat no-ops if already configured for the same app user id. */
export async function initRevenueCat(supabaseUserId: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (!apiKey) return;

  if (configuringPromise) {
    await configuringPromise;
    return;
  }

  if (!configured) {
    configuringPromise = (async () => {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      await Purchases.configure({ apiKey, appUserID: supabaseUserId });
      configured = true;
    })();
    try {
      await configuringPromise;
    } finally {
      configuringPromise = null;
    }
  } else {
    // Switches the SDK's identity if a different user logs in on the same
    // device without the app restarting (e.g. sign out, sign in as someone else).
    await Purchases.logIn(supabaseUserId);
  }
}

/** Waits out an in-flight configure() call before reporting readiness, instead of racing ahead of it. */
async function ensureConfigured(): Promise<boolean> {
  if (configuringPromise) await configuringPromise;
  return configured;
}

export async function checkProEntitlement(): Promise<boolean> {
  if (!(await ensureConfigured())) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['pro'] !== undefined;
  } catch {
    return false; // Fail closed — treat as free on any error.
  }
}

export async function getDefaultOffering(): Promise<PurchasesOffering | null> {
  if (!(await ensureConfigured())) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

export async function logOutRevenueCat(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Non-fatal — RevenueCat throws if already logged out (anonymous), which
    // can legitimately happen if this is called twice in a row.
  }
}
