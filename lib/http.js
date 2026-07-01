import { NextResponse } from 'next/server';

const NO_STORE = {
  'cache-control': 'no-store, max-age=0',
  'pragma': 'no-cache',
  'x-content-type-options': 'nosniff',
};

export function json(body, init = {}) {
  const headers = { ...NO_STORE, ...(init.headers || {}) };
  return NextResponse.json(body, { ...init, headers });
}

export function originOk(req) {
  const host = req.headers.get('host');
  if (!host) return false;

  const origin = req.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  // No Origin header (some legitimate same-site requests omit it) — fall
  // back to Referer so a cross-site request that discloses its true origin
  // there can still be caught, instead of being waved through by default.
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  // Neither header present: allow, matching prior behavior for legitimate
  // requests (older browsers, some same-origin navigations) that send neither.
  return true;
}
