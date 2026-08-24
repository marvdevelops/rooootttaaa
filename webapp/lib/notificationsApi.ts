import { createClient } from './supabase/client';
import { AppNotification } from './types';

interface NotificationRow {
  id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
}

function toNotification(row: NotificationRow): AppNotification {
  const actor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    actorId: row.actor_id,
    actorUsername: actor?.username ?? null,
    actorAvatarUrl: actor?.avatar_url ?? null,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data,
    isRead: !!row.read_at,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function listNotifications(limit = 30): Promise<AppNotification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('notifications')
    .select('id, actor_id, type, title, body, data, read_at, created_at, profiles!actor_id(username, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as NotificationRow[]).map(toNotification);
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (error) throw new Error(error.message);
}
