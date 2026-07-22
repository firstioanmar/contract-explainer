interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const REQUEST_LIMIT = 5;

const globalRateLimit = globalThis as typeof globalThis & {
  contractRateLimitStore?: Map<string, RateLimitRecord>;
};

const store = globalRateLimit.contractRateLimitStore ?? new Map<string, RateLimitRecord>();
globalRateLimit.contractRateLimitStore = store;

export function getClientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}

export function checkRateLimit(key: string, now = Date.now()) {
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, next);
    return { allowed: true, remaining: REQUEST_LIMIT - 1, resetAt: next.resetAt };
  }

  if (current.count >= REQUEST_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { allowed: true, remaining: REQUEST_LIMIT - current.count, resetAt: current.resetAt };
}

export function rateLimitHeaders(result: ReturnType<typeof checkRateLimit>) {
  return {
    "X-RateLimit-Limit": String(REQUEST_LIMIT),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
