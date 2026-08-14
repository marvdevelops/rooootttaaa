// Rootah: RevenueCat webhook receiver.
//
// RevenueCat calls this URL whenever a subscriber's entitlement status
// changes (purchase, renewal, cancellation, expiry, billing issue, etc.).
// It updates profiles.tier so the app can read subscription status from
// Supabase without calling RevenueCat directly on every check.
//
// Deploy with:
//   supabase functions deploy revenuecat-webhook
//
// Then set the shared secret (must match what's pasted into RevenueCat's
// webhook config as the Authorization header value):
//   supabase secrets set RC_WEBHOOK_AUTH_HEADER=<your-random-string>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RC_WEBHOOK_AUTH = Deno.env.get('RC_WEBHOOK_AUTH_HEADER')!;

// Events that mean the user is actively subscribed.
const PAID_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION']);

// Events that mean the subscription is over.
const FREE_EVENTS = new Set(['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE']);

serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== RC_WEBHOOK_AUTH) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { event?: { app_user_id?: string; original_app_user_id?: string; type?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // RevenueCat nests the payload under `event` for the standard webhook
  // format — app_user_id here is the Supabase auth user id we pass in via
  // Purchases.configure({ appUserID: session.user.id }) on the client.
  const event = body.event;
  const rcUserId = event?.app_user_id;
  const eventType = event?.type;

  let newTier: 'free' | 'paid' | null = null;
  if (eventType && PAID_EVENTS.has(eventType)) newTier = 'paid';
  else if (eventType && FREE_EVENTS.has(eventType)) newTier = 'free';

  // Unrecognized event types (TRANSFER, SUBSCRIBER_ALIAS, TEST, etc.) are
  // acknowledged with 200 but don't change tier — better to leave state
  // unchanged than guess wrong on an event we don't have explicit rules for.
  if (newTier && rcUserId) {
    const { error } = await supabase
      .from('profiles')
      .update({
        tier: newTier,
        rc_customer_id: event?.original_app_user_id ?? null,
        tier_updated_at: new Date().toISOString(),
      })
      .eq('id', rcUserId);

    if (error) {
      console.error('Failed to update profile tier:', error.message);
      return new Response('Internal error', { status: 500 });
    }
  }

  return new Response('OK', { status: 200 });
});
