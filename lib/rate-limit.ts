/**
 * Lightweight in-process rate limiter.
 *
 * Uses a module-level Map so limits are tracked per serverless instance.
 * Good enough to stop individual bad actors — not a substitute for a
 * Redis-backed global limiter, but requires zero extra infrastructure.
 *
 * Usage:
 *   const allowed = rateLimit(`trades:${userId}`, 10, 60_000); // 10/min
 *   if (!allowed) return 429;
 */

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();

// Clean up expired entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (now > entry.resetAt) store.delete(key);
    });
  }, 5 * 60 * 1000);
}

/**
 * Returns true if the request is allowed, false if rate limited.
 *
 * @param key       Unique key, e.g. `trades:${userId}` or `login:${ip}`
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
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
