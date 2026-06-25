import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

function make(limit, windowSec) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    analytics: false,
  });
}

const auth = make(5, 60);
const write = make(30, 60);
const read = make(120, 60);

export function clientIp(req) {
  // Vercel sets x-real-ip and x-forwarded-for; both are trustworthy on the Vercel platform.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.ip || 'unknown';
}

export async function check(bucket, key) {
  const limiter = { auth, write, read }[bucket];
  if (!limiter) return { success: true };
  return limiter.limit(`${bucket}:${key}`);
}
