import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from './supabase';
import { checkProEntitlement, initRevenueCat, isRevenueCatAvailable, logOutRevenueCat } from './revenuecat';
import { registerPushToken, unregisterPushToken } from './pushNotifications';
import { Profile } from '../types/auth';

export type UserTier = 'free' | 'paid';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  tier: UserTier;
  refreshTier: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithApple: (identityToken: string, suggestedName?: string | null) => Promise<{ error: string | null }>;
  signInWithGoogle: (idToken: string, suggestedName?: string | null) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'username' | 'bio' | 'avatar_url'>>) => Promise<{ error: string | null }>;
  /** True right after a social sign-in creates a brand-new account — Rootah requires a real username, which Apple/Google don't reliably provide. */
  needsUsernameSetup: boolean;
  /** Prefilled from Apple's given name / Google's profile name, if the provider supplied one. Still just a suggestion — must pass the same uniqueness check as anything else. */
  suggestedUsername: string | null;
  completeUsernameSetup: (username: string) => Promise<{ error: string | null }>;
}

/** Supabase sets `created_at` at insert time — if it's within a few seconds of "now", this sign-in just created the account rather than logging into an existing one. */
function isFreshAccount(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 15_000;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<UserTier>('free');
  const [needsUsernameSetup, setNeedsUsernameSetup] = useState(false);
  const [suggestedUsername, setSuggestedUsername] = useState<string | null>(null);
  // Tracks which user id RevenueCat is currently configured/logged in for,
  // so a session refresh for the *same* user doesn't redundantly re-init it.
  const rcUserId = useRef<string | null>(null);
  // Mirrors `session` for the onAuthStateChange closure below, which only
  // runs once (empty-ish dep array) and would otherwise always see the
  // session from its first render rather than the one just signed out of.
  const currentUserId = useRef<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data ?? null);
  }, []);

  // RevenueCat is the source of truth for tier (it reflects the device's
  // actual entitlement state, including edge cases like refunds, faster
  // than waiting on the webhook to land in Supabase). Not a network call
  // on every read — this refreshes the cached `tier` state, and gate
  // checks elsewhere just read that state.
  const refreshTier = useCallback(async () => {
    if (!isRevenueCatAvailable()) return;
    const isPro = await checkProEntitlement();
    setTier(isPro ? 'paid' : 'free');
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      currentUserId.current = data.session?.user.id ?? null;
      setSession(data.session);
      if (data.session) fetchProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const signedOutUserId = currentUserId.current;
      currentUserId.current = nextSession?.user.id ?? null;
      setSession(nextSession);
      if (nextSession) {
        fetchProfile(nextSession.user.id);
      } else {
        setProfile(null);
        setTier('free');
        setNeedsUsernameSetup(false);
        setSuggestedUsername(null);
        rcUserId.current = null;
        logOutRevenueCat();
        if (signedOutUserId) unregisterPushToken(signedOutUserId);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [fetchProfile]);

  useEffect(() => {
    // Re-registers on every login (not just once) — a permission granted in
    // an earlier session, or a device's token rotating, both need this to
    // keep push_tokens current. registerPushToken itself no-ops if the OS
    // permission isn't already granted, so this never triggers a prompt.
    if (session) registerPushToken(session.user.id);
  }, [session]);

  useEffect(() => {
    if (!session || !isRevenueCatAvailable()) return;
    if (rcUserId.current === session.user.id) return;
    rcUserId.current = session.user.id;
    initRevenueCat(session.user.id).then(refreshTier);
  }, [session, refreshTier]);

  useEffect(() => {
    // Catches subscription changes made outside the app (e.g. cancelling
    // via the App Store's own subscription settings) whenever the user
    // comes back to Rootah, not just on login.
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') refreshTier();
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refreshTier]);

  const signUp = useCallback(async (email: string, password: string) => {
    const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: webBaseUrl ? { emailRedirectTo: `${webBaseUrl}/auth/confirmed` } : undefined,
    });
    // If email confirmation is off in Supabase, signUp already returns an
    // active session and onAuthStateChange takes it from here — no need to
    // tell the user to check their inbox. If confirmation is still required
    // (data.session is null), surface that instead.
    return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signInWithApple = useCallback(async (identityToken: string, suggestedName?: string | null) => {
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken });
    if (error) return { error: error.message };
    // onAuthStateChange picks up the new session from here — this just
    // decides whether to route the user through username setup first.
    if (data.user && isFreshAccount(data.user.created_at)) {
      setSuggestedUsername(suggestedName?.trim() || null);
      setNeedsUsernameSetup(true);
    }
    return { error: null };
  }, []);

  const signInWithGoogle = useCallback(async (idToken: string, suggestedName?: string | null) => {
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) return { error: error.message };
    if (data.user && isFreshAccount(data.user.created_at)) {
      setSuggestedUsername(suggestedName?.trim() || null);
      setNeedsUsernameSetup(true);
    }
    return { error: null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const webBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://rootah.com';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${webBaseUrl}/reset-password`,
    });
    // Always report success regardless of the real result — surfacing
    // "no account found" would let someone enumerate registered emails.
    // A genuine delivery failure (bad SMTP config, etc.) is still worth
    // knowing about internally, so it's logged rather than swallowed.
    if (error) console.warn('resetPasswordForEmail error (hidden from user):', error.message);
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!session) return { error: 'Not signed in.' };
    const userId = session.user.id;

    // Storage objects aren't covered by the DB cascade the RPC relies on —
    // clear the user's avatar folder first while the session is still valid.
    try {
      const { data: files } = await supabase.storage.from('avatars').list(userId);
      if (files && files.length > 0) {
        await supabase.storage.from('avatars').remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch {
      // Non-fatal — a leftover, unlinked avatar file isn't worth blocking account deletion over.
    }

    const { error } = await supabase.rpc('delete_own_account');
    if (error) return { error: error.message };

    await supabase.auth.signOut();
    return { error: null };
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (session) await fetchProfile(session.user.id);
  }, [session, fetchProfile]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, 'username' | 'bio' | 'avatar_url'>>) => {
      if (!session) return { error: 'Not signed in.' };
      // .select() forces PostgREST to return the updated row so a silently
      // RLS-blocked update (0 rows affected, no SQL error) is detectable —
      // without it, .update() alone returns success even when nothing changed.
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', session.user.id)
        .select()
        .maybeSingle();
      if (error) {
        if (error.code === '23505') return { error: 'That username is already taken — try another.' };
        return { error: error.message };
      }
      if (!data) return { error: 'Profile update did not apply — please try again.' };
      setProfile(data);
      return { error: null };
    },
    [session],
  );

  const completeUsernameSetup = useCallback(
    async (username: string) => {
      const result = await updateProfile({ username });
      if (!result.error) {
        setNeedsUsernameSetup(false);
        setSuggestedUsername(null);
      }
      return result;
    },
    [updateProfile],
  );

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      tier,
      refreshTier,
      signUp,
      signIn,
      signInWithApple,
      signInWithGoogle,
      resetPassword,
      signOut,
      deleteAccount,
      refreshProfile,
      updateProfile,
      needsUsernameSetup,
      suggestedUsername,
      completeUsernameSetup,
    }),
    [
      session,
      profile,
      loading,
      tier,
      refreshTier,
      signUp,
      signIn,
      signInWithApple,
      signInWithGoogle,
      resetPassword,
      signOut,
      deleteAccount,
      refreshProfile,
      updateProfile,
      needsUsernameSetup,
      suggestedUsername,
      completeUsernameSetup,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
