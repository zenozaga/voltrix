import type { IpFilterOptions } from '../types/index.js';
import type { IRequest, IResponse, Middleware } from '@voltrix/core';
import { getClientIp } from './rate-limit.js';

/**
 * Compiled IP and CIDR matching engine.
 * Converts IPv4 CIDR blocks into 32-bit binary integer boundaries for nanosecond-level bitwise matching.
 */
export class IpMatcher {
  private readonly _v4Ranges: Array<{ base: number; mask: number }> = [];
  private readonly _v6Ranges: string[] = [];

  constructor(cidrs: string[]) {
    for (const cidr of cidrs) {
      const trimmed = cidr.trim();
      if (trimmed.includes(':')) {
        // Simple exact matching for IPv6
        this._v6Ranges.push(trimmed);
      } else {
        // IPv4 Bitwise compile
        const parts = trimmed.split('/');
        const ip = parts[0].trim();
        const maskBits = parts[1] ? parseInt(parts[1], 10) : 32;
        
        try {
          const base = this.ipToLong(ip);
          const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
          this._v4Ranges.push({ base: (base & mask) >>> 0, mask });
        } catch {
          // Ignore invalid IP strings during parsing
        }
      }
    }
  }

  private ipToLong(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) throw new Error('Invalid IPv4');
    return ((parseInt(parts[0], 10) << 24) >>> 0) +
           ((parseInt(parts[1], 10) << 16) >>> 0) +
           ((parseInt(parts[2], 10) << 8) >>> 0) +
           (parseInt(parts[3], 10) >>> 0);
  }

  /**
   * Matches an IP address against compiled ranges.
   */
  match(ip: string): boolean {
    const cleanIp = ip.trim();
    if (cleanIp.includes(':')) {
      return this._v6Ranges.includes(cleanIp);
    }
    
    try {
      const ipLong = this.ipToLong(cleanIp);
      const ranges = this._v4Ranges;
      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i];
        if ((ipLong & r.mask) === r.base) {
          return true;
        }
      }
    } catch {}
    
    return false;
  }
}

/**
 * Hyper-performance IP Filtering Middleware.
 * Rejects requests from unauthorized IPs or subnets in the earliest onRequest hook.
 */
export function ipFilter(options?: IpFilterOptions | boolean): Middleware {
  if (options === false || !options) {
    return (req, res, next) => next();
  }

  const opts = typeof options === 'object' ? options : {};
  const whitelistMatcher = opts.whitelist ? new IpMatcher(opts.whitelist) : null;
  const blacklistMatcher = opts.blacklist ? new IpMatcher(opts.blacklist) : null;
  const handler = opts.handler ?? ((req, res) => {
    res.status(403).end('Forbidden');
  });

  return async (req, res, next) => {
    const ip = getClientIp(req);

    let allowed = true;

    // 1. Whitelist logic: IP MUST match whitelist if whitelist is defined
    if (whitelistMatcher) {
      allowed = whitelistMatcher.match(ip);
    }
    // 2. Blacklist logic: IP MUST NOT match blacklist if blacklist is defined
    else if (blacklistMatcher) {
      allowed = !blacklistMatcher.match(ip);
    }

    if (!allowed) {
      // Abort pipeline immediately
      const result = handler(req, res);
      if (result instanceof Promise) {
        await result;
      }
      return;
    }

    next();
  };
}
