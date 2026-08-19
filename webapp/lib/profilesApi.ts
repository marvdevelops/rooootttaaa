import { createClient } from './supabase/client';
import { PublicProfile } from './types';

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export async function isUsernameAvailable(username: string, excludingUserId?: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.from('profiles').select('id, username').ilike('username', username);
  if (error) throw new Error(error.message);
  const taken = (data ?? []).some((row) => row.username.toLowerCase() === username.toLowerCase() && row.id !== excludingUserId);
  return !taken;
}

export async function getProfile(userId: string): Promise<PublicProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, bio, avatar_url, created_at, tier')
    .eq('id', userId)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Profile not found.');

  return {
    id: data.id,
    username: data.username,
    bio: data.bio,
    avatarUrl: data.avatar_url,
    createdAt: new Date(data.created_at).getTime(),
    tier: data.tier,
  };
}

export async function updateProfile(patch: { username?: string; bio?: string }): Promise<void> {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('You must be signed in.');

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error(error.message);
}
