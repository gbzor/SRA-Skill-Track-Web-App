import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis = null;

const rawUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

if (rawUrl && rawToken) {
  if (!/^https:\/\//i.test(rawUrl)) {
    console.warn('[rate-limit] UPSTASH_REDIS_REST_URL is not a valid https URL — falling back to in-memory limiting');
  } else {
    try {
      redis = new Redis({ url: rawUrl, token: rawToken });
    } catch (e) {
      console.warn('[rate-limit] failed to init Upstash Redis — falling back to in-memory limiting:', e?.message || e);
      redis = null;
    }
  }
} else {
  console.warn('[rate-limit] UPSTASH_REDIS_REST_URL or _TOKEN missing — falling back to in-memory limiting');
}

const LIMITS = { auth: [5, 60], write: [30, 60], read: [120, 60] };

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

const auth = make(...LIMITS.auth);
const write = make(...LIMITS.write);
const read = make(...LIMITS.read);

// Per-instance fallback: fixed-window counters kept in memory for whenever
// Redis isn't configured or a request to it fails. This does NOT replace
// Upstash — it's not shared across serverless instances or cold starts, so
// a distributed attacker can still get more attempts than the limit implies.
// But it means a single warm instance is never fully unprotected, closing
// the "rate limiting is a total no-op" gap for the common single-attacker case.
const memoryBuckets = new Map(); // `${bucket}:${key}` -> { count, resetAt }
const MEMORY_MAX_ENTRIES = 50_000; // bound worst-case memory use per instance

function checkMemory(bucket, key) {
  const [limit, windowSec] = LIMITS[bucket];
  const now = Date.now();
  const mapKey = `${bucket}:${key}`;
  const entry = memoryBuckets.get(mapKey);

  if (!entry || entry.resetAt <= now) {
    if (memoryBuckets.size >= MEMORY_MAX_ENTRIES) memoryBuckets.clear(); // crude bound, favors availability
    memoryBuckets.set(mapKey, { count: 1, resetAt: now + windowSec * 1000 });
    return { success: true };
  }

  if (entry.count >= limit) return { success: false };
  entry.count += 1;
  return { success: true };
}

export function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.ip || 'unknown';
}

export async function check(bucket, key) {
  const limiter = { auth, write, read }[bucket];
  if (!limiter) return checkMemory(bucket, key);
  try {
    return await limiter.limit(`${bucket}:${key}`);
  } catch {
    // Upstash is configured but temporarily unreachable — degrade to the
    // in-memory limiter rather than failing fully open.
    return checkMemory(bucket, key);
  }
}
