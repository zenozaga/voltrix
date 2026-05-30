import type { RateLimitOptions } from '../types/index.js';
import type { IRequest, IResponse, Middleware } from '@voltrix/core';
import { MemoryStore } from '../store/memory-store.js';

/**
 * Standard utility to resolve the client IP address from proxy-aware HTTP headers.
 */
export function getClientIp(req: IRequest): string {
  const xForwardedFor = req.header('x-forwarded-for');
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0].trim();
    if (first) return first;
  }
  return req.header('x-real-ip') || req.header('cf-connecting-ip') || '127.0.0.1';
}

// Share a single global MemoryStore instance by default
const defaultStore = new MemoryStore();

/**
 * Hyper-performance Rate Limiter Middleware.
 * Restricts request frequency per IP or custom key dynamically.
 */
export function rateLimit(options?: RateLimitOptions | boolean): Middleware {
  if (options === false) {
    return (req, res, next) => next();
  }

  const opts = typeof options === 'object' ? options : {};
  const windowMs = opts.windowMs ?? 60000;
  const limit = opts.limit ?? 100;
  const store = opts.store ?? defaultStore;
  const keyGenerator = opts.keyGenerator ?? getClientIp;
  const handler = opts.handler ?? ((req, res) => {
    res.status(429).json({ error: 'Too Many Requests' });
  });

  return async (req, res, next) => {
    try {
      const idKey = await keyGenerator(req);
      const storeKey = `voltrix:security:rate-limit:${idKey}`;

      const current = await store.increment(storeKey, windowMs);
      const remaining = Math.max(0, limit - current);
      const resetTimeSec = Math.ceil((Date.now() + windowMs) / 1000);

      // Append standard Rate Limit headers
      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(resetTimeSec));

      if (current > limit) {
        // Exceeded limit: invoke handler and abort pipeline
        const result = handler(req, res);
        if (result instanceof Promise) {
          await result;
        }
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
