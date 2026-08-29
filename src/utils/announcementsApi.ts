import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

/** Timeline posts for a club (owner/admin authored) or an event/race (host authored). */
export interface Announcement {
  id: string;
  body: string;
  createdAt: number;
  authorUsername: string | null;
  /** Public image URLs (club posts only; always [] for event posts). */
  imageUrls: string[];
}

interface Row {
  id: string;
  body: string;
  created_at: string;
  image_paths?: string[] | null;
  author: { username: string | null } | null;
}

const IMAGE_BUCKET = 'route-photos';

function publicUrl(path: string): string {
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function toAnnouncement(r: Row): Announcement {
  return {
    id: r.id,
    body: r.body,
    createdAt: new Date(r.created_at).getTime(),
    authorUsername: r.author?.username ?? null,
    imageUrls: (r.image_paths ?? []).map(publicUrl),
  };
}

const CLUB_SELECT = 'id, body, created_at, image_paths, author:profiles!author_id(username)';
const EVENT_SELECT = 'id, body, created_at, author:profiles!author_id(username)';

const MAX_POST_IMAGES = 3;

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error('Sign in to post an update.');
  return id;
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Resizes + uploads up to 3 images for a club update, returns their storage
 * paths (to store in club_posts.image_paths). Path prefix club-posts/{uid}/…
 * satisfies the route-photos bucket's (foldername)[2] = uid insert check. */
export async function uploadClubPostImages(uris: string[]): Promise<string[]> {
  if (uris.length === 0) return [];
  const userId = await currentUserId();

  let ImageManipulator: typeof import('expo-image-manipulator');
  try {
    ImageManipulator = await import('expo-image-manipulator');
  } catch {
    throw new Error('Image uploads need the latest app update.');
  }

  const paths: string[] = [];
  for (const uri of uris.slice(0, MAX_POST_IMAGES)) {
    const resized = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1400 } }], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!resized.base64) continue;
    const path = `club-posts/${userId}/${generateId()}.jpg`;
    const up = await supabase.storage.from(IMAGE_BUCKET).upload(path, decode(resized.base64), { contentType: 'image/jpeg' });
    if (up.error) throw new Error(up.error.message);
    paths.push(path);
  }
  return paths;
}

// ---- club ----
export async function listClubPosts(clubId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('club_posts')
    .select(CLUB_SELECT)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Row[]).map(toAnnouncement);
}

export async function createClubPost(clubId: string, body: string, imagePaths: string[] = []): Promise<void> {
  const authorId = await currentUserId();
  const { error, data } = await supabase
    .from('club_posts')
    .insert({ club_id: clubId, author_id: authorId, body: body.trim(), image_paths: imagePaths })
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
    .select(EVENT_SELECT)
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
