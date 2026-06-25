import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis = null;

const rawUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

if (rawUrl && rawToken) {
  if (!/^https:\/\//i.test(rawUrl)) {
    console.warn('[rate-limit] UPSTASH_REDIS_REST_URL is not a valid https URL — rate limiting disabled');
  } else {
    try {
      redis = new Redis({ url: rawUrl, token: rawToken });
    } catch (e) {
      console.warn('[rate-limit] failed to init Upstash Redis — rate limiting disabled:', e?.message || e);
      redis = null;
    }
  }
} else {
  console.warn('[rate-limit] UPSTASH_REDIS_REST_URL or _TOKEN missing — rate limiting disabled');
}

function make(limit, windowSec) {
  if (!redis) return null;
  try {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      analytics: false,
    });
  } catch {
    return null;
  }
}

const auth = make(5, 60);
const write = make(30, 60);
const read = make(120, 60);

export function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.ip || 'unknown';
}

export async function check(bucket, key) {
  const limiter = { auth, write, read }[bucket];
  if (!limiter) return { success: true };
  try {
    return await limiter.limit(`${bucket}:${key}`);
  } catch {
    // If Upstash is temporarily unreachable, fail-open (don't lock users out).
    return { success: true };
  }
}
