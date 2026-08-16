import { useAuth } from '../lib/AuthContext';

export type UserTier = 'free' | 'paid';

// Debug-only escape hatch for testing Pro-gated features when RevenueCat
// entitlement state can't be sorted out yet (e.g. a purchase/App-Store-account
// mismatch). Off unless EXPO_PUBLIC_DEBUG_FORCE_PRO is explicitly set to
// 'true' — never on by default, so a build without this var behaves
// identically to before. Remove once real Pro entitlement is confirmed working.
const DEBUG_FORCE_PRO = process.env.EXPO_PUBLIC_DEBUG_FORCE_PRO === 'true';

/**
 * Backed by RevenueCat via AuthContext (initialized on login, refreshed on
 * app foreground and after purchase). Callers depend only on this hook, not
 * on how tier is actually determined.
 */
export function useUserTier(): UserTier {
  const tier = useAuth().tier;
  if (DEBUG_FORCE_PRO) return 'paid';
  return tier;
}
