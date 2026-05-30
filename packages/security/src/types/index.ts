import type { IRequest, IResponse } from '@voltrix/core';

/**
 * Interface representing a shared caching store for security modules.
 * This abstracts local memory from clustered distributed instances like Redis.
 */
export interface SecurityStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  increment(key: string, ttlMs: number): Promise<number>;
  decrement(key: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Helmet module configuration options.
 */
export interface HelmetOptions {
  csp?: boolean | Record<string, string[]>;
  hsts?: boolean | { maxAge?: number; includeSubDomains?: boolean; preload?: boolean };
  xFrame?: boolean | 'DENY' | 'SAMEORIGIN';
  xContentType?: boolean;
  referrerPolicy?: boolean | string;
  permissionsPolicy?: boolean | Record<string, string>;
}

/**
 * CORS module configuration options.
 */
export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean | Promise<boolean>);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Rate Limiting module configuration options.
 */
export interface RateLimitOptions {
  windowMs?: number;               // Time window in ms (Default: 60000)
  limit?: number;                  // Maximum requests per window (Default: 100)
  keyGenerator?: (req: IRequest) => string | Promise<string>; // Unique identification logic
  store?: SecurityStore;           // Store adapter (Default: Local MemoryStore)
  handler?: (req: IRequest, res: IResponse) => void | Promise<void>; // Custom exceeded handler
}

/**
 * IP Filtering module configuration options.
 */
export interface IpFilterOptions {
  whitelist?: string[];            // Permitted IP ranges (CIDR blocks supported)
  blacklist?: string[];            // Prohibited IP ranges (CIDR blocks supported)
  handler?: (req: IRequest, res: IResponse) => void | Promise<void>; // Custom block handler
}

/**
 * CSRF Protection module configuration options.
 */
export interface CsrfOptions {
  cookieName?: string;             // Name of the CSRF double submit cookie (Default: '_csrf')
  headerName?: string;             // Name of the incoming validation header (Default: 'x-csrf-token')
  cookieOptions?: {
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  };
  ignoreMethods?: string[];        // HTTP methods exempted from verification (Default: ['GET', 'HEAD', 'OPTIONS'])
}

/**
 * Session Management module configuration options.
 */
export interface SessionOptions {
  secret: string;                  // Encryption secret (AES-256-GCM requires min 32-char key)
  cookieName?: string;             // Name of the session cookie (Default: 'voltrix_session')
  ttlMs?: number;                  // Session time-to-live in ms (Default: 86400000 / 24h)
  store?: SecurityStore;           // Centralized store for distributed session states (Default: Cookie Session)
  cookieOptions?: {
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  };
}

/**
 * Complete security module options pack.
 */
export interface SecurityOptions {
  helmet?: boolean | HelmetOptions;
  cors?: boolean | CorsOptions;
  rateLimit?: boolean | RateLimitOptions;
  ipFilter?: boolean | IpFilterOptions;
  csrf?: boolean | CsrfOptions;
  session?: boolean | SessionOptions;
}
