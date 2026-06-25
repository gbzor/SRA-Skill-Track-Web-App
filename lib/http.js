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
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return !!host && u.host === host;
  } catch {
    return false;
  }
}
