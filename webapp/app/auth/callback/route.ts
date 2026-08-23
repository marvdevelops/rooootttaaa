import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

/** Exchanges the OAuth/email-confirmation code for a session, then redirects into the app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // Railway (and most reverse proxies) terminate TLS at the edge and forward
  // to the container over plain HTTP, so `origin` derived from the raw
  // request can resolve to an internal host instead of app.rootah.com —
  // redirecting there drops the session cookie entirely, which is exactly
  // "signed in with Google, bounced to the homepage, still logged out".
  // x-forwarded-host/proto carry the real public origin the browser is on.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';
  const redirectOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
    return NextResponse.redirect(`${redirectOrigin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${redirectOrigin}/login?error=missing_code`);
}
