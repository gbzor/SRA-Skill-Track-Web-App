import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { check, clientIp } from './lib/rate-limit';

const { auth } = NextAuth(authConfig);

// style-src keeps 'unsafe-inline': this app sets React inline `style={{...}}`
// props everywhere, which the browser treats as inline style ATTRIBUTES
// (style-src-attr) — a surface CSP nonces cannot cover (nonce/hash sources
// only apply to <script>/<style> elements, not attributes), so removing
// 'unsafe-inline' there would break every page's layout, not just close a gap.
function cspFor(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ');
}

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const path = nextUrl.pathname;
  const method = req.method;

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = cspFor(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  // Rate-limit the actual credentials callback (where login is submitted).
  if (path === '/api/auth/callback/credentials' && method === 'POST') {
    const rl = await check('auth', clientIp(req));
    if (!rl.success) {
      return new Response(JSON.stringify({ error: 'too many requests' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'Content-Security-Policy': csp },
      });
    }
  }

  const isPublic =
    path === '/login' ||
    path === '/register' ||
    path.startsWith('/api/auth') ||
    path.startsWith('/_next') ||
    path === '/favicon.ico';

  if (path.startsWith('/api/reports') && !isLoggedIn) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'Content-Security-Policy': csp },
    });
  }

  if (!isPublic && !isLoggedIn) {
    const url = new URL('/login', nextUrl.origin);
    url.searchParams.set('next', path);
    const res = NextResponse.redirect(url);
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
