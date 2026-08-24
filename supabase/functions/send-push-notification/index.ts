// Rootah: push notification sender for likes, RSVP requests/decisions, and
// club events/join requests. Triggered directly by pg_net-based Postgres
// triggers (see supabase/migrations/0018, 0020, 0027) — NOT Supabase
// Database Webhooks, since this project's `supabase_functions` helper
// schema was never provisioned. Fires on:
//   - route_likes INSERT
//   - group_run_rsvps INSERT (new join request -> notifies the host)
//   - group_run_rsvps UPDATE OF status (host decision -> notifies the requester)
//   - group_runs INSERT with club_id set (new club run -> notifies all active club members)
//   - club_memberships INSERT with status='pending' (private club join request -> notifies admins/owner)
//
// Deploy with:
//   supabase functions deploy send-push-notification --no-verify-jwt
// Then set the shared secret:
//   supabase secrets set PUSH_WEBHOOK_AUTH_HEADER=<your-random-string>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const WEBHOOK_AUTH = Deno.env.get('PUSH_WEBHOOK_AUTH_HEADER')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE';
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

interface NotificationTarget {
  recipientId: string;
  actorId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  /** Which notification_preferences column gates this send. */
  prefColumn: 'likes_enabled' | 'rsvps_enabled';
}

async function buildRouteLikeNotification(record: Record<string, unknown>): Promise<NotificationTarget | null> {
  const routeId = record.route_id as string;
  const actorId = record.user_id as string;

  const { data: route } = await supabase.from('routes').select('owner_id, name').eq('id', routeId).maybeSingle();
  if (!route || route.owner_id === actorId) return null; // self-like, or route gone

  const { data: actor } = await supabase.from('profiles').select('username').eq('id', actorId).maybeSingle();

  return {
    recipientId: route.owner_id,
    actorId,
    title: 'New like',
    body: `${actor?.username ?? 'Someone'} liked your route "${route.name}"`,
    data: { type: 'route_liked', route_id: routeId },
    prefColumn: 'likes_enabled',
  };
}

/** A new join request (always inserted as 'pending') — notifies the host. */
async function buildRsvpRequestNotification(record: Record<string, unknown>): Promise<NotificationTarget | null> {
  const groupRunId = record.group_run_id as string;
  const actorId = record.user_id as string;
  const status = record.status as string;

  // The host's own auto-RSVP (0016) is inserted directly as 'approved' — not a request.
  if (status !== 'pending') return null;

  const { data: run } = await supabase
    .from('group_runs')
    .select('host_id, title')
    .eq('id', groupRunId)
    .maybeSingle();
  if (!run || run.host_id === actorId) return null;

  const { data: actor } = await supabase.from('profiles').select('username').eq('id', actorId).maybeSingle();

  return {
    recipientId: run.host_id,
    actorId,
    title: 'New join request',
    body: `${actor?.username ?? 'Someone'} wants to join "${run.title}"`,
    data: { type: 'group_run_join_request', run_id: groupRunId },
    prefColumn: 'rsvps_enabled',
  };
}

/** The host approved/declined a request — notifies the requester. */
async function buildRsvpDecisionNotification(
  record: Record<string, unknown>,
  oldRecord: Record<string, unknown> | undefined,
): Promise<NotificationTarget | null> {
  const groupRunId = record.group_run_id as string;
  const requesterId = record.user_id as string;
  const status = record.status as string;
  const oldStatus = oldRecord?.status as string | undefined;

  if (status === oldStatus) return null; // no real transition
  if (status !== 'approved' && status !== 'declined') return null;

  const { data: run } = await supabase
    .from('group_runs')
    .select('host_id, title')
    .eq('id', groupRunId)
    .maybeSingle();
  if (!run || run.host_id === requesterId) return null; // shouldn't happen — host row is never updated this way

  return {
    recipientId: requesterId,
    actorId: run.host_id,
    title: status === 'approved' ? "You're in!" : 'Request declined',
    body:
      status === 'approved'
        ? `Your request to join "${run.title}" was approved.`
        : `Your request to join "${run.title}" was declined.`,
    data: { type: 'group_run_rsvp_decision', run_id: groupRunId, status },
    prefColumn: 'rsvps_enabled',
  };
}

interface FanOutNotification {
  recipientIds: string[];
  actorId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  prefColumn: 'club_new_run_enabled' | 'club_join_request_enabled';
}

/** A new group run tagged to a club — notifies every active club member (except the host, who created it). */
async function buildClubNewRunNotification(record: Record<string, unknown>): Promise<FanOutNotification | null> {
  const clubId = record.club_id as string | null;
  if (!clubId) return null;
  const hostId = record.host_id as string;
  const title = record.title as string;

  const { data: club } = await supabase.from('run_clubs').select('name').eq('id', clubId).maybeSingle();
  if (!club) return null;

  const { data: members } = await supabase
    .from('club_memberships')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .neq('user_id', hostId);
  const recipientIds = (members ?? []).map((m) => m.user_id as string);
  if (recipientIds.length === 0) return null;

  return {
    recipientIds,
    actorId: hostId,
    title: 'New club run',
    body: `${club.name} has a new run — ${title}`,
    data: { type: 'club_new_run', run_id: record.id as string, club_id: clubId },
    prefColumn: 'club_new_run_enabled',
  };
}

/** A pending join request on a private club — notifies admins and the owner. */
async function buildClubJoinRequestNotification(record: Record<string, unknown>): Promise<FanOutNotification | null> {
  const clubId = record.club_id as string;
  const requesterId = record.user_id as string;
  const status = record.status as string;
  if (status !== 'pending') return null;

  const { data: club } = await supabase.from('run_clubs').select('name').eq('id', clubId).maybeSingle();
  if (!club) return null;

  const { data: admins } = await supabase
    .from('club_memberships')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .in('role', ['admin', 'owner']);
  const recipientIds = (admins ?? []).map((a) => a.user_id as string).filter((id) => id !== requesterId);
  if (recipientIds.length === 0) return null;

  const { data: requester } = await supabase.from('profiles').select('username').eq('id', requesterId).maybeSingle();

  return {
    recipientIds,
    actorId: requesterId,
    title: 'New join request',
    body: `${requester?.username ?? 'Someone'} wants to join ${club.name}`,
    data: { type: 'club_join_request', club_id: clubId },
    prefColumn: 'club_join_request_enabled',
  };
}

async function isBlocked(recipientId: string, actorId: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', recipientId)
    .eq('blocked_id', actorId)
    .maybeSingle();
  return !!data;
}

async function isPreferenceEnabled(
  userId: string,
  column: NotificationTarget['prefColumn'] | FanOutNotification['prefColumn'],
): Promise<boolean> {
  const { data } = await supabase
    .from('notification_preferences')
    .select(column)
    .eq('user_id', userId)
    .maybeSingle();
  // No row (shouldn't happen — a trigger creates one per profile) defaults to enabled.
  return data ? (data as Record<string, boolean>)[column] !== false : true;
}

/** Populates the in-app notification feed — separate from push delivery, so it still shows even without a registered push token. */
async function insertNotification(
  recipientId: string,
  actorId: string | null,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  await supabase.from('notifications').insert({ recipient_id: recipientId, actor_id: actorId, type, title, body, data });
}

async function sendAndCleanup(recipientId: string, title: string, body: string, data: Record<string, unknown>) {
  const { data: tokens } = await supabase.from('push_tokens').select('id, token').eq('user_id', recipientId);
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title,
    body,
    data,
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error('Expo push send failed:', res.status, await res.text());
    return;
  }

  const { data: tickets } = (await res.json()) as {
    data: { status: 'ok' | 'error'; details?: { error?: string } }[];
  };

  const staleTokenIds = tickets
    .map((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? tokens[i].id : null))
    .filter((id): id is string => id !== null);

  if (staleTokenIds.length > 0) {
    await supabase.from('push_tokens').delete().in('id', staleTokenIds);
  }
}

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== WEBHOOK_AUTH) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (payload.type === 'INSERT' && payload.table === 'group_runs') {
    const fanOut = await buildClubNewRunNotification(payload.record);
    if (fanOut) {
      for (const recipientId of fanOut.recipientIds) {
        if (await isBlocked(recipientId, fanOut.actorId)) continue;
        if (await isPreferenceEnabled(recipientId, fanOut.prefColumn)) {
          await insertNotification(recipientId, fanOut.actorId, fanOut.data.type as string, fanOut.title, fanOut.body, fanOut.data);
          await sendAndCleanup(recipientId, fanOut.title, fanOut.body, fanOut.data);
        }
      }
    }
    return new Response('OK', { status: 200 });
  }

  if (payload.type === 'INSERT' && payload.table === 'club_memberships') {
    const fanOut = await buildClubJoinRequestNotification(payload.record);
    if (fanOut) {
      for (const recipientId of fanOut.recipientIds) {
        if (await isBlocked(recipientId, fanOut.actorId)) continue;
        if (await isPreferenceEnabled(recipientId, fanOut.prefColumn)) {
          await insertNotification(recipientId, fanOut.actorId, fanOut.data.type as string, fanOut.title, fanOut.body, fanOut.data);
          await sendAndCleanup(recipientId, fanOut.title, fanOut.body, fanOut.data);
        }
      }
    }
    return new Response('OK', { status: 200 });
  }

  let target: NotificationTarget | null = null;
  if (payload.type === 'INSERT' && payload.table === 'route_likes') {
    target = await buildRouteLikeNotification(payload.record);
  } else if (payload.type === 'INSERT' && payload.table === 'group_run_rsvps') {
    target = await buildRsvpRequestNotification(payload.record);
  } else if (payload.type === 'UPDATE' && payload.table === 'group_run_rsvps') {
    target = await buildRsvpDecisionNotification(payload.record, payload.old_record);
  }

  if (!target) return new Response('OK', { status: 200 });

  if (await isBlocked(target.recipientId, target.actorId)) {
    return new Response('OK (blocked)', { status: 200 });
  }
  if (!(await isPreferenceEnabled(target.recipientId, target.prefColumn))) {
    return new Response('OK (opted out)', { status: 200 });
  }

  await insertNotification(target.recipientId, target.actorId, target.data.type as string, target.title, target.body, target.data);
  await sendAndCleanup(target.recipientId, target.title, target.body, target.data);
  return new Response('OK', { status: 200 });
});
