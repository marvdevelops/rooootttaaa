import { supabase } from '../lib/supabase';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export interface BlockedUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  blockedAt: number;
}

export async function blockUser(blockedId: string): Promise<void> {
  const blockerId = await currentUserId();
  if (!blockerId) throw new Error('You must be signed in to block someone.');
  const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw new Error(error.message);
}

export async function unblockUser(blockedId: string): Promise<void> {
  const blockerId = await currentUserId();
  if (!blockerId) throw new Error('You must be signed in.');
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw new Error(error.message);
}

export async function isUserBlocked(userId: string): Promise<boolean> {
  const blockerId = await currentUserId();
  if (!blockerId) return false;
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', userId)
    .maybeSingle();
  return !!data;
}

/** IDs of everyone the current user has blocked — used to filter feeds/comments client-side. */
export async function listBlockedIds(): Promise<string[]> {
  const blockerId = await currentUserId();
  if (!blockerId) return [];
  const { data, error } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', blockerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.blocked_id);
}

interface BlockRow {
  blocked_id: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
}

export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const blockerId = await currentUserId();
  if (!blockerId) return [];

  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, created_at, profiles!blocked_id(username, avatar_url)')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as BlockRow[];

  return rows.map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.blocked_id,
      username: profile?.username ?? 'unknown',
      avatarUrl: profile?.avatar_url ?? null,
      blockedAt: new Date(row.created_at).getTime(),
    };
  });
}
