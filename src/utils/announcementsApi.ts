import { supabase } from '../lib/supabase';

/** Timeline posts for a club (owner/admin authored) or an event/race (host authored). */
export interface Announcement {
  id: string;
  body: string;
  createdAt: number;
  authorUsername: string | null;
}

interface Row {
  id: string;
  body: string;
  created_at: string;
  author: { username: string | null } | null;
}

function toAnnouncement(r: Row): Announcement {
  return {
    id: r.id,
    body: r.body,
    createdAt: new Date(r.created_at).getTime(),
    authorUsername: r.author?.username ?? null,
  };
}

const SELECT = 'id, body, created_at, author:profiles!author_id(username)';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Sign in to post an update.');
  return id;
}

// ---- club ----
export async function listClubPosts(clubId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('club_posts')
    .select(SELECT)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toAnnouncement);
}

export async function createClubPost(clubId: string, body: string): Promise<void> {
  const authorId = await currentUserId();
  const { error, data } = await supabase
    .from('club_posts')
    .insert({ club_id: clubId, author_id: authorId, body: body.trim() })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to post the update.');
}

export async function deleteClubPost(id: string): Promise<void> {
  const { error } = await supabase.from('club_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---- event / race ----
export async function listEventPosts(groupRunId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('group_run_posts')
    .select(SELECT)
    .eq('group_run_id', groupRunId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toAnnouncement);
}

export async function createEventPost(groupRunId: string, body: string): Promise<void> {
  const authorId = await currentUserId();
  const { error, data } = await supabase
    .from('group_run_posts')
    .insert({ group_run_id: groupRunId, author_id: authorId, body: body.trim() })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to post the update.');
}

export async function deleteEventPost(id: string): Promise<void> {
  const { error } = await supabase.from('group_run_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
