import type { HelmetOptions } from '../types/index.js';
import type { Middleware } from '@voltrix/core';

/**
 * Hyper-optimized, pre-baked Security Headers Middleware.
 * Compiles static headers at startup into a frozen, flat array to achieve zero-overhead O(1) header writing.
 */
export function helmet(options?: HelmetOptions | boolean): Middleware {
  if (options === false) {
    return (req, res, next) => next();
  }

  const opts = typeof options === 'object' ? options : {};
  const headers: Record<string, string> = {};

  // 1. Content-Security-Policy (CSP)
  if (opts.csp !== false) {
    if (typeof opts.csp === 'object') {
      const directives = Object.entries(opts.csp)
        .map(([key, val]) => `${key} ${val.join(' ')}`)
        .join('; ');
      headers['Content-Security-Policy'] = directives;
    } else {
      headers['Content-Security-Policy'] = "default-src 'self'";
    }
  }

  // 2. Strict-Transport-Security (HSTS)
  if (opts.hsts !== false) {
    if (typeof opts.hsts === 'object') {
      const maxAge = opts.hsts.maxAge ?? 15552000;
      const sub = opts.hsts.includeSubDomains !== false ? '; includeSubDomains' : '';
      const preload = opts.hsts.preload ? '; preload' : '';
      headers['Strict-Transport-Security'] = `max-age=${maxAge}${sub}${preload}`;
    } else {
      headers['Strict-Transport-Security'] = 'max-age=15552000; includeSubDomains';
    }
  }

  // 3. X-Frame-Options (Clickjacking Protection)
  if (opts.xFrame !== false) {
    headers['X-Frame-Options'] = typeof opts.xFrame === 'string' ? opts.xFrame : 'SAMEORIGIN';
  }

  // 4. X-Content-Type-Options (MIME Sniffing Protection)
  if (opts.xContentType !== false) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }

  // 5. Referrer-Policy
  if (opts.referrerPolicy !== false) {
    headers['Referrer-Policy'] = typeof opts.referrerPolicy === 'string' ? opts.referrerPolicy : 'no-referrer';
  }

  // 6. Permissions-Policy
  if (opts.permissionsPolicy) {
    const policy = Object.entries(opts.permissionsPolicy)
      .map(([key, val]) => `${key}=(${val})`)
      .join(', ');
    headers['Permissions-Policy'] = policy;
  }

  // Pre-bake and freeze headers as a flat list of key-value pairs
  const preBakedHeaders = Object.freeze(Object.entries(headers));

  return (req, res, next) => {
    // Zero-allocation loop directly sets pre-baked headers
    for (let i = 0; i < preBakedHeaders.length; i++) {
      const [key, val] = preBakedHeaders[i];
      res.setHeader(key, val);
    }
    next();
  };
}
