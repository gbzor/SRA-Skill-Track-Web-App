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

// Every JSON payload this app accepts is a small flat object (a few hundred
// bytes at most), so a 16 KB ceiling rejects hostile oversized/deeply-nested
// bodies before we spend memory or CPU parsing them, without ever tripping on
// a legitimate request. Platform limits still apply on top — this is
// defense-in-depth at the app layer. Returns { data } on success, or
// { error, status } to hand straight to json().
const MAX_BODY_BYTES = 16 * 1024;

export async function readJson(req) {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { error: 'payload too large', status: 413 };
  }
  let text;
  try {
    text = await req.text();
  } catch {
    return { error: 'invalid body', status: 400 };
  }
  // Re-check after reading: content-length can be absent (chunked) or lie.
  if (text.length > MAX_BODY_BYTES) return { error: 'payload too large', status: 413 };
  try {
    return { data: JSON.parse(text) };
  } catch {
    return { error: 'invalid json', status: 400 };
  }
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
