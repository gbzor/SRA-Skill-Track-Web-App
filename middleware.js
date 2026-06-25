import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { check, clientIp } from './lib/rate-limit';

const { auth } = NextAuth(authConfig);

export default auth(async (req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const path = nextUrl.pathname;
  const method = req.method;

  // Rate-limit the actual credentials callback (where login is submitted).
  if (path === '/api/auth/callback/credentials' && method === 'POST') {
    const rl = await check('auth', clientIp(req));
    if (!rl.success) {
      return new Response(JSON.stringify({ error: 'too many requests' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
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
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  if (!isPublic && !isLoggedIn) {
    const url = new URL('/login', nextUrl.origin);
    url.searchParams.set('next', path);
    return Response.redirect(url);
  }

  return undefined;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
