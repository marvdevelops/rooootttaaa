import { createClient } from './supabase/client';
import { BlockedUser } from './types';

async function currentUserId(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function unblockUser(blockedId: string): Promise<void> {
  const supabase = createClient();
  const blockerId = await currentUserId();
  if (!blockerId) throw new Error('You must be signed in.');
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
  if (error) throw new Error(error.message);
}

interface BlockRow {
  blocked_id: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
}

export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const supabase = createClient();
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
