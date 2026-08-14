import { useAuth } from '../lib/AuthContext';

export type UserTier = 'free' | 'paid';

/**
 * Backed by RevenueCat via AuthContext (initialized on login, refreshed on
 * app foreground and after purchase). Callers depend only on this hook, not
 * on how tier is actually determined.
 */
export function useUserTier(): UserTier {
  return useAuth().tier;
}
