import type { Request, RequestHandler } from 'express';
import { AppError } from './error.js';

/**
 * In-memory fixed-window rate limiter. The cooldown starts only on a **successful**
 * (2xx) response, so failed attempts (e.g. 422 when a subject has no source text)
 * don't lock the user out. Within the window it responds `429` with a `Retry-After`
 * header (seconds) so the client can show an accurate countdown.
 *
 * ⚠️ REQUIRES A SINGLE BACKEND INSTANCE. State is per-process (a `Map`): it resets on
 * restart and is NOT shared across instances, so running 2+ replicas multiplies the
 * effective limit (each replica throttles independently). Keep the deploy at one
 * instance. Before scaling horizontally, swap this for a shared-store implementation
 * — Postgres (already available via Supabase) is the preferred backend here; Redis
 * only once there are many high-frequency limiters. The `rateLimit(windowMs, keyFn)`
 * signature is store-agnostic, so call sites won't change.
 */
export function rateLimit(windowMs: number, keyFn: (req: Request) => string): RequestHandler {
  const lastSuccess = new Map<string, number>();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const last = lastSuccess.get(key);

    if (last != null && now - last < windowMs) {
      const retryAfter = Math.ceil((windowMs - (now - last)) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      next(new AppError(429, `Too many requests. Try again in ${retryAfter}s.`));
      return;
    }

    // Record the cooldown only once the request has actually succeeded.
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) lastSuccess.set(key, Date.now());
    });

    // Opportunistic cleanup so the map can't grow unbounded.
    if (lastSuccess.size > 10_000) {
      for (const [k, t] of lastSuccess) if (now - t > windowMs) lastSuccess.delete(k);
    }

    next();
  };
}
