// Minimal in-memory rate limiter. Good enough to blunt brute-force and
// accidental retry storms; resets on cold start. For high-traffic
// production use, swap this for Upstash Redis (you already use Upstash
// on Rezquo) — same interface, just backed by a real store.

const buckets = new Map();

export function rateLimit(key, { max = 20, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { allowed: true, remaining: max - 1 };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: max - entry.count };
}

export function tooManyRequests() {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: { "content-type": "application/json" },
  });
}
