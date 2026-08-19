'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { hasCompletedRoute, logRouteCompletion } from '../lib/completionsApi';
import { listGroupRunsForRoute } from '../lib/groupRunsApi';
import { canReviewRoute, listRouteReviews, upsertReview } from '../lib/reviewsApi';
import { GroupRun, RouteReview } from '../lib/types';

interface Props {
  routeId: string;
  onLogged: () => void;
}

export default function RouteSocial({ routeId, onLogged }: Props) {
  const { session } = useAuth();
  const [logged, setLogged] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviews, setReviews] = useState<RouteReview[]>([]);
  const [groupRuns, setGroupRuns] = useState<GroupRun[]>([]);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    hasCompletedRoute(routeId).then(setLogged);
    canReviewRoute(routeId).then(setCanReview);
  }, [routeId, session]);

  useEffect(() => {
    listRouteReviews(routeId).then(setReviews);
    listGroupRunsForRoute(routeId).then(setGroupRuns);
  }, [routeId]);

  async function handleLogRun() {
    setBusy(true);
    try {
      await logRouteCompletion(routeId);
      setLogged(true);
      setCanReview(true);
      onLogged();
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;
    setBusy(true);
    try {
      const review = await upsertReview({ routeId, rating, body });
      setReviews((prev) => [review, ...prev.filter((r) => r.id !== review.id)]);
      setRating(0);
      setBody('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {session && !logged && (
        <button onClick={handleLogRun} disabled={busy} style={primaryBtnStyle}>
          I ran this
        </button>
      )}
      {logged && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sage)' }}>✓ Logged today</span>}

      {groupRuns.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>Upcoming group runs</h2>
          {groupRuns.map((run) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface)',
                boxShadow: 'var(--elevation-subtle)',
                fontSize: 13,
              }}
            >
              <strong>{run.title}</strong>
              <div style={{ color: 'var(--stone)', marginTop: 2 }}>{new Date(run.scheduledAt).toLocaleString()}</div>
            </Link>
          ))}
        </section>
      )}

      <Link
        href={`/runs/new?routeId=${routeId}`}
        style={{ fontSize: 13, fontWeight: 700, color: 'var(--coral)' }}
      >
        + Schedule a group run
      </Link>

      {canReview && (
        <form onSubmit={handleSubmitReview} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>Leave a review</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: n <= rating ? 'var(--amber)' : 'var(--mist)' }}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            placeholder="How was it? (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(0,0,0,.1)',
              fontFamily: 'inherit',
              fontSize: 13,
              resize: 'vertical',
            }}
          />
          <button type="submit" disabled={busy || rating === 0} style={{ ...primaryBtnStyle, opacity: rating === 0 ? 0.5 : 1 }}>
            Submit review
          </button>
        </form>
      )}

      {reviews.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800 }}>Reviews</h2>
          {reviews.map((review) => (
            <div key={review.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ fontSize: 13 }}>{review.username}</strong>
                <span style={{ color: 'var(--amber)', fontSize: 12 }}>{'★'.repeat(review.rating)}</span>
              </div>
              {review.body && <p style={{ fontSize: 13, color: 'var(--stone)', margin: 0 }}>{review.body}</p>}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '11px 18px',
  borderRadius: 'var(--radius-pill)',
  border: 'none',
  background: 'var(--coral)',
  color: 'var(--white)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  boxShadow: 'var(--elevation-primary-btn)',
};
