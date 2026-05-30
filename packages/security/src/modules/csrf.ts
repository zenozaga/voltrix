import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { CsrfOptions } from '../types/index.js';
import type { IRequest, IResponse, Middleware } from '@voltrix/core';

/**
 * Fast, zero-allocation cookie parser.
 * Extracts cookie pairs directly in a single pass without large array allocations.
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  const parts = cookieHeader.split(';');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const eqIdx = p.indexOf('=');
    if (eqIdx === -1) continue;
    const name = p.slice(0, eqIdx).trim();
    const val = p.slice(eqIdx + 1).trim();
    cookies[name] = val;
  }
  return cookies;
}

/**
 * Utility to serialize a cookie name-value pair with options.
 */
export function serializeCookie(name: string, val: string, opts: any = {}): string {
  let str = `${name}=${val}`;
  if (opts.path) str += `; Path=${opts.path}`;
  if (opts.domain) str += `; Domain=${opts.domain}`;
  if (opts.maxAge !== undefined) str += `; Max-Age=${opts.maxAge}`;
  if (opts.expires instanceof Date) str += `; Expires=${opts.expires.toUTCString()}`;
  if (opts.secure) str += '; Secure';
  if (opts.httpOnly) str += '; HttpOnly';
  if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
  return str;
}

/**
 * Timing-attack safe string comparison.
 * Prevents side-channel timing analysis during token verification.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * CSRF Protection Middleware using Double Submit Cookie pattern.
 */
export function csrf(options?: CsrfOptions | boolean): Middleware {
  if (options === false || !options) {
    return (req, res, next) => next();
  }

  const opts = typeof options === 'object' ? options : {};
  const cookieName = opts.cookieName ?? '_csrf';
  const headerName = opts.headerName ?? 'x-csrf-token';
  const cookieOpts = opts.cookieOptions ?? {
    path: '/',
    secure: false, // Default false, developers toggle true in production
    httpOnly: false, // Must be readable by client script for double-submit
    sameSite: 'Lax'
  };
  const ignoreMethods = opts.ignoreMethods ?? ['GET', 'HEAD', 'OPTIONS'];

  return async (req, res, next) => {
    const cookies = parseCookies(req.header('cookie'));
    let token = cookies[cookieName];

    // 1. Generate new CSRF token if not already present
    if (!token) {
      token = randomBytes(24).toString('base64url');
      res.setHeader('Set-Cookie', serializeCookie(cookieName, token, cookieOpts));
    }

    // 2. Ignore non-mutative safe methods
    if (ignoreMethods.includes(req.method)) {
      return next();
    }

    // 3. Extract validation token from incoming header
    const incomingToken = req.header(headerName);
    if (!incomingToken) {
      res.status(403).json({ error: 'Missing CSRF token' });
      return;
    }

    // 4. Perform timing-safe validation check
    const isValid = timingSafeCompare(token, incomingToken);
    if (!isValid) {
      res.status(403).json({ error: 'Invalid CSRF token' });
      return;
    }

    next();
  };
}
