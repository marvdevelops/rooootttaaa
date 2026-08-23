'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { deleteGroupRunComment, listGroupRunComments, postGroupRunComment } from '../lib/groupRunCommentsApi';
import { GroupRunComment } from '../lib/types';

interface Props {
  groupRunId: string;
}

function relativeTime(ms: number): string {
  const diffMin = Math.floor((Date.now() - ms) / (1000 * 60));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function GroupRunComments({ groupRunId }: Props) {
  const { session } = useAuth();
  const [comments, setComments] = useState<GroupRunComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<Pick<GroupRunComment, 'id' | 'depth' | 'authorUsername'> | null>(null);
  const [replyBody, setReplyBody] = useState('');

  useEffect(() => {
    listGroupRunComments(groupRunId)
      .then(setComments)
      .finally(() => setLoading(false));
  }, [groupRunId]);

  function countAll(list: GroupRunComment[]): number {
    return list.reduce((sum, c) => sum + 1 + countAll(c.replies), 0);
  }

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    try {
      const comment = await postGroupRunComment(groupRunId, body.trim());
      setComments((c) => [...c, comment]);
      setBody('');
    } finally {
      setPosting(false);
    }
  }

  async function handleReply(parent: Pick<GroupRunComment, 'id' | 'depth'>) {
    if (!replyBody.trim()) return;
    setPosting(true);
    try {
      const comment = await postGroupRunComment(groupRunId, replyBody.trim(), parent);
      setComments((prev) => insertReply(prev, parent.id, comment));
      setReplyTo(null);
      setReplyBody('');
    } finally {
      setPosting(false);
    }
  }

  function insertReply(list: GroupRunComment[], parentId: string, reply: GroupRunComment): GroupRunComment[] {
    return list.map((c) => {
      if (c.id === parentId) return { ...c, replies: [...c.replies, reply] };
      if (c.replies.length > 0) return { ...c, replies: insertReply(c.replies, parentId, reply) };
      return c;
    });
  }

  function removeComment(list: GroupRunComment[], id: string): GroupRunComment[] {
    return list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: removeComment(c.replies, id) }));
  }

  async function handleDelete(id: string) {
    await deleteGroupRunComment(id);
    setComments((prev) => removeComment(prev, id));
  }

  function CommentNode({ comment }: { comment: GroupRunComment }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: 'var(--sheet-bg)',
              color: 'var(--coral)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {comment.authorUsername.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: 'var(--sheet-bg)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
              <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>{comment.authorUsername}</span>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, wordBreak: 'break-word' }}>{comment.body}</p>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--mist)' }}>{relativeTime(comment.createdAt)}</span>
              {session && comment.depth < 2 && (
                <button
                  onClick={() => {
                    setReplyTo({ id: comment.id, depth: comment.depth, authorUsername: comment.authorUsername });
                    setReplyBody('');
                  }}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 700, color: 'var(--coral)', cursor: 'pointer' }}
                >
                  Reply
                </button>
              )}
              {comment.isOwnedByMe && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--stone)', cursor: 'pointer' }}
                >
                  Delete
                </button>
              )}
            </div>

            {replyTo?.id === comment.id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleReply({ id: comment.id, depth: comment.depth });
                }}
                style={{ display: 'flex', gap: 6, marginTop: 8 }}
              >
                <input
                  autoFocus
                  type="text"
                  placeholder={`Reply to ${comment.authorUsername}…`}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  style={{ ...inputStyle, flex: 1, padding: '8px 12px', fontSize: 12.5 }}
                />
                <button type="submit" disabled={posting || !replyBody.trim()} className="builder-toolbar-btn">
                  Post
                </button>
              </form>
            )}

            {comment.replies.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, paddingLeft: 16, borderLeft: '2px solid rgba(0,0,0,.05)' }}>
                {comment.replies.map((reply) => (
                  <CommentNode key={reply.id} comment={reply} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Comments{comments.length > 0 ? ` · ${countAll(comments)}` : ''}
      </span>

      {session ? (
        <form onSubmit={handlePost} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" disabled={posting || !body.trim()} className="discover-run-btn" style={{ width: 'auto', padding: '10px 18px' }}>
            Post
          </button>
        </form>
      ) : (
        <span style={{ fontSize: 12.5, color: 'var(--stone)' }}>Sign in to join the conversation.</span>
      )}

      {loading && <span style={{ fontSize: 13, color: 'var(--stone)' }}>Loading comments…</span>}
      {!loading && comments.length === 0 && <span style={{ fontSize: 13, color: 'var(--stone)' }}>No comments yet — be the first.</span>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {comments.map((comment) => (
          <CommentNode key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '11px 14px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(0,0,0,.1)',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
};
