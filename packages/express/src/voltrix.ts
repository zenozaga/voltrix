import { createServer, type VoltrixServer, type Ctx } from '@voltrix/server';
import type * as Handlers from './types/handlers.js';
import { Router } from './router.js';
import { Renderer } from './renderer.js';
import { Response } from './http/response.js';
import { Request } from './http/request.js';

interface VoltrixOptions {
  poolSize?: number;
}

interface ExpressCtx extends Ctx {
  locals: {
    req: Request;
    res: Response;
    [key: string]: any;
  };
}

export class Voltrix extends Renderer {
  readonly server: VoltrixServer;
  private globalMiddlewares: Handlers.Middleware[] = [];
  private errorHandlers: Handlers.ErrorMiddleware[] = [];
  private _transformers: Handlers.TransformerFn[] = [];

  constructor(options?: VoltrixOptions) {
    super();
    this.server = createServer({ poolSize: options?.poolSize });
    this._setupBridge();
  }

  private _setupBridge(): void {
    this.server.onRequest((ctx: Ctx) => {
      const eCtx = ctx as ExpressCtx;
      const req = new Request(ctx);
      const res = new Response(ctx, this);
      eCtx.locals.req = req;
      eCtx.locals.res = res;

      if (this.globalMiddlewares.length === 0) return;

      return (async () => {
        for (const mw of this.globalMiddlewares) {
          await new Promise<void>((resolve, reject) => {
            const next = (err?: unknown) => err ? reject(err) : resolve();
            try {
              const r = mw(req, res, next);
              if (r instanceof Promise) r.catch(reject);
            } catch (e) {
              reject(e);
            }
          });
          if (ctx.sent || ctx.aborted) return;
        }
      })();
    });

    this.server.onError(async (ctx: Ctx, err: unknown) => {
      const eCtx = ctx as ExpressCtx;
      const req = eCtx.locals.req;
      const res = eCtx.locals.res;

      if (!req || !res) {
        if (!ctx.sent && !ctx.aborted) {
          ctx.status(500).json({ error: (err as Error).message || 'Internal Server Error' });
        }
        return;
      }

      if (this.errorHandlers.length === 0) {
        if (!res.headersSent && !res.isAborted) {
          res.status(500).json({ error: (err as Error).message || 'Internal Server Error' });
        }
        return;
      }

      return new Promise<void>((resolve) => {
        let i = 0;
        const next = (secondaryErr?: unknown) => {
          if (secondaryErr) {
            if (!res.headersSent && !res.isAborted) {
              res.status(500).json({ error: (secondaryErr as Error).message || 'Internal Server Error' });
            }
            resolve();
            return;
          }

          const handler = this.errorHandlers[i++];
          if (!handler) {
            if (!res.headersSent && !res.isAborted) {
              const message = err instanceof Error ? err.message : String(err);
              res.status(500).json({ error: message });
            }
            resolve();
            return;
          }

          try {
            const errorInstance = (secondaryErr || err) instanceof Error 
              ? (secondaryErr || err) as Error 
              : new Error(String(secondaryErr || err));
            const r = handler(errorInstance, req, res, next);
            if (r instanceof Promise) r.then(resolve, next);
          } catch (e) {
            next(e);
          }
        };
        next();
      });
    });
  }

  use(arg1: string | Handlers.Middleware | Router, arg2?: Handlers.Middleware | Router): this {
    if (typeof arg1 === 'function') {
      this.globalMiddlewares.push(arg1);
      return this;
    }
    if (arg1 instanceof Router) {
      this.integrateRouter('', arg1);
      return this;
    }
    if (typeof arg1 === 'string' && arg2 instanceof Router) {
      this.integrateRouter(arg1, arg2);
      return this;
    }
    return this;
  }

  useError(handler: Handlers.ErrorMiddleware): this {
    this.errorHandlers.push(handler);
    return this;
  }

  useNotFound(handler: Handlers.HandlerFunction): this {
    this.server.notFound((ctx: Ctx) => {
      const eCtx = ctx as ExpressCtx;
      return handler(eCtx.locals.req, eCtx.locals.res);
    });
    return this;
  }

  private register(method: string, pattern: string, handler: Handlers.HandlerFunction): any {
    const builder = (this.server as any)[method](pattern, (ctx: Ctx) => {
      const eCtx = ctx as ExpressCtx;
      const req = eCtx.locals.req;
      const res = eCtx.locals.res;
      
      return new Promise<void>((resolve, reject) => {
        try {
          const r = handler(req, res);
          // Rely on ctx.end hijack to resolve, but catch async errors
          if (r instanceof Promise) r.catch(reject);
        } catch (e) {
          reject(e);
        }
      });
    });
    return {
      meta: (data: Record<string, any>) => {
        builder.meta('express', data);
        return builder;
      }
    };
  }

  get(pattern: string, handler: Handlers.HandlerFunction) { return this.register('get', pattern, handler); }
  post(pattern: string, handler: Handlers.HandlerFunction) { return this.register('post', pattern, handler); }
  put(pattern: string, handler: Handlers.HandlerFunction) { return this.register('put', pattern, handler); }
  delete(pattern: string, handler: Handlers.HandlerFunction) { return this.register('delete', pattern, handler); }
  patch(pattern: string, handler: Handlers.HandlerFunction) { return this.register('patch', pattern, handler); }
  options(pattern: string, handler: Handlers.HandlerFunction) { return this.register('options', pattern, handler); }
  head(pattern: string, handler: Handlers.HandlerFunction) { return this.register('head', pattern, handler); }
  any(pattern: string, handler: Handlers.HandlerFunction) { return this.register('any', pattern, handler); }

  private integrateRouter(prefix: string, router: Router): void {
    const routes = router.getFlattenedRoutes(prefix);
    for (const r of routes) {
      const { method, fullPattern, handler, allMiddlewares } = r;
      (this.server as any)[method.toLowerCase()](fullPattern, (ctx: Ctx) => {
        const eCtx = ctx as ExpressCtx;
        const req = eCtx.locals.req;
        const res = eCtx.locals.res;
        
        return new Promise<void>((resolve, reject) => {
          const expressHandler = (req: any, res: any) => {
            if (allMiddlewares.length === 0) {
              const r = handler(req, res);
              if (r instanceof Promise) r.then(resolve, reject);
              return;
            }
            let i = 0;
            const next = (err?: unknown) => {
              if (err) return reject(err);
              if (i >= allMiddlewares.length) {
                const r = handler(req, res);
                // Rely on ctx.end hijack to resolve, but catch async errors
                if (r instanceof Promise) r.catch(reject);
                return;
              }
              const mw = allMiddlewares[i++];
              try {
                const result = mw(req, res, next);
                if (result instanceof Promise) result.then(() => {}, reject);
              } catch (e) {
                reject(e);
              }
            };
            next();
          };
          
          expressHandler(req, res);
        });
      });
    }
  }

  listen(port: number, cb?: (sock: any) => void) {
    return this.server.listen({ port }).then(() => {
      if (cb) cb((this.server as any)._listenSocket);
    });
  }

  close(): Promise<void> {
    this.server.close();
    return Promise.resolve();
  }

  ws(pattern: string, behavior: any) {
    (this.server as any)._app.ws(pattern, behavior);
    return this;
  }

  useTransformer(fn: Handlers.TransformerFn): this {
    this._transformers.push(fn);
    return this;
  }

  async runTransform(schema: any, data: any, type: string, key?: string): Promise<any> {
    if (this._transformers.length === 0) return data;

    let current = data;
    for (const fn of this._transformers) {
      current = await fn({ schema, data: current, type, key });
    }
    return current;
  }

  clearAllCaches() {
    // Placeholder for compatibility
  }

  getStats() {
    return {
      totalRequests: (this.server as any)._pool?.size ?? 0,
      handlerCacheSize: 0,
      routeCache: { size: 0 },
      cacheHits: 0,
      cacheMisses: 0
    };
  }
}

export const voltrix = (opts?: VoltrixOptions) => new Voltrix(opts);
export default voltrix;
