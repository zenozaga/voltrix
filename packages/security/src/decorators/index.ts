import { Metadata } from '@voltrix/core';
import type { RateLimitOptions, IpFilterOptions } from '../types/index.js';

/**
 * Decorator to attach Rate Limiting policies to a Controller class or individual route methods.
 * 
 * @example
 * ```ts
 * @Controller('auth')
 * class AuthController {
 *   @POST('/login')
 *   @RateLimit({ limit: 5, windowMs: 60000 })
 *   async login() { ... }
 * }
 * ```
 */
export function RateLimit(options: RateLimitOptions): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol) => {
    const actualTarget = propertyKey ? target : target.prototype;
    Metadata.prefix('security').set(actualTarget, propertyKey, { rateLimit: options });
  };
}

/**
 * Decorator to apply IP and CIDR whitelist/blacklist policies to a Controller class or individual route methods.
 * 
 * @example
 * ```ts
 * @Controller('admin')
 * @IpFilter({ whitelist: ['10.0.0.0/8'] })
 * class AdminController { ... }
 * ```
 */
export function IpFilter(options: IpFilterOptions): ClassDecorator & MethodDecorator {
  return (target: any, propertyKey?: string | symbol) => {
    const actualTarget = propertyKey ? target : target.prototype;
    Metadata.prefix('security').set(actualTarget, propertyKey, { ipFilter: options });
  };
}
