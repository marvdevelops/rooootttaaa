/**
 * Rootah's official account — the sole account allowed to create races
 * (docs/race-mode-plan.md), and now also given an admin/moderation
 * override: it can edit or delete any content regardless of who owns it.
 * Matches OFFICIAL_ACCOUNT_ID in scripts/createRace.ts and
 * is_official_account() in supabase/migrations/0055_official_account_admin_override.sql
 * — keep all three in sync if this ever changes.
 */
export const OFFICIAL_ACCOUNT_ID = 'f9808b4f-125a-4841-bf5e-b244d9f6cf1f';
