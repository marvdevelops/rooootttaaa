'use client';

import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from './supabase/client';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithGoogle: (next?: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = useCallback(async (next = '/') => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <AuthContext.Provider value={{ session, loading, signInWithPassword, signUp, signInWithGoogle, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
