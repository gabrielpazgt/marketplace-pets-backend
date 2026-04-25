/**
 * In-memory sliding-window rate limiter for sensitive endpoints.
 * Resets on server restart — intentional for the test environment.
 * Replace with Redis-backed solution (koa-ratelimit) before heavy traffic.
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

function getKey(ip: string, bucket: string): string {
  return `${bucket}:${ip}`;
}

function isAllowed(ip: string, bucket: string, maxRequests: number, windowMs: number): boolean {
  const key = getKey(ip, bucket);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Prune stale entries every 5 minutes so the map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

type RateLimitRule = {
  prefix: string;
  maxRequests: number;
  windowMs: number;
};

const RULES: RateLimitRule[] = [
  // Auth: login and register — 10 attempts per minute per IP
  { prefix: '/api/auth/local', maxRequests: 10, windowMs: 60_000 },
  // Password reset request — 5 per minute
  { prefix: '/api/auth/forgot-password', maxRequests: 5, windowMs: 60_000 },
  // Guest checkout — 15 per 5 minutes
  { prefix: '/api/storefront/guest/checkout', maxRequests: 15, windowMs: 5 * 60_000 },
  // Authenticated checkout — 20 per 5 minutes
  { prefix: '/api/storefront/me/checkout', maxRequests: 20, windowMs: 5 * 60_000 },
];

export default (_config: unknown, _ctx: unknown) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const path: string = ctx.path || '';

    const ip: string =
      ctx.request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      ctx.request.ip ||
      'unknown';

    const rule = RULES.find(r => path.startsWith(r.prefix));

    if (rule) {
      const bucket = rule.prefix;
      if (!isAllowed(ip, bucket, rule.maxRequests, rule.windowMs)) {
        ctx.status = 429;
        ctx.body = {
          error: {
            status: 429,
            name: 'TooManyRequests',
            message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.',
          },
        };
        return;
      }
    }

    await next();
  };
};
