import { supabase } from '../lib/supabase';

export interface PublicProfile {
  id: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  createdAt: number;
}

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

/** Case-insensitive — `profiles.username` has no citext/lower-index, so this pulls a small candidate set and compares in JS rather than a raw ilike scan. */
export async function isUsernameAvailable(username: string, excludingUserId?: string): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').select('id, username').ilike('username', username);
  if (error) throw new Error(error.message);
  const taken = (data ?? []).some((row) => row.username.toLowerCase() === username.toLowerCase() && row.id !== excludingUserId);
  return !taken;
}

export async function getProfile(userId: string): Promise<PublicProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, bio, avatar_url, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Profile not found.');

  return {
    id: data.id,
    username: data.username,
    bio: data.bio,
    avatarUrl: data.avatar_url,
    createdAt: new Date(data.created_at).getTime(),
  };
}
