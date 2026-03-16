import * as UWS from 'uWebSockets.js';
import type * as Handlers from './types/handlers.js';

import { Router, type RouteBuilder } from './router.js';
import { LRUCache } from './common/lru-cache.js';
import { RouteLRUCache } from './common/route-cache.js';

import { Renderer } from './renderer.js';
import { Response } from './http/response.js';
import { QueryParser, Request } from './http/request.js';
import { ObjectPool } from './common/object-pool.js';

interface CompiledHandler {
  middlewares: Handlers.Middleware[];
  handler: Handlers.HandlerFunction;
  hasMiddleware: boolean;
}

interface VoltrixOptions {
  cacheSize?: number;
  cacheTTL?: number;
  routeCacheSize?: number;
  routeCacheTTL?: number;
}

/**
 * Voltrix Framework
 *
 * High-performance HTTP/WebSocket server for backend environments
 * built over uWebSockets.js. Orchestrates:
 *  - routing
 *  - middleware execution
 *  - error pipeline
 *  - response caching
 *  - handler caching
 *  - request/response abstraction
 */
export class Voltrix extends Renderer {
  readonly uws: UWS.TemplatedApp;

  private readonly handlerCache: LRUCache<CompiledHandler>;
  private readonly routeCache: RouteLRUCache;

  private _transformers: Handlers.TransformerFn[] = [];

  private globalMiddlewares: Handlers.Middleware[] = [];
  private errorHandlers: Handlers.ErrorMiddleware[] = [];

  private notFoundHandler: Handlers.HandlerFunction | null = null;

  private hasGlobalMiddleware = false;
  private listenSocket: any = null;

  private stats = {
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
  };

  private readonly requestPool: ObjectPool<Request>;
  private readonly responsePool: ObjectPool<Response>;

  constructor(options?: VoltrixOptions) {
    super();

    this.uws = UWS.App();
    this.handlerCache = new LRUCache(options?.cacheSize, options?.cacheTTL);
    this.routeCache = new RouteLRUCache(options?.routeCacheSize, options?.routeCacheTTL);

    // Initialize pools
    this.requestPool = new ObjectPool(() => new Request(), 1000);
    this.responsePool = new ObjectPool(() => new Response(), 1000);
  }

  // =======================================
  // Registration / Composition
  // =======================================

  /**
   * Register global middleware or routers.
   */
  use(arg1: string | Handlers.Middleware | Router, arg2?: Handlers.Middleware | Router): this {
    if (typeof arg1 === 'function') {
      this.globalMiddlewares.push(arg1);
      this.hasGlobalMiddleware = true;
      this.handlerCache.clear();
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

  /**
   * Register global error handler.
   */
  useError(handler: Handlers.ErrorMiddleware): this {
    this.errorHandlers.push(handler);
    return this;
  }

  /**
   * Register global parameter transformer.
   */
  useTransformer(fn: Handlers.TransformerFn): this {
    this._transformers.push(fn);
    return this;
  }

  /**
   * Internal method to run transformation.
   */
  /**
   * Internal method to run transformation.
   */
  async runTransform(schema: any, data: any, type: string, key?: string): Promise<any> {
    if (this._transformers.length === 0) return data;

    let current = data;
    for (const fn of this._transformers) {
      current = await fn({ schema, data: current, type, key });
    }
    return current;
  }

  /**
   * Set 404 handler.
   */
  useNotFound(handler: Handlers.HandlerFunction): this {
    this.notFoundHandler = handler;
    return this;
  }

  // =======================================
  // HTTP Registration (single entry point)
  // =======================================

  private register(method: string, pattern: string, handler: Handlers.HandlerFunction): RouteBuilder {
    const meta: Record<string, any> = {};
    const compiled = (res: UWS.HttpResponse, req: UWS.HttpRequest) => {
      this.handleRequest(pattern, req, res, handler, undefined, true);
    };

    (this.uws as any)[method](pattern, compiled);
    
    const builder: RouteBuilder = {
      meta: (data: Record<string, any>) => {
        Object.assign(meta, data);
        return builder;
      }
    };
    return builder;
  }

  get(pattern: string, handler: Handlers.HandlerFunction): RouteBuilder {
    return this.register('get', pattern, handler);
  }
  post(pattern: string, handler: Handlers.HandlerFunction): RouteBuilder {
    return this.register('post', pattern, handler);
  }
  put(pattern: string, handler: Handlers.HandlerFunction): RouteBuilder {
    return this.register('put', pattern, handler);
  }
  delete(pattern: string, handler: Handlers.HandlerFunction): RouteBuilder {
    return this.register('del', pattern, handler);
  }
  patch(pattern: string, handler: Handlers.HandlerFunction): RouteBuilder {
    return this.register('patch', pattern, handler);
  }
  options(pattern: string, handler: Handlers.HandlerFunction): RouteBuilder {
    return this.register('options', pattern, handler);
  }
  head(pattern: string, handler: Handlers.HandlerFunction): RouteBuilder {
    return this.register('head', pattern, handler);
  }
  any(pattern: string, handler: Handlers.HandlerFunction): RouteBuilder {
    return this.register('any', pattern, handler);
  }

  // =======================================
  // Router Integration
  // =======================================

  /**
   * Register all HTTP and WebSocket routes from a router.
   */
  private integrateRouter(prefix: string, router: Router): void {
    const routes = router.getFlattenedRoutes(prefix);
    const wsRoutes = (router as any).getWsRoutes?.() ?? [];

    // HTTP routes
    for (const r of routes) {
      const { method, fullPattern, handler, allMiddlewares, errorHandlers, paramIndices } = r;

      const hasMws = this.globalMiddlewares.length > 0 || allMiddlewares.length > 0;
      const chain = hasMws
          ? [...this.globalMiddlewares, ...allMiddlewares]
          : null;

      const compiled = (res: UWS.HttpResponse, req: UWS.HttpRequest) => {
        this.handleRequest(fullPattern, req, res, handler, { chain, errorHandlers, paramIndices });
      };

      (this.uws as any)[method.toLowerCase()](fullPattern, compiled);
    }

    // WebSockets
    for (const ws of wsRoutes) {
      const fullPath =
        (prefix && prefix !== '/' ? (prefix.endsWith('/') ? prefix.slice(0, -1) : prefix) : '') +
        (ws.pattern.startsWith('/') ? ws.pattern : '/' + ws.pattern);

      this.uws.ws(fullPath, ws.behavior as UWS.WebSocketBehavior<any>);
    }

    this.handlerCache.clear();
  }

  /**
   * Execute router-specific middleware chain.
   */
  private executeRouterMiddlewareChain(
    req: Request,
    res: Response,
    handler: Handlers.HandlerFunction,
    mws: Handlers.Middleware[],
    errs: Handlers.ErrorMiddleware[]
  ): void {
    let i = 0;

    const onError = (err: any) => {
      if (errs.length === 0) {
        this.handleError(err, req, res);
        return;
      }

      let ei = 0;
      const nextErr = (): void => {
        const fn = errs[ei++];
        if (!fn) {
          this.handleError(err, req, res);
          return;
        }

        try {
          fn(err, req, res, nextErr);
        } catch {
          nextErr();
        }
      };
      nextErr();
    };

    const next = (err?: any): void => {
      if (err) return onError(err);
      if (i >= mws.length) {
        try {
          const r = handler(req, res);
          if (r instanceof Promise) {
            r.catch(onError);
          }
        } catch (e) {
          onError(e);
        }
        return;
      }

      const mw = mws[i++];
      try {
        const result = mw(req, res, next);
        if (result instanceof Promise) result.catch(onError);
      } catch (e) {
        onError(e);
      }
    };

    next();
  }

  // =======================================
  // Request Execution Path
  // =======================================



  private handleRequest(
    pattern: string,
    uwsReq: UWS.HttpRequest,
    uwsRes: UWS.HttpResponse,
    handler: Handlers.HandlerFunction,
    routerConfig?: { chain: Handlers.Middleware[] | null; errorHandlers: Handlers.ErrorMiddleware[]; paramIndices?: Map<string, number> },
    isDirect?: boolean
  ) {
    this.stats.totalRequests++;

    const method = uwsReq.getMethod().toUpperCase();
    const path = uwsReq.getUrl();

    // Cache lookup (only for direct/standard routes for now)
    if (isDirect) {
      const cached = this.routeCache.get({ method, path });
      if (cached) {
        uwsRes.cork(() => {
          uwsRes.writeStatus(String(cached.statusCode));
          for (const [k, v] of Object.entries(cached.headers)) {
            uwsRes.writeHeader(k, v as string);
          }
          uwsRes.end(cached.body);
        });
        return;
      }
    }

    const req = this.requestPool.acquire();
    const res = this.responsePool.acquire();

    req.initialize(uwsReq, uwsRes, pattern, routerConfig?.paramIndices, method, path);
    res.initialize(uwsRes, this, () => {
      this.requestPool.release(req);
      this.responsePool.release(res);
    });

    if (routerConfig?.chain) {
      this.executeRouterMiddlewareChain(req, res, handler, routerConfig.chain, routerConfig.errorHandlers);
      return;
    }

    if (isDirect && this.hasGlobalMiddleware) {
      this.executeRouterMiddlewareChain(req, res, handler, this.globalMiddlewares, this.errorHandlers);
      return;
    }

    try {
      const out = handler(req, res);
      if (out instanceof Promise) {
        out.catch(err => this.handleError(err, req, res));
      }
    } catch (e) {
      this.handleError(e, req, res);
    }
  }

  // =======================================
  // Error Handling Pipeline
  // =======================================

  private handleError(error: any, req: Request, res: Response): void {
    if (res.isAborted) return;

    if (this.errorHandlers.length === 0) {
      console.error('Unhandled error:', error);
      if (!res.headersSent) res.status(500).send('Internal Server Error');
      return;
    }

    let i = 0;

    const next = (): void => {
      const handler = this.errorHandlers[i++];
      if (!handler) {
        if (!res.headersSent)
          res.status(500).json({ error: 'Internal Server Error' });
        return;
      }

      try {
        const r = handler(error, req, res, next);
        if (r instanceof Promise) r.then(undefined, next);
      } catch {
        next();
      }
    };

    next();
  }

  // =======================================
  // 404 Handler
  // =======================================

  private setupNotFoundHandler(): void {
    if (!this.notFoundHandler) return;

    this.uws.any('/*', (res, req) => {
      this.handleRequest('/*', req, res, this.notFoundHandler!, undefined, true);
    });
  }

  // =======================================
  // Lifecycle
  // =======================================

  listen(port: number, cb?: (sock: UWS.us_listen_socket) => void) {
    return new Promise<UWS.us_listen_socket>((resolve, reject) => {
      this.setupNotFoundHandler();

      this.uws.listen('127.0.0.1', port, sock => {
        if (!sock) return reject(new Error(`Failed to listen on port ${port}`));

        this.listenSocket = sock;
        if (cb) cb(sock);
        resolve(sock);
      });
    });
  }

  close(): Promise<void> {
    return new Promise(resolve => {
      if (this.listenSocket) {
        this.uws.close();
        this.listenSocket = null;
      }
      setTimeout(resolve, 10);
    });
  }

  ws(pattern: string, behavior: UWS.WebSocketBehavior<any>) {
    this.uws.ws(pattern, behavior);
    return this;
  }

  // =======================================
  // Cache / Stats
  // =======================================

  clearAllCaches() {
    this.handlerCache.clear();
    this.routeCache.clear();
  }

  clearHandlerCache() {
    this.handlerCache.clear();
  }

  clearRouteCache() {
    this.routeCache.clear();
  }

  getStats() {
    return {
      ...this.stats,
      routeCache: this.routeCache.getStats(),
      handlerCacheSize: this.handlerCache.size(),
    };
  }

  // =======================================
  // Static Utilities
  // =======================================

  static setQueryParser(parser: QueryParser) {
    Request.setQueryParser(parser);
  }
}

export const voltrix = (opts?: {
  cacheSize?: number;
  cacheTTL?: number;
  routeCacheSize?: number;
  routeCacheTTL?: number;
}) => new Voltrix(opts);

export default voltrix;
