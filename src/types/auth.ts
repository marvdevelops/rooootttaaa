export interface Profile {
  id: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  city: string | null;
  created_at: string;
  /** Mirrors RevenueCat entitlement via webhook, but also doubles as a manual
   * override for accounts (e.g. the official Rootah account) that aren't
   * real App Store purchasers — see `tier` in AuthContext. */
  tier: 'free' | 'paid';
}
