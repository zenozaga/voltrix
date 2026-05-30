import type { CorsOptions } from '../types/index.js';
import type { Middleware } from '@voltrix/core';

/**
 * Hyper-performance CORS Middleware.
 * Captures, processes, and validates cross-origin accesses.
 * Short-circuits preflight OPTIONS requests immediately to prevent them from reaching app-level routers.
 */
export function cors(options?: CorsOptions | boolean): Middleware {
  if (options === false) {
    return (req, res, next) => next();
  }

  const opts = typeof options === 'object' ? options : {};
  
  // Pre-normalize standard methods and headers configurations
  const methods = Array.isArray(opts.methods) ? opts.methods.join(', ') : opts.methods ?? 'GET,HEAD,PUT,PATCH,POST,DELETE';
  const allowedHeaders = Array.isArray(opts.allowedHeaders) ? opts.allowedHeaders.join(', ') : opts.allowedHeaders;
  const exposedHeaders = Array.isArray(opts.exposedHeaders) ? opts.exposedHeaders.join(', ') : opts.exposedHeaders;
  const maxAge = opts.maxAge !== undefined ? String(opts.maxAge) : undefined;

  return async (req, res, next) => {
    const origin = req.header('origin');
    if (!origin) {
      return next();
    }

    let isAllowed = false;
    if (!opts.origin || opts.origin === '*') {
      isAllowed = true;
    } else if (typeof opts.origin === 'string') {
      isAllowed = origin === opts.origin;
    } else if (Array.isArray(opts.origin)) {
      isAllowed = opts.origin.includes(origin);
    } else if (typeof opts.origin === 'function') {
      try {
        const resVal = opts.origin(origin);
        isAllowed = resVal instanceof Promise ? await resVal : resVal;
      } catch {
        isAllowed = false;
      }
    }

    if (!isAllowed) {
      return next();
    }

    // Set standard CORS origin response headers
    res.setHeader('Access-Control-Allow-Origin', opts.origin === '*' && !opts.credentials ? '*' : origin);

    if (opts.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (exposedHeaders) {
      res.setHeader('Access-Control-Expose-Headers', exposedHeaders);
    }

    // ─── Preflight OPTIONS Intercept ─────────────────────────────────────────
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', methods);
      
      const reqHeaders = req.header('access-control-request-headers');
      if (allowedHeaders) {
        res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
      } else if (reqHeaders) {
        res.setHeader('Access-Control-Allow-Headers', reqHeaders);
      }

      if (maxAge) {
        res.setHeader('Access-Control-Max-Age', maxAge);
      }

      // Short-circuit: complete Preflight immediately (204 No Content)
      res.status(204).end();
      return;
    }

    next();
  };
}
