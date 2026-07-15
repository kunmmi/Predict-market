/**
 * Global rate limiter backed by Upstash Redis.
 *
 * Uses a fixed-window counter: INCR + PEXPIRE per (key, window) bucket.
 * Because the counter lives in Redis, all serverless instances share the
 * same count — a single user can't bypass the limit by hitting different
 * warm instances.
 *
 * Falls back to an in-process Map when UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN are not set (local dev without Redis).
 *
 * Usage (all callers must await):
 *   if (!await rateLimit(`trades:${userId}`, 10, 60_000)) return 429;
 */

import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Redis client (lazy singleton — only created when env vars are present)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

// ---------------------------------------------------------------------------
// In-memory fallback (single-instance, local dev only)
// ---------------------------------------------------------------------------

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (now > entry.resetAt) store.delete(key);
    });
  }, 5 * 60 * 1000);
}

function inMemoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now   = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the request is within the rate limit, false if exceeded.
 *
 * @param key       Unique key, e.g. `trades:${userId}` or `login:${ip}`
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window size in milliseconds
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redis = getRedis();

  if (!redis) {
    return inMemoryRateLimit(key, limit, windowMs);
  }

  // Fixed-window bucket: one key per (key, window-slot) pair.
  const slot      = Math.floor(Date.now() / windowMs);
  const redisKey  = `rl:${key}:${slot}`;

  try {
    const count = await redis.incr(redisKey);
    // Set TTL only on the first increment so the key auto-expires.
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    return count <= limit;
  } catch (err) {
    // Redis unavailable — fail open to avoid blocking all traffic.
    console.warn("[rate-limit] Redis error, falling back to allow:", err);
    return true;
  }
}

/** Pre-built 429 response */
export function rateLimitResponse(message = "Too many requests. Please slow down.") {
  return new Response(
    JSON.stringify({ success: false, message }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "60" },
    },
  );
}
