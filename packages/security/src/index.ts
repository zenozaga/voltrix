import type { SecurityOptions } from './types/index.js';
import type { Middleware } from '@voltrix/core';
import { ipFilter } from './modules/ip-filter.js';
import { cors } from './modules/cors.js';
import { helmet } from './modules/helmet.js';
import { rateLimit } from './modules/rate-limit.js';
import { csrf } from './modules/csrf.js';
import { session } from './modules/session.js';

// Export everything for public consumption
export * from './types/index.js';
export * from './store/index.js';
export * from './decorators/index.js';
export * from './modules/ip-filter.js';
export * from './modules/cors.js';
export * from './modules/helmet.js';
export * from './modules/rate-limit.js';
export * from './modules/csrf.js';
export * from './modules/session.js';

export function security(options?: SecurityOptions): any {
  const opts = options ?? {};
  const pipeline: Middleware[] = [];

  // 1. IP Filter runs first to immediately discard blacklisted IPs in onRequest
  if (opts.ipFilter !== false && opts.ipFilter !== undefined) {
    pipeline.push(ipFilter(opts.ipFilter));
  }
  // 2. CORS runs early to capture OPTIONS Preflight requests directly
  if (opts.cors !== false && opts.cors !== undefined) {
    pipeline.push(cors(opts.cors));
  }
  // 3. Helmet sets security headers
  if (opts.helmet !== false && opts.helmet !== undefined) {
    pipeline.push(helmet(opts.helmet));
  }
  // 4. Rate Limit limits frequencies
  if (opts.rateLimit !== false && opts.rateLimit !== undefined) {
    pipeline.push(rateLimit(opts.rateLimit));
  }
  // 5. CSRF checks mutative endpoints
  if (opts.csrf !== false && opts.csrf !== undefined) {
    pipeline.push(csrf(opts.csrf));
  }
  // 6. Session reads and writes state
  if (opts.session !== false && opts.session !== undefined) {
    pipeline.push(session(opts.session as any));
  }

  // Freeze pipeline to enforce zero state bleed and maximum CPU optimization
  const frozenPipeline = Object.freeze(pipeline);

  const middleware: any = (req: any, res: any, next: any) => {
    let index = 0;

    function nextStep(err?: any): void {
      if (err) {
        return next(err);
      }
      if (index >= frozenPipeline.length) {
        return next();
      }
      
      const mw = frozenPipeline[index++];
      try {
        const resVal = mw(req, res, nextStep) as any;
        if (resVal instanceof Promise) {
          resVal.catch(nextStep);
        }
      } catch (mwErr) {
        nextStep(mwErr);
      }
    }

    nextStep();
  };

  // Hybrid Plugin Interface support
  Object.defineProperty(middleware, 'name', { value: 'security', configurable: true });
  middleware.version = '0.2.1';
  middleware.register = (api: any, pluginOpts?: any) => {
    const activeMw = pluginOpts ? security(pluginOpts) : middleware;
    api.addHook('onRequest', async (ctx: any) => {
      await new Promise<void>((resolve, reject) => {
        activeMw(ctx, ctx, (err?: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  };

  return middleware;
}
