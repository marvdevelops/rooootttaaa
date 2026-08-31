import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type PurchasesOffering } from 'react-native-purchases';

const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
// Android isn't set up in the Play Console yet (blocked on the closed-testing
// eligibility window) — configure() is skipped on Android until this lands,
// so Purchases calls there fail closed to 'free' rather than crashing.
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

/** The RevenueCat entitlement identifier that unlocks Pro. Must match exactly
 * what's configured in the RevenueCat dashboard (Entitlements tab). If a
 * sandbox purchase completes but the app still shows "free", this is the
 * usual reason — the purchased product isn't attached to an entitlement with
 * this id. Overridable without a rebuild via EAS env in an emergency. */
export const PRO_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';

let configured = false;
// In-flight configure() promise — lets getDefaultOffering()/checkProEntitlement()
// wait out a configuration that's already starting instead of racing ahead of
// it. Without this, opening the paywall right after login (before the
// AuthContext-triggered initRevenueCat() call resolves) always saw
// `configured === false` and showed "Pricing isn't available right now" even
// though the SDK was only a beat away from being ready — this is what Apple
// flagged as a "paywall display error" in review.
let configuringPromise: Promise<void> | null = null;

// Kept for the paywall's diagnostic panel — App Review keeps rejecting on the
// IAP, and a screenshot that says *why* the offering is empty (config failed
// vs. no products vs. offline) is worth far more than a generic error.
let lastConfigureError: string | null = null;
let lastOfferingsError: string | null = null;

function errText(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const anyE = e as { message?: string; code?: string | number; underlyingErrorMessage?: string };
    return [anyE.code != null ? `[${anyE.code}]` : '', anyE.message ?? '', anyE.underlyingErrorMessage ?? '']
      .filter(Boolean)
      .join(' ')
      .trim() || JSON.stringify(e);
  }
  return String(e);
}

export function isRevenueCatAvailable(): boolean {
  return Platform.OS === 'ios' ? !!RC_API_KEY_IOS : !!RC_API_KEY_ANDROID;
}

/** Configures the SDK for the current user. Safe to call multiple times (e.g. on every login) — RevenueCat no-ops if already configured for the same app user id. */
export async function initRevenueCat(supabaseUserId: string): Promise<void> {
  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  if (!apiKey) {
    lastConfigureError = 'No RevenueCat API key in this build';
    return;
  }

  if (configuringPromise) {
    await configuringPromise;
    return;
  }

  if (!configured) {
    configuringPromise = (async () => {
      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      await Purchases.configure({ apiKey, appUserID: supabaseUserId });
      configured = true;
      lastConfigureError = null;
    })();
    try {
      await configuringPromise;
    } catch (e) {
      lastConfigureError = errText(e);
      throw e;
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
    return customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
  } catch {
    return false; // Fail closed — treat as free on any error.
  }
}

export async function getDefaultOffering(): Promise<PurchasesOffering | null> {
  if (!(await ensureConfigured())) return null;
  lastOfferingsError = null;
  // The first getOfferings() after configure() is occasionally slow or comes
  // back empty (StoreKit still spinning up, App Store products not yet
  // cached) — retry a few times before giving up so the paywall doesn't
  // dead-end on a transient miss. This is what Apple review flags when a
  // reviewer opens the paywall a beat after launch.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current && offerings.current.availablePackages.length > 0) {
        return offerings.current;
      }
      // Reachable but unhelpful — record which flavour of empty this is.
      lastOfferingsError = offerings.current
        ? 'Current offering has no available packages (products not approved / not attached to this app version?)'
        : `No current offering set in RevenueCat (offerings returned: ${Object.keys(offerings.all).length})`;
    } catch (e) {
      lastOfferingsError = errText(e);
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  return null;
}

export interface PaywallDiagnostics {
  platform: string;
  hasApiKey: boolean;
  configured: boolean;
  entitlementId: string;
  appUserId: string | null;
  offeringCount: number;
  currentOfferingId: string | null;
  packageCount: number;
  productIds: string[];
  configureError: string | null;
  offeringsError: string | null;
  /** One-line human summary for the paywall's "why can't I see plans" panel. */
  summary: string;
}

/** Everything we can learn about why the paywall might be empty, in one call.
 * Surfaced in the paywall's failure state so a reviewer's screenshot (or a
 * sandbox test) tells us exactly what's misconfigured. */
export async function getPaywallDiagnostics(): Promise<PaywallDiagnostics> {
  const hasApiKey = isRevenueCatAvailable();
  const base: PaywallDiagnostics = {
    platform: Platform.OS,
    hasApiKey,
    configured,
    entitlementId: PRO_ENTITLEMENT_ID,
    appUserId: null,
    offeringCount: 0,
    currentOfferingId: null,
    packageCount: 0,
    productIds: [],
    configureError: lastConfigureError,
    offeringsError: lastOfferingsError,
    summary: '',
  };

  if (!hasApiKey) return { ...base, summary: 'This build has no RevenueCat API key.' };

  await ensureConfigured();
  base.configured = configured;
  if (!configured) {
    return { ...base, summary: base.configureError || 'RevenueCat is not configured yet.' };
  }

  try {
    const info = await Purchases.getCustomerInfo();
    base.appUserId = info.originalAppUserId ?? null;
  } catch (e) {
    base.configureError = base.configureError || errText(e);
  }

  try {
    const offerings = await Purchases.getOfferings();
    base.offeringCount = Object.keys(offerings.all).length;
    base.currentOfferingId = offerings.current?.identifier ?? null;
    const pkgs = offerings.current?.availablePackages ?? [];
    base.packageCount = pkgs.length;
    base.productIds = pkgs.map((p) => p.product.identifier);
  } catch (e) {
    base.offeringsError = errText(e);
  }

  base.summary = base.packageCount > 0
    ? `${base.packageCount} plan(s) available.`
    : base.offeringsError
      || (base.currentOfferingId
        ? `Offering "${base.currentOfferingId}" has no products App Store can sell here.`
        : 'RevenueCat has no "current" offering configured.');

  return base;
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
