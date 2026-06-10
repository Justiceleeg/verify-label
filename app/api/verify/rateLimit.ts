// Per-IP token bucket, in memory. Per-instance state is fine for the demo
// (docs/ARCHITECTURE.md "Abuse protection"); the provider-console spending
// cap is the backstop.

export interface RateLimiter {
  /** True if the request identified by `key` may proceed. */
  allow(key: string): boolean;
}

interface Bucket {
  tokens: number;
  /** Timestamp (ms) of the last refill. */
  refilledAt: number;
}

export interface TokenBucketOptions {
  /** Burst size. Default 20 — covers a batch client at concurrency 8. */
  capacity?: number;
  /** Sustained rate. Default 5/s — above the batch client's ~2–3 req/s,
   * far below what would run up a real bill. */
  refillPerSecond?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
}

/** Buckets at full capacity carry no state, so they are evicted on sweep. */
const MAX_KEYS = 10_000;

export function createTokenBucketLimiter(
  options: TokenBucketOptions = {},
): RateLimiter {
  const capacity = options.capacity ?? 20;
  const refillPerSecond = options.refillPerSecond ?? 5;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  function refill(bucket: Bucket, at: number): void {
    const elapsed = (at - bucket.refilledAt) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
    bucket.refilledAt = at;
  }

  return {
    allow(key: string): boolean {
      const at = now();

      if (buckets.size >= MAX_KEYS) {
        for (const [k, bucket] of buckets) {
          refill(bucket, at);
          if (bucket.tokens >= capacity) buckets.delete(k);
        }
      }

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: capacity, refilledAt: at };
        buckets.set(key, bucket);
      } else {
        refill(bucket, at);
      }

      if (bucket.tokens < 1) return false;
      bucket.tokens -= 1;
      return true;
    },
  };
}
