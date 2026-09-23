// Fixed-window in-memory limiter. Fine for a single long-running server.
// On serverless platforms each instance keeps its own counters, so treat it as
// best-effort there and put a shared store (Upstash/Redis, Vercel KV) behind it
// if you need hard limits.
export class RateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
    const sweep = setInterval(() => this.sweep(), Math.min(windowMs, 60_000));
    sweep.unref?.();
  }

  /** Records a hit. Returns { allowed, retryAfterSec }. */
  hit(key, now = Date.now()) {
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= this.limit,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  sweep(now = Date.now()) {
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}
