import { supabase } from '../lib/supabase';
import { GroupRunComment } from '../types/route';
import { listBlockedIds } from './blocksApi';

const MAX_DEPTH = 2;

interface GroupRunCommentRow {
  id: string;
  group_run_id: string;
  author_id: string;
  parent_comment_id: string | null;
  depth: number;
  body: string;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
}

const COMMENT_SELECT = '*, profiles!author_id(username, avatar_url)';

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function toComment(row: GroupRunCommentRow, viewerId: string | null): GroupRunComment {
  const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    groupRunId: row.group_run_id,
    authorId: row.author_id,
    authorUsername: author?.username ?? 'unknown',
    authorAvatarUrl: author?.avatar_url ?? null,
    parentCommentId: row.parent_comment_id,
    depth: row.depth,
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
    isOwnedByMe: row.author_id === viewerId,
    replies: [],
  };
}

/** Nests a flat, created_at-ascending list of comments into a reply tree. */
function buildCommentTree(comments: GroupRunComment[]): GroupRunComment[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const roots: GroupRunComment[] = [];

  for (const comment of comments) {
    if (comment.parentCommentId) {
      const parent = byId.get(comment.parentCommentId);
      if (parent) {
        parent.replies.push(comment);
        continue;
      }
    }
    roots.push(comment);
  }

  return roots;
}

/** All comments for a group run, nested into a reply tree (oldest first at every level). */
export async function listGroupRunComments(groupRunId: string): Promise<GroupRunComment[]> {
  const [viewerId, blockedIds] = await Promise.all([currentUserId(), listBlockedIds()]);

  const { data, error } = await supabase
    .from('group_run_comments')
    .select(COMMENT_SELECT)
    .eq('group_run_id', groupRunId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as GroupRunCommentRow[];
  const blocked = new Set(blockedIds);
  const visible = rows.filter((row) => !blocked.has(row.author_id));
  return buildCommentTree(visible.map((row) => toComment(row, viewerId)));
}

export async function postGroupRunComment(
  groupRunId: string,
  body: string,
  parent?: Pick<GroupRunComment, 'id' | 'depth'>,
): Promise<GroupRunComment> {
  const authorId = await currentUserId();
  if (!authorId) throw new Error('You must be signed in to comment.');
  if (parent && parent.depth >= MAX_DEPTH) throw new Error('Replies can only go 3 levels deep.');

  const { data, error } = await supabase
    .from('group_run_comments')
    .insert({
      group_run_id: groupRunId,
      author_id: authorId,
      parent_comment_id: parent?.id ?? null,
      depth: parent ? parent.depth + 1 : 0,
      body,
    })
    .select(COMMENT_SELECT)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to post comment.');
  return toComment(data as unknown as GroupRunCommentRow, authorId);
}

export async function deleteGroupRunComment(id: string): Promise<void> {
  const { error } = await supabase.from('group_run_comments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
